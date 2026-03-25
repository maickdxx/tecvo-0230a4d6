import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Service } from "@/hooks/useServices";
import type { ServiceItem } from "@/hooks/useServiceItems";

export interface ServiceOrderData {
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  equipmentType: string;
  equipmentBrand: string;
  equipmentModel: string;
  solution: string;
  paymentMethod: string;
  paymentDueDate: string;
  paymentNotes: string;
}

interface ServiceOrderEquipment {
  id?: string;
  name?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  conditions?: string;
  defects?: string;
  solution?: string;
  technical_report?: string;
  warranty_terms?: string;
}

interface ServiceOrderPDFData {
  service: Service;
  items: ServiceItem[];
  equipmentList?: ServiceOrderEquipment[];
  organizationName: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationCnpj?: string;
  organizationLogo?: string;
  organizationWebsite?: string;
  organizationZipCode?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationSignature?: string;
  autoSignatureOS?: boolean;
  clientSignatureUrl?: string;
  orderData: ServiceOrderData;
  isFreePlan?: boolean;
  returnBlob?: boolean;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateServiceOrderPDF({
  service,
  items,
  equipmentList = [],
  organizationName,
  organizationPhone,
  organizationEmail,
  organizationAddress,
  organizationCnpj,
  organizationLogo,
  organizationWebsite,
  organizationZipCode,
  organizationCity,
  organizationState,
  organizationSignature,
  autoSignatureOS = false,
  clientSignatureUrl,
  orderData,
  isFreePlan = false,
  returnBlob = false,
}: ServiceOrderPDFData): Promise<Blob | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  const FOOTER_RESERVED = 18; // space reserved for footer
  const usableHeight = pageHeight - FOOTER_RESERVED;

