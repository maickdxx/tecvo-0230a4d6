import jsPDF from "jspdf";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Service } from "@/hooks/useServices";
import type { ServiceItem } from "@/hooks/useServiceItems";
import { SERVICE_TYPE_LABELS } from "@/hooks/useServices";

interface QuotePDFData {
  service: Service;
  items: ServiceItem[];
  organizationName: string;
  organizationCnpj?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationLogo?: string;
  organizationWebsite?: string;
  organizationZipCode?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationSignature?: string;
  autoSignatureOS?: boolean;
  isFreePlan?: boolean;
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

export async function generateQuotePDF({
  service,
  items,
  organizationName,
  organizationCnpj,
  organizationPhone,
  organizationEmail,
  organizationAddress,
  organizationLogo,
  organizationWebsite,
  organizationZipCode,
  organizationCity,
  organizationState,
  organizationSignature,
  autoSignatureOS = false,
  isFreePlan = false,
}: QuotePDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Premium color palette
  const primary = { r: 25, g: 95, b: 170 };
  const primaryLight = { r: 235, g: 244, b: 255 };
  const textDark = { r: 33, g: 37, b: 41 };
  const textMuted = { r: 108, g: 117, b: 125 };
  const borderLight = { r: 222, g: 226, b: 230 };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (date: string | null) =>
    date ? format(new Date(date), "dd/MM/yyyy", { locale: ptBR }) : "";

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
        doc.addImage(logoData, margin + 4, yPos + 3, 24, 24);
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
  doc.rect(margin, yPos, contentWidth, 12, "F");
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(
    `ORÇAMENTO Nº ${service.quote_number?.toString().padStart(4, "0") || "0001"}`,
    margin + 5,
    yPos + 8
  );
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "dd/MM/yyyy"), pageWidth - margin - 5, yPos + 8, { align: "right" });

  yPos += 16;

  // ===================== CLIENT DATA =====================
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("DADOS DO CLIENTE", margin, yPos);
  yPos += 3;

  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, 20);

  doc.setFontSize(8);
  doc.setTextColor(textDark.r, textDark.g, textDark.b);

  const drawClientField = (label: string, value: string | null | undefined, x: number, y: number) => {
    if (!value) return;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(value, x + doc.getTextWidth(label) + 2, y);
  };

  const halfWidth = contentWidth / 2;
  const leftX = margin + 4;
  const rightX = margin + halfWidth + 4;

  drawClientField("Cliente: ", service.client?.name, leftX, yPos + 5);
  drawClientField("Telefone: ", service.client?.phone, rightX, yPos + 5);

  const clientAddress = service.client?.address || 
    [service.client?.street, service.client?.number, service.client?.neighborhood].filter(Boolean).join(", ");
  if (clientAddress) {
    drawClientField("Endereço: ", clientAddress.length > 55 ? clientAddress.substring(0, 55) + "..." : clientAddress, leftX, yPos + 11);
  }
  
  if (service.client?.email) {
    drawClientField("E-mail: ", service.client.email, rightX, yPos + 11);
  }

  const cityState = [service.client?.city, service.client?.state].filter(Boolean).join(" - ");
  if (cityState) {
    drawClientField("Cidade: ", cityState, leftX, yPos + 17);
  }
  if (service.client?.zip_code) {
    drawClientField("CEP: ", service.client.zip_code, rightX, yPos + 17);
  }

  yPos += 25;

  // ===================== SERVICE INFO =====================
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("INFORMAÇÕES DO SERVIÇO", margin, yPos);
  yPos += 3;

  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.rect(margin, yPos, contentWidth, 10);
  
  drawClientField("Tipo: ", SERVICE_TYPE_LABELS[service.service_type], leftX, yPos + 5);
  if (service.scheduled_date) {
    drawClientField("Data Prevista: ", formatDate(service.scheduled_date), rightX, yPos + 5);
  }

  yPos += 14;

  // ===================== ITEMS TABLE =====================
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("ITENS DO ORÇAMENTO", margin, yPos);
  yPos += 3;

  const colWidths = [10, 72, 16, 28, 22, 32];
  
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

      const displayName = item.name || item.description;
      const hasDetail = item.name && item.description && item.name !== item.description;
      const descMaxW = colWidths[1] - 6;
      
      doc.setFontSize(7.5);
      const descLines = doc.splitTextToSize(displayName, descMaxW);
      const detailLines = hasDetail ? doc.setFontSize(6.5).splitTextToSize(item.description, descMaxW) : [];
      
      const rowHeight = Math.max(8, (descLines.length + detailLines.length) * 3.5 + 4);
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
      
      colX = margin;
      doc.text((index + 1).toString(), colX + 3, yPos + 5);
      colX += colWidths[0];
      
      const descStartY = yPos + 4;
      doc.setFont("helvetica", "bold");
      doc.text(descLines, colX + 3, descStartY);
      
      if (hasDetail) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.5);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(detailLines, colX + 3, descStartY + (descLines.length * 3.5));
      }
      
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

  // Total row
  yPos += 2;
  
  const summaryX = margin + contentWidth - 70;
  const summaryWidth = 70;
  
  if (totalDiscount > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Subtotal:", summaryX, yPos + 4);
    doc.text(formatCurrency(grandTotal + totalDiscount), summaryX + summaryWidth, yPos + 4, { align: "right" });
    yPos += 5;
    
    doc.text("Desconto:", summaryX, yPos + 4);
    doc.setTextColor(220, 53, 69);
    doc.text(`- ${formatCurrency(totalDiscount)}`, summaryX + summaryWidth, yPos + 4, { align: "right" });
    yPos += 5;
  }

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(summaryX - 3, yPos, summaryWidth + 6, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", summaryX, yPos + 7);
  doc.text(formatCurrency(grandTotal), summaryX + summaryWidth, yPos + 7, { align: "right" });

  yPos += 16;

  // ===================== PAYMENT CONDITIONS =====================
  if (service.payment_conditions) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text("CONDIÇÕES DE PAGAMENTO", margin, yPos);
    yPos += 3;

    const paymentLines = doc.splitTextToSize(service.payment_conditions, contentWidth - 8);
    const paymentHeight = Math.max(paymentLines.length * 4 + 6, 12);
    
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.rect(margin, yPos, contentWidth, paymentHeight, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(paymentLines, margin + 4, yPos + 5);

    yPos += paymentHeight + 5;
  }

  // ===================== VALIDITY =====================
  const validityDays = service.quote_validity_days || 30;
  const validUntil = addDays(new Date(), validityDays);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text(
    `Este orçamento é válido por ${validityDays} dias (até ${format(validUntil, "dd/MM/yyyy")})`,
    margin,
    yPos
  );

  yPos += 18;

  // ===================== SIGNATURES =====================
  // Ensure signatures are not too close to the bottom
  const needsClause = organizationSignature && autoSignatureOS;
  const minSignatureSpace = needsClause ? 55 : 40;
  const minYForSignatures = pageHeight - minSignatureSpace;
  if (yPos > minYForSignatures) {
    yPos = minYForSignatures;
  }

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

  doc.setDrawColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setLineWidth(0.3);
  doc.line(leftSignX, yPos, leftSignX + signatureWidth, yPos);
  doc.line(rightSignX, yPos, rightSignX + signatureWidth, yPos);

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
    const clause = "A assinatura da empresa neste documento representa apenas a emissão formal do Orçamento e não confirma a execução do serviço, que depende da aprovação e aceite final do cliente.";
    const clauseLines = doc.splitTextToSize(clause, pageWidth - margin * 2 - 10);
    doc.text(clauseLines, pageWidth / 2, yPos, { align: "center" });
  }

  // ===================== FOOTER =====================
  const footerY = pageHeight - 10;
  doc.setDrawColor(primary.r, primary.g, primary.b);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text(
    "Orçamento gerado pelo Tecvo",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  const fileName = `orcamento-${service.quote_number?.toString().padStart(4, "0") || "0001"}-${service.client?.name?.replace(/\s+/g, "_") || "cliente"}.pdf`;
  doc.save(fileName);
}