  // Premium color palette
  const primary = { r: 25, g: 95, b: 170 };
  const primaryLight = { r: 235, g: 244, b: 255 };
  const textDark = { r: 33, g: 37, b: 41 };
  const textMuted = { r: 108, g: 117, b: 125 };
  const borderLight = { r: 222, g: 226, b: 230 };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  /** Check if we need a new page; if so, add one and reset yPos */
  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      doc.addPage();
      yPos = margin;
    }
  };

  const drawClientField = (label: string, value: string | null | undefined, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(value || "", x + doc.getTextWidth(label) + 2, y);
  };

  const drawSectionLabel = (title: string) => {
    ensureSpace(12);
    const labelHeight = 7;
    doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, labelHeight, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(title, margin + 4, yPos + 5);
    yPos += labelHeight;
  };

  const halfWidth = contentWidth / 2;
  const leftX = margin + 4;
  const rightX = margin + halfWidth + 4;

  // ===================== HEADER =====================
  const headerHeight = 30;
  
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(margin, yPos, contentWidth, 3, "F");
  yPos += 3;

  doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, headerHeight, "FD");

  let logoWidth = 0;
  if (organizationLogo) {
    const logoData = await loadImageAsBase64(organizationLogo);
    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", margin + 4, yPos + 3, 24, 24);
        logoWidth = 30;
      } catch {
        logoWidth = 0;
      }
    }
  }

  const textStartX = margin + 5 + logoWidth;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(organizationName, textStartX, yPos + 8);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  let infoY = yPos + 13;
  
  const companyDetails: string[] = [];
  if (organizationCnpj) companyDetails.push(`CNPJ: ${organizationCnpj}`);
  if (organizationPhone) companyDetails.push(organizationPhone);
  if (organizationEmail) companyDetails.push(organizationEmail);
  
  if (companyDetails.length > 0) {
    doc.text(companyDetails.join("  •  "), textStartX, infoY);
    infoY += 4;
  }

  const addressParts: string[] = [];
  if (organizationAddress) addressParts.push(organizationAddress);
  if (organizationCity) addressParts.push(organizationCity);
  if (organizationState) addressParts.push(organizationState);
  if (organizationZipCode) addressParts.push(`CEP ${organizationZipCode}`);
  
  if (addressParts.length > 0) {
    const addressLine = addressParts.join(" - ");
    const truncated = addressLine.length > 90 ? addressLine.substring(0, 90) + "..." : addressLine;
    doc.text(truncated, textStartX, infoY);
    infoY += 4;
  }

  if (organizationWebsite) {
    doc.text(organizationWebsite, textStartX, infoY);
  }

  yPos += headerHeight + 6;

  // ===================== DOCUMENT TITLE =====================
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(margin, yPos, contentWidth, 14, "F");
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(
    `ORDEM DE SERVIÇO Nº ${service.quote_number?.toString().padStart(4, "0") || "0001"}`,
    margin + 5,
    yPos + 9.5
  );
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "dd/MM/yyyy"), pageWidth - margin - 5, yPos + 9.5, { align: "right" });

  yPos += 18;
  
  // Linha decorativa fina abaixo do título
  doc.setDrawColor(primary.r, primary.g, primary.b);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
  yPos += 3;

  // ===================== EXECUTION PERIOD =====================
  const hasEntry = orderData.entryDate && orderData.entryTime;
  const hasExit = orderData.exitDate && orderData.exitTime;
  
  if (hasEntry || hasExit) {
    drawSectionLabel("PERÍODO DE EXECUÇÃO");
    
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.rect(margin, yPos, contentWidth, 8);
    doc.setFontSize(8);
    
    if (hasEntry) {
      drawClientField("Entrada: ", `${orderData.entryDate} às ${orderData.entryTime}`, leftX, yPos + 5.5);
    }
    if (hasExit) {
      drawClientField("Saída: ", `${orderData.exitDate} às ${orderData.exitTime}`, rightX, yPos + 5.5);
    }

    yPos += 12;
  }

  // ===================== CLIENT DATA =====================
  drawSectionLabel("DADOS DO CLIENTE");

  // Always show all fields, even when empty
  const docLabel = service.client?.person_type === "pj" ? "CNPJ/CPF: " : "CNPJ/CPF: ";
  
  // Prioritize OS-specific address fields over client address (OS is a frozen document)
  const hasServiceAddress = service.service_street || service.service_city;
  const clientAddress = hasServiceAddress
    ? [service.service_street, service.service_number, service.service_complement, service.service_neighborhood].filter(Boolean).join(", ")
    : (service.client?.address || 
       [service.client?.street, service.client?.number, service.client?.complement, service.client?.neighborhood].filter(Boolean).join(", "));
  const clientCity = hasServiceAddress ? (service.service_city || "") : (service.client?.city || "");
  const clientState = hasServiceAddress ? (service.service_state || "") : (service.client?.state || "");
  const clientZipCode = hasServiceAddress ? (service.service_zip_code || "") : (service.client?.zip_code || "");

  // Calculate how many lines the address needs
  doc.setFontSize(8);
  const addressLabelWidth = doc.getTextWidth("Endereço: ");
  const leftColMaxWidth = halfWidth - 8;
  const addressValueMaxWidth = leftColMaxWidth - addressLabelWidth;
  const addressLines = doc.splitTextToSize(clientAddress || "", addressValueMaxWidth);
  const addressRowH = Math.max(7, 4 + addressLines.length * 3.5);

  const clientRowDefs = [
    { left: { label: "Cliente: ", value: service.client?.name || "" }, right: { label: docLabel, value: service.client?.document || "" }, height: 7 },
    { left: { label: "Endereço: ", value: clientAddress || "", multiline: true }, right: { label: "CEP: ", value: clientZipCode }, height: addressRowH },
    { left: { label: "Cidade: ", value: clientCity }, right: { label: "Estado: ", value: clientState }, height: 7 },
    { left: { label: "Telefone: ", value: service.client?.phone || "" }, right: { label: "E-mail: ", value: service.client?.email || "" }, height: 7 },
  ];

  const clientBoxHeight = clientRowDefs.reduce((sum, r) => sum + r.height, 0);

  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, clientBoxHeight);
  doc.line(margin + halfWidth, yPos, margin + halfWidth, yPos + clientBoxHeight);
  let lineY = yPos;
  for (let i = 0; i < clientRowDefs.length - 1; i++) {
    lineY += clientRowDefs[i].height;
    doc.line(margin, lineY, margin + contentWidth, lineY);
  }

  doc.setFontSize(8);
  let cellY = yPos;
  for (let i = 0; i < clientRowDefs.length; i++) {
    const row = clientRowDefs[i];
    const textY = cellY + 5;
    if (row.left.label) {
      if ((row.left as any).multiline) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(row.left.label, leftX, textY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(textDark.r, textDark.g, textDark.b);
        const valLines = doc.splitTextToSize(row.left.value, addressValueMaxWidth);
        doc.text(valLines, leftX + addressLabelWidth + 2, textY);
      } else {
        drawClientField(row.left.label, row.left.value, leftX, textY);
      }
    }
    if (row.right.label) drawClientField(row.right.label, row.right.value, rightX, textY);
    cellY += row.height;
  }

  yPos += clientBoxHeight + 4;

  // ===================== EQUIPMENT =====================
  const normalizedEquipment = (equipmentList || [])
    .map((equipment) => ({
      id: equipment.id,
      name: equipment.name?.trim() || "",
      brand: equipment.brand?.trim() || "",
      model: equipment.model?.trim() || "",
      serial_number: equipment.serial_number?.trim() || "",
      conditions: equipment.conditions?.trim() || "",
      defects: equipment.defects?.trim() || "",
      solution: equipment.solution?.trim() || "",
      technical_report: equipment.technical_report?.trim() || "",
      warranty_terms: equipment.warranty_terms?.trim() || "",
    }))
    .filter((equipment) =>
      Boolean(
        equipment.name ||
          equipment.brand ||
          equipment.model ||
          equipment.serial_number ||
          equipment.conditions ||
          equipment.defects ||
          equipment.solution ||
          equipment.technical_report ||
          equipment.warranty_terms
      )
    );

  const legacyEquipment: ServiceOrderEquipment[] =
    orderData.equipmentType || orderData.equipmentBrand || orderData.equipmentModel
      ? [
          {
            name: orderData.equipmentType,
            brand: orderData.equipmentBrand,
            model: orderData.equipmentModel,
            serial_number: "",
            conditions: "",
            defects: "",
            solution: "",
            technical_report: "",
            warranty_terms: "",
          },
        ]
      : [];

  const equipmentToRender = normalizedEquipment.length > 0 ? normalizedEquipment : legacyEquipment;

  if (equipmentToRender.length > 0) {
    drawSectionLabel("EQUIPAMENTOS");

    equipmentToRender.forEach((equipment, index) => {
      const equipmentTitle = equipment.name || `Equipamento ${String(index + 1).padStart(2, "0")}`;

      // Calculate total height needed for this equipment block
      const textAreaWidth = contentWidth - 8;
      const headerRowHeight = 12;
      
      const detailSections: Array<{ label: string; text: string; lines: string[] }> = [];
      const detailFields: Array<[string, string]> = [
        ["Condições", equipment.conditions || ""],
        ["Defeitos", equipment.defects || ""],
        ["Solução", equipment.solution || ""],
        ["Laudo técnico", equipment.technical_report || ""],
        ["Termos de garantia", equipment.warranty_terms || ""],
      ];
      
      detailFields.forEach(([label, text]) => {
        if (text) {
          const lines = doc.setFontSize(8).splitTextToSize(text, textAreaWidth);
          detailSections.push({ label, text, lines });
        }
      });

      let blockHeight = headerRowHeight;
      detailSections.forEach((section) => {
        blockHeight += 5 + section.lines.length * 3.5 + 2;
      });
      blockHeight += 2; // bottom padding

      // Page break check
      if (yPos + blockHeight > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
        drawSectionLabel("EQUIPAMENTOS (CONT.)");
      }

      // --- Header row: Name | Brand | Model | Serial ---
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPos, contentWidth, headerRowHeight);

      const col1W = contentWidth * 0.35;
      const col2W = contentWidth * 0.25;
      const col3W = contentWidth * 0.25;
      const col4W = contentWidth * 0.15;

      // Column headers
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text("Nome do equipamento", margin + 3, yPos + 4);
      doc.text("Marca", margin + col1W + 3, yPos + 4);
      doc.text("Modelo", margin + col1W + col2W + 3, yPos + 4);
      doc.text("Série", margin + col1W + col2W + col3W + 3, yPos + 4);

      // Column values
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(equipmentTitle, margin + 3, yPos + 9);
      doc.text(equipment.brand || "", margin + col1W + 3, yPos + 9);
      doc.text(equipment.model || "", margin + col1W + col2W + 3, yPos + 9);
      doc.text(equipment.serial_number || "", margin + col1W + col2W + col3W + 3, yPos + 9);

      // Vertical column lines
      doc.line(margin + col1W, yPos, margin + col1W, yPos + headerRowHeight);
      doc.line(margin + col1W + col2W, yPos, margin + col1W + col2W, yPos + headerRowHeight);
      doc.line(margin + col1W + col2W + col3W, yPos, margin + col1W + col2W + col3W, yPos + headerRowHeight);

      let sectionY = yPos + headerRowHeight;

      // --- Detail sections (Condições, Defeitos, Solução, Laudo, Garantia) ---
      detailSections.forEach((section) => {
        const sectionHeight = 5 + section.lines.length * 3.5 + 2;

        // Page break for individual section
        if (sectionY + sectionHeight > pageHeight - 20) {
          doc.addPage();
          sectionY = margin;
        }

        doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
        doc.rect(margin, sectionY, contentWidth, sectionHeight);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.text(section.label, margin + 3, sectionY + 4.5);

        doc.setFont("helvetica", "normal");
        doc.text(section.lines, margin + 3, sectionY + 4.5 + 4);

        sectionY += sectionHeight;
      });

      yPos = sectionY + 4;
    });

    yPos += 2;
  }

  // ===================== SOLUTION / DESCRIPTION =====================
  if (orderData.solution) {
    const solutionLines = doc.setFontSize(8).splitTextToSize(orderData.solution, contentWidth - 8);
    const solutionHeight = Math.max(solutionLines.length * 4 + 6, 12);

    drawSectionLabel("DESCRIÇÃO DO SERVIÇO");

    // If it doesn't fit, go to new page
    ensureSpace(solutionHeight + 4);

    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.rect(margin, yPos, contentWidth, solutionHeight, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(solutionLines, margin + 4, yPos + 5);

    yPos += solutionHeight + 4;
  }

  // ===================== SERVICES TABLE =====================
  drawSectionLabel("SERVIÇOS");

  const colWidths = [10, 72, 16, 28, 22, 32];
  
  const drawTableHeader = () => {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(margin, yPos, contentWidth, 7, "F");
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    
    let colX = margin;
    const headers = ["#", "DESCRIÇÃO", "QTD", "VR. UNIT", "DESC", "SUBTOTAL"];
    headers.forEach((h, i) => {
      const align = i >= 2 ? "right" : "left";
      const textX = align === "right" ? colX + colWidths[i] - 3 : colX + 3;
      doc.text(h, textX, yPos + 5, { align: align as "left" | "right" });
      colX += colWidths[i];
    });

    yPos += 7;
  };

  drawTableHeader();

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  let grandTotal = 0;
  let totalDiscount = 0;

  if (items.length > 0) {
    items.forEach((item, index) => {
      const discount = item.discount || 0;
      const discountAmount = item.discount_type === "percentage" 
        ? (item.quantity * item.unit_price * discount / 100) 
        : discount;
      const itemTotal = item.quantity * item.unit_price - discountAmount;
      grandTotal += itemTotal;
      totalDiscount += discountAmount;

      const rowHeight = 7;

      // Page break check for each row
      if (yPos + rowHeight > usableHeight) {
        doc.addPage();
        yPos = margin;
        drawTableHeader();
      }

      const isEven = index % 2 === 0;
      
      if (isEven) {
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, yPos, contentWidth, rowHeight, "F");
      }
      
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.setLineWidth(0.1);
      doc.line(margin, yPos + rowHeight, margin + contentWidth, yPos + rowHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      
      let colX = margin;
      doc.text((index + 1).toString(), colX + 3, yPos + 5);
      colX += colWidths[0];
      
      const descTruncated = item.description.length > 65 ? item.description.substring(0, 65) + "..." : item.description;
      doc.text(descTruncated, colX + 3, yPos + 5);
      colX += colWidths[1];
      
      doc.text(item.quantity.toFixed(2).replace(".", ","), colX + colWidths[2] - 3, yPos + 5, { align: "right" });
      colX += colWidths[2];
      
      doc.text(formatCurrency(item.unit_price), colX + colWidths[3] - 3, yPos + 5, { align: "right" });
      colX += colWidths[3];
      
      doc.text(discountAmount > 0 ? formatCurrency(discountAmount) : "-", colX + colWidths[4] - 3, yPos + 5, { align: "right" });
      colX += colWidths[4];
      
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(itemTotal), colX + colWidths[5] - 3, yPos + 5, { align: "right" });

      yPos += rowHeight;
    });
  } else {
    const rowHeight = 7;
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, yPos, contentWidth, rowHeight, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Nenhum item cadastrado", margin + 5, yPos + 5);
    yPos += rowHeight;
    grandTotal = service.value || 0;
  }

  // Total summary
  ensureSpace(25);
  yPos += 2;
  const summaryX = margin + contentWidth - 70;
  const summaryWidth = 70;
  
  if (totalDiscount > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Serviços:", summaryX, yPos + 4);
    doc.text(formatCurrency(grandTotal + totalDiscount), summaryX + summaryWidth, yPos + 4, { align: "right" });
    yPos += 5;
    
    doc.text("Desconto:", summaryX, yPos + 4);
    doc.setTextColor(220, 53, 69);
    doc.text(`- ${formatCurrency(totalDiscount)}`, summaryX + summaryWidth, yPos + 4, { align: "right" });
    yPos += 5;
  }

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(summaryX - 3, yPos, summaryWidth + 6, 12, "F");
  doc.setDrawColor(primary.r - 10, primary.g - 10, primary.b - 10);
  doc.setLineWidth(0.3);
  doc.rect(summaryX - 3, yPos, summaryWidth + 6, 12, "S");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", summaryX, yPos + 8);
  doc.text(formatCurrency(grandTotal), summaryX + summaryWidth, yPos + 8, { align: "right" });

  yPos += 18;

  // ===================== PAYMENT DATA =====================
  const hasPayment = orderData.paymentMethod || orderData.paymentDueDate || orderData.paymentNotes;
  if (hasPayment) {
    const paymentHeight = orderData.paymentNotes ? 14 : 8;
    ensureSpace(paymentHeight + 12);
    drawSectionLabel("DADOS DO PAGAMENTO");

    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.rect(margin, yPos, contentWidth, paymentHeight);

    doc.setFontSize(8);
    drawClientField("Vencimento: ", orderData.paymentDueDate || undefined, leftX, yPos + 5.5);
    drawClientField("Forma: ", orderData.paymentMethod || undefined, rightX, yPos + 5.5);
    
    if (orderData.paymentNotes) {
      drawClientField("Obs: ", orderData.paymentNotes.length > 70 ? orderData.paymentNotes.substring(0, 70) + "..." : orderData.paymentNotes, leftX, yPos + 11.5);
    }

    yPos += paymentHeight + 10;
  } else {
    yPos += 10;
  }

  // ===================== SIGNATURES =====================
  // Signatures always go at the bottom of the page
  const needsClause = organizationSignature && autoSignatureOS;
  const signatureBlockHeight = needsClause ? 45 : 30;
  ensureSpace(signatureBlockHeight);

  // Position signatures near the bottom of the current page (above footer)
  const signatureBottomY = pageHeight - FOOTER_RESERVED - (needsClause ? 18 : 8);
  yPos = signatureBottomY - 4; // line position

  const signatureWidth = 65;
  const leftSignX = margin + 20;
  const rightSignX = pageWidth - margin - signatureWidth - 20;

  // Draw organization signature image above the right signature line
  if (organizationSignature && autoSignatureOS) {
    try {
      const sigBase64 = await loadImageAsBase64(organizationSignature);
      if (sigBase64) {
        const maxH = 14;
        const maxW = 55;
        const img = new Image();
        img.src = sigBase64;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
        const ratio = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        const drawW = (img.width || maxW) * ratio;
        const drawH = (img.height || maxH) * ratio;
        const sigX = rightSignX + (signatureWidth - drawW) / 2;
        doc.addImage(sigBase64, "PNG", sigX, yPos - drawH - 2, drawW, drawH);
      }
    } catch {
      // Ignore signature load errors
    }
  }

  // Draw client signature image above the left signature line
  if (clientSignatureUrl) {
    try {
      const clientSigBase64 = await loadImageAsBase64(clientSignatureUrl);
      if (clientSigBase64) {
        const maxH = 14;
        const maxW = 55;
        const img = new Image();
        img.src = clientSigBase64;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
        const ratio = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        const drawW = (img.width || maxW) * ratio;
        const drawH = (img.height || maxH) * ratio;
        const sigX = leftSignX + (signatureWidth - drawW) / 2;
        doc.addImage(clientSigBase64, "PNG", sigX, yPos - drawH - 2, drawW, drawH);
      }
    } catch {
      // Ignore
    }
  }

  doc.setDrawColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(leftSignX, yPos, leftSignX + signatureWidth, yPos);
  doc.line(rightSignX, yPos, rightSignX + signatureWidth, yPos);
  doc.setLineDashPattern([], 0);

  yPos += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text("Assinatura do cliente", leftSignX + signatureWidth / 2, yPos, { align: "center" });
  doc.text(organizationName || "Assinatura da empresa", rightSignX + signatureWidth / 2, yPos, { align: "center" });

  // Disclaimer clause when signature is present
  if (organizationSignature && autoSignatureOS) {
    yPos += 6;
    doc.setFontSize(6);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    const clause = "A assinatura da empresa neste documento representa apenas a emissão formal da Ordem de Serviço e não confirma a execução do serviço, que depende da realização e aceite final do cliente.";
    const clauseLines = doc.splitTextToSize(clause, pageWidth - margin * 2 - 10);
    doc.text(clauseLines, pageWidth / 2, yPos, { align: "center" });
  }

  // ===================== FOOTER (all pages) =====================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 10;
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(organizationName, margin + 5, footerY);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin - 5, footerY, { align: "right" });
  }

  const fileName = `ordem-servico-${service.quote_number?.toString().padStart(4, "0") || "0001"}-${service.client?.name?.replace(/\s+/g, "_") || "cliente"}.pdf`;

  if (returnBlob) {
    return doc.output("blob");
  }

  doc.save(fileName);
}