import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Service } from "@/hooks/useServices";
import type { ServiceItem } from "@/hooks/useServiceItems";
import { trackFBCustomEvent } from "@/lib/fbPixel";
import { supabase } from "@/integrations/supabase/client";

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
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  trackFBCustomEvent("GeneratePDF", { os_number: service.quote_number });

  const FOOTER_RESERVED = 14;
  const usableHeight = pageHeight - FOOTER_RESERVED;

  // ── Premium color palette ──
  const primary = { r: 25, g: 95, b: 170 };
  const primaryDark = { r: 18, g: 70, b: 130 };
  const primaryLight = { r: 235, g: 244, b: 255 };
  const textDark = { r: 30, g: 34, b: 38 };
  const textMuted = { r: 100, g: 110, b: 120 };
  const borderLight = { r: 215, g: 220, b: 228 };
  const rowEven = { r: 248, g: 249, b: 252 };
  const totalBg = { r: 20, g: 80, b: 150 };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      doc.addPage();
      yPos = margin;
    }
  };

  const halfWidth = contentWidth / 2;
  const leftX = margin + 4;
  const rightX = margin + halfWidth + 4;

  // ── Helper: draw a field label + value ──
  const drawField = (label: string, value: string | null | undefined, x: number, y: number, maxW?: number) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.text(label, x, y);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(7.5);
    const val = value || "—";
    if (maxW) {
      const truncated = doc.getTextWidth(val) > maxW - labelW - 4
        ? val.substring(0, Math.floor((maxW - labelW - 8) / doc.getTextWidth("a"))) + "..."
        : val;
      doc.text(truncated, x + labelW + 2, y);
    } else {
      doc.text(val, x + labelW + 2, y);
    }
  };

  // ── Helper: compact section title bar ──
  const drawSectionTitle = (title: string, skipEnsureSpace = false) => {
    if (!skipEnsureSpace) ensureSpace(10);
    yPos += 2;
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(margin, yPos, 2.5, 7, "F");
    doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
    doc.rect(margin + 2.5, yPos, contentWidth - 2.5, 7, "F");
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.2);
    doc.rect(margin, yPos, contentWidth, 7, "S");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(title, margin + 6, yPos + 5);
    yPos += 8;
  };

  // ═══════════════════════════════════════════
  //  HEADER — Logo + Company Info (compact)
  // ═══════════════════════════════════════════
  const headerH = 28;
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(margin, yPos, contentWidth, 2, "F");
  yPos += 2;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, headerH, "FD");

  let logoEndX = margin + 5;
  if (organizationLogo) {
    const logoData = await loadImageAsBase64(organizationLogo);
    if (logoData) {
      try {
        doc.addImage(logoData, 'AUTO', margin + 4, yPos + 2, 24, 24);
        logoEndX = margin + 30;
      } catch { /* ignore */ }
    }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(organizationName, logoEndX, yPos + 8);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);

  const line1Parts: string[] = [];
  if (organizationCnpj) line1Parts.push(`CNPJ: ${organizationCnpj}`);
  if (organizationPhone) line1Parts.push(organizationPhone);
  if (organizationEmail) line1Parts.push(organizationEmail);
  if (line1Parts.length) doc.text(line1Parts.join("  ·  "), logoEndX, yPos + 13);

  const line2Parts: string[] = [];
  if (organizationAddress) line2Parts.push(organizationAddress);
  if (organizationCity) line2Parts.push(organizationCity);
  if (organizationState) line2Parts.push(organizationState);
  if (organizationZipCode) line2Parts.push(`CEP ${organizationZipCode}`);
  if (line2Parts.length) {
    const addr = line2Parts.join(" – ");
    const maxAddrW = pageWidth - margin - logoEndX - 6;
    const truncAddr = doc.getTextWidth(addr) > maxAddrW ? addr.substring(0, 85) + "..." : addr;
    doc.text(truncAddr, logoEndX, yPos + 18);
  }

  if (organizationWebsite) {
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(organizationWebsite, logoEndX, yPos + 23);
  }

  yPos += headerH + 3;

  // ═══════════════════════════════════════════
  //  DOCUMENT TITLE
  // ═══════════════════════════════════════════
  const titleH = 13;
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.roundedRect(margin, yPos, contentWidth, titleH, 1.5, 1.5, "F");
  doc.setFillColor(primaryDark.r, primaryDark.g, primaryDark.b);
  doc.rect(margin, yPos + titleH - 1.5, contentWidth, 1.5, "F");

  const osNumber = service.quote_number?.toString().padStart(4, "0") || "0001";
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`ORDEM DE SERVIÇO  Nº ${osNumber}`, margin + 7, yPos + 9);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "dd/MM/yyyy"), pageWidth - margin - 7, yPos + 9, { align: "right" });

  yPos += titleH + 4;

  // ═══════════════════════════════════════════
  //  EXECUTION PERIOD (compact)
  // ═══════════════════════════════════════════
  const hasEntry = orderData.entryDate && orderData.entryTime;
  const hasExit = orderData.exitDate && orderData.exitTime;

  if (hasEntry || hasExit) {
    drawSectionTitle("PERÍODO DE EXECUÇÃO");
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.2);
    doc.rect(margin, yPos, contentWidth, 8, "S");
    doc.setFontSize(7.5);
    if (hasEntry) drawField("Entrada:", `${orderData.entryDate} às ${orderData.entryTime}`, leftX, yPos + 5.5);
    if (hasExit) drawField("Saída:", `${orderData.exitDate} às ${orderData.exitTime}`, rightX, yPos + 5.5);
    yPos += 10;
  }

  // ═══════════════════════════════════════════
  //  CLIENT DATA (compact)
  // ═══════════════════════════════════════════
  drawSectionTitle("DADOS DO CLIENTE");

  const hasServiceAddr = service.service_street || service.service_city;
  const clientAddr = hasServiceAddr
    ? [service.service_street, service.service_number, service.service_complement, service.service_neighborhood].filter(Boolean).join(", ")
    : (service.client?.address || [service.client?.street, service.client?.number, service.client?.complement, service.client?.neighborhood].filter(Boolean).join(", "));
  const clientCity = hasServiceAddr ? (service.service_city || "") : (service.client?.city || "");
  const clientState = hasServiceAddr ? (service.service_state || "") : (service.client?.state || "");
  const clientZip = hasServiceAddr ? (service.service_zip_code || "") : (service.client?.zip_code || "");

  doc.setFontSize(7.5);
  const addrLabelW = doc.getTextWidth("Endereço: ");
  const addrMaxW = halfWidth - 10;
  const addrLines = doc.splitTextToSize(clientAddr || "", addrMaxW - addrLabelW);
  const addrRowH = Math.max(7, 3.5 + addrLines.length * 3.2);

  const rows = [
    { lLabel: "Cliente:", lVal: service.client?.name || "", rLabel: "CNPJ/CPF:", rVal: service.client?.document || "", h: 7 },
    { lLabel: "Endereço:", lVal: clientAddr || "", rLabel: "CEP:", rVal: clientZip, h: addrRowH, multiline: true },
    { lLabel: "Cidade:", lVal: clientCity, rLabel: "Estado:", rVal: clientState, h: 7 },
    { lLabel: "Telefone:", lVal: service.client?.phone || "", rLabel: "E-mail:", rVal: service.client?.email || "", h: 7 },
  ];

  const boxH = rows.reduce((s, r) => s + r.h, 0);
  ensureSpace(boxH + 3);

  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.setLineWidth(0.2);
  doc.rect(margin, yPos, contentWidth, boxH, "S");
  doc.line(margin + halfWidth, yPos, margin + halfWidth, yPos + boxH);

  let cellY = yPos;
  rows.forEach((row, i) => {
    if (i > 0) doc.line(margin, cellY, margin + contentWidth, cellY);
    const ty = cellY + 5;
    if (row.multiline) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(row.lLabel, leftX, ty);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(addrLines, leftX + addrLabelW + 2, ty);
    } else {
      drawField(row.lLabel, row.lVal, leftX, ty);
    }
    drawField(row.rLabel, row.rVal, rightX, ty);
    cellY += row.h;
  });

  yPos += boxH + 3;

  // ═══════════════════════════════════════════
  //  EQUIPMENT (compact)
  // ═══════════════════════════════════════════
  const normalized = (equipmentList || [])
    .map(e => ({
      name: e.name?.trim() || "", brand: e.brand?.trim() || "", model: e.model?.trim() || "",
      serial_number: e.serial_number?.trim() || "", conditions: e.conditions?.trim() || "",
      defects: e.defects?.trim() || "", solution: e.solution?.trim() || "",
      technical_report: e.technical_report?.trim() || "", warranty_terms: e.warranty_terms?.trim() || "",
    }))
    .filter(e => e.name || e.brand || e.model || e.serial_number || e.conditions || e.defects || e.solution || e.technical_report || e.warranty_terms);

  const legacy: ServiceOrderEquipment[] =
    orderData.equipmentType || orderData.equipmentBrand || orderData.equipmentModel
      ? [{ name: orderData.equipmentType, brand: orderData.equipmentBrand, model: orderData.equipmentModel }]
      : [];

  const equipRender = normalized.length > 0 ? normalized : legacy;

  if (equipRender.length > 0) {
    drawSectionTitle("EQUIPAMENTOS");

    equipRender.forEach((eq, idx) => {
      const eqTitle = eq.name || `Equipamento ${String(idx + 1).padStart(2, "0")}`;
      const textAreaW = contentWidth - 8;
      const headerRowH = 11;

      const details: Array<{ label: string; lines: string[] }> = [];
      const fields: [string, string][] = [
        ["Condições", eq.conditions || ""], ["Defeitos", eq.defects || ""],
        ["Solução", eq.solution || ""], ["Laudo técnico", eq.technical_report || ""],
        ["Termos de garantia", eq.warranty_terms || ""],
      ];
      fields.forEach(([label, text]) => {
        if (text) details.push({ label, lines: doc.setFontSize(7.5).splitTextToSize(text, textAreaW) });
      });

      let blockH = headerRowH;
      details.forEach(s => { blockH += 4 + s.lines.length * 3.2 + 1; });
      blockH += 1;

      if (yPos + blockH > usableHeight) {
        doc.addPage(); yPos = margin;
        drawSectionTitle("EQUIPAMENTOS (CONT.)");
      }

      const col1 = contentWidth * 0.35, col2 = contentWidth * 0.25, col3 = contentWidth * 0.25, col4 = contentWidth * 0.15;
      doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.setLineWidth(0.2);
      doc.rect(margin, yPos, contentWidth, headerRowH, "FD");

      doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text("EQUIPAMENTO", margin + 3, yPos + 3.5);
      doc.text("MARCA", margin + col1 + 3, yPos + 3.5);
      doc.text("MODELO", margin + col1 + col2 + 3, yPos + 3.5);
      doc.text("SÉRIE", margin + col1 + col2 + col3 + 3, yPos + 3.5);

      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(eqTitle, margin + 3, yPos + 8.5);
      doc.text(eq.brand || "—", margin + col1 + 3, yPos + 8.5);
      doc.text(eq.model || "—", margin + col1 + col2 + 3, yPos + 8.5);
      doc.text(eq.serial_number || "—", margin + col1 + col2 + col3 + 3, yPos + 8.5);

      [col1, col1 + col2, col1 + col2 + col3].forEach(x => doc.line(margin + x, yPos, margin + x, yPos + headerRowH));

      let sY = yPos + headerRowH;

      details.forEach(section => {
        const sH = 4 + section.lines.length * 3.2 + 1;
        if (sY + sH > usableHeight) { doc.addPage(); sY = margin; }
        doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
        doc.rect(margin, sY, contentWidth, sH, "S");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(primary.r, primary.g, primary.b);
        doc.text(section.label, margin + 4, sY + 4);
        doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b); doc.setFontSize(7.5);
        doc.text(section.lines, margin + 4, sY + 7.5);
        sY += sH;
      });

      yPos = sY + 2;
    });
    yPos += 1;
  }

  // ═══════════════════════════════════════════
  //  SOLUTION / DESCRIPTION (compact)
  // ═══════════════════════════════════════════
  if (orderData.solution) {
    const solLines = doc.setFontSize(7.5).splitTextToSize(orderData.solution, contentWidth - 10);
    const solH = Math.max(solLines.length * 3.5 + 6, 12);
    drawSectionTitle("DESCRIÇÃO DO SERVIÇO");
    ensureSpace(solH + 2);
    doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.rect(margin, yPos, contentWidth, solH, "FD");
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(solLines, margin + 5, yPos + 5);
    yPos += solH + 3;
  }

  // ═══════════════════════════════════════════
  //  SERVICES TABLE (compact)
  // ═══════════════════════════════════════════
  drawSectionTitle("SERVIÇOS E PEÇAS");

  const colW = [10, 70, 16, 28, 22, 34];

  const drawTableHeader = () => {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.roundedRect(margin, yPos, contentWidth, 7, 0.5, 0.5, "F");
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    const headers = ["#", "DESCRIÇÃO", "QTD", "VR. UNIT.", "DESC.", "SUBTOTAL"];
    let cx = margin;
    headers.forEach((h, i) => {
      const align = i >= 2 ? "right" : "left";
      const tx = align === "right" ? cx + colW[i] - 3 : cx + 3;
      doc.text(h, tx, yPos + 5, { align: align as any });
      cx += colW[i];
    });
    yPos += 7;
  };

  drawTableHeader();

  let grandTotal = 0;
  let totalDiscount = 0;

  if (items.length > 0) {
    items.forEach((item, index) => {
      const discount = item.discount || 0;
      const discAmt = item.discount_type === "percentage"
        ? (item.quantity * item.unit_price * discount / 100)
        : discount;
      const itemTotal = item.quantity * item.unit_price - discAmt;
      grandTotal += itemTotal;
      totalDiscount += discAmt;

      const descMaxW = colW[1] - 6;
      doc.setFontSize(7);
      const displayName = item.name || item.description;
      const descLines = doc.splitTextToSize(displayName, descMaxW);

      const hasDetail = item.name && item.description && item.name !== item.description;
      const detailLines = hasDetail ? doc.setFontSize(6).splitTextToSize(item.description, descMaxW) : [];

      const rowH = Math.max(7, (descLines.length + detailLines.length) * 3.2 + 3);

      if (yPos + rowH > usableHeight) {
        doc.addPage(); yPos = margin;
        drawTableHeader();
      }

      if (index % 2 === 0) {
        doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
        doc.rect(margin, yPos, contentWidth, rowH, "F");
      }
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.setLineWidth(0.1);
      doc.line(margin, yPos + rowH, margin + contentWidth, yPos + rowH);

      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(textDark.r, textDark.g, textDark.b);
      const midY = yPos + (rowH / 2) + 1;
      let cx = margin;

      doc.text((index + 1).toString(), cx + 3, midY);
      cx += colW[0];

      const descStartY = yPos + 3.5;
      doc.setFont("helvetica", "bold");
      doc.text(descLines, cx + 3, descStartY);

      if (hasDetail) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(detailLines, cx + 3, descStartY + (descLines.length * 3.2));
      }

      cx += colW[1];

      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(item.quantity.toFixed(2).replace(".", ","), cx + colW[2] - 3, midY, { align: "right" });
      cx += colW[2];
      doc.text(formatCurrency(item.unit_price), cx + colW[3] - 3, midY, { align: "right" });
      cx += colW[3];
      doc.text(discAmt > 0 ? formatCurrency(discAmt) : "—", cx + colW[4] - 3, midY, { align: "right" });
      cx += colW[4];
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(itemTotal), cx + colW[5] - 3, midY, { align: "right" });

      yPos += rowH;
    });
  } else {
    doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
    doc.rect(margin, yPos, contentWidth, 7, "F");
    doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Nenhum item cadastrado", margin + 5, yPos + 5);
    yPos += 7;
    grandTotal = service.value || 0;
  }

  // ═══════════════════════════════════════════
  //  BLOCO FINAL — Total + Payment + Notes + Signatures
  //  NEVER SPLIT across pages
  // ═══════════════════════════════════════════
  const hasPayment = orderData.paymentMethod || orderData.paymentDueDate || orderData.paymentNotes;
  const notes = service.notes || "";
  const needsClause = organizationSignature && autoSignatureOS;

  // Pre-calculate total height of BLOCO FINAL
  let blocoFinalH = 2; // initial gap

  // Total summary
  if (totalDiscount > 0) blocoFinalH += 14; // subtotal + discount + separator
  blocoFinalH += 12 + 4; // total box + gap

  // Payment
  if (hasPayment) {
    const payH = orderData.paymentNotes ? 16 : 10;
    blocoFinalH += 10 + payH + 3; // section title + content + gap
  }

  // Notes
  if (notes) {
    doc.setFontSize(7.5);
    const noteLines = doc.splitTextToSize(notes, contentWidth - 10);
    const noteH = Math.max(noteLines.length * 3.5 + 6, 12);
    blocoFinalH += 10 + noteH + 3; // section title + content + gap
  }

  // Signatures
  const sigBlockH = needsClause ? 40 : 30;
  blocoFinalH += 4 + sigBlockH;

  // ── ENSURE THE ENTIRE BLOCK FITS ──
  ensureSpace(blocoFinalH);

  // ── Total summary block ──
  yPos += 2;
  const sumW = 78;
  const sumX = margin + contentWidth - sumW;

  if (totalDiscount > 0) {
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Subtotal:", sumX, yPos + 3.5);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(formatCurrency(grandTotal + totalDiscount), sumX + sumW, yPos + 3.5, { align: "right" });
    yPos += 5;
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Desconto:", sumX, yPos + 3.5);
    doc.setTextColor(200, 40, 40);
    doc.text(`– ${formatCurrency(totalDiscount)}`, sumX + sumW, yPos + 3.5, { align: "right" });
    yPos += 5;
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.line(sumX, yPos, sumX + sumW, yPos);
    yPos += 2;
  }

  // Total box
  const totalBoxH = 12;
  doc.setFillColor(totalBg.r, totalBg.g, totalBg.b);
  doc.roundedRect(sumX - 2, yPos, sumW + 4, totalBoxH, 2, 2, "F");
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", sumX + 4, yPos + 8.5);
  doc.text(formatCurrency(grandTotal), sumX + sumW - 2, yPos + 8.5, { align: "right" });
  yPos += totalBoxH + 4;

  // ── Payment data ──
  if (hasPayment) {
    drawSectionTitle("DADOS DO PAGAMENTO", true);
    const payH = orderData.paymentNotes ? 16 : 10;
    doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, payH, "FD");
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(margin, yPos, 2.5, payH, "F");
    doc.setFontSize(7.5);
    drawField("Vencimento:", orderData.paymentDueDate || undefined, leftX + 2, yPos + 6);
    drawField("Forma de pagamento:", orderData.paymentMethod || undefined, rightX, yPos + 6);
    if (orderData.paymentNotes) {
      drawField("Obs:", orderData.paymentNotes.length > 80 ? orderData.paymentNotes.substring(0, 80) + "..." : orderData.paymentNotes, leftX + 2, yPos + 12);
    }
    yPos += payH + 3;
  }

  // ── Notes ──
  if (notes) {
    doc.setFontSize(7.5);
    const noteLines = doc.splitTextToSize(notes, contentWidth - 10);
    const noteH = Math.max(noteLines.length * 3.5 + 6, 12);
    drawSectionTitle("OBSERVAÇÕES", true);
    doc.setFillColor(255, 252, 240);
    doc.setDrawColor(230, 200, 100);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, noteH, "FD");
    doc.setFillColor(230, 180, 50);
    doc.rect(margin, yPos, 2.5, noteH, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(noteLines, margin + 6, yPos + 5);
    yPos += noteH + 3;
  }

  // ── Signatures ──
  yPos += 4;

  const signatureWidth = 66;
  const leftSignX = margin + 16;
  const rightSignX = pageWidth - margin - signatureWidth - 16;

  doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text("ASSINATURA DO CLIENTE", leftSignX + signatureWidth / 2, yPos, { align: "center" });
  doc.text("ASSINATURA DA EMPRESA", rightSignX + signatureWidth / 2, yPos, { align: "center" });
  yPos += 2;

  const sigImgY = yPos;
  const sigLineY = yPos + 16;

  if (clientSignatureUrl) {
    try {
      const cSigB64 = await loadImageAsBase64(clientSignatureUrl);
      if (cSigB64) {
        const maxH = 14, maxW = 56;
        const img = new Image();
        img.src = cSigB64;
        await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
        const ratio = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        const dw = (img.width || maxW) * ratio, dh = (img.height || maxH) * ratio;
        doc.addImage(cSigB64, "PNG", leftSignX + (signatureWidth - dw) / 2, sigImgY + (14 - dh) / 2, dw, dh);
      }
    } catch { /* ignore */ }
  }

  if (organizationSignature && autoSignatureOS) {
    try {
      const oSigB64 = await loadImageAsBase64(organizationSignature);
      if (oSigB64) {
        const maxH = 14, maxW = 56;
        const img = new Image();
        img.src = oSigB64;
        await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
        const ratio = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        const dw = (img.width || maxW) * ratio, dh = (img.height || maxH) * ratio;
        doc.addImage(oSigB64, "PNG", rightSignX + (signatureWidth - dw) / 2, sigImgY + (14 - dh) / 2, dw, dh);
      }
    } catch { /* ignore */ }
  }

  yPos = sigLineY;
  doc.setDrawColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.line(leftSignX, yPos, leftSignX + signatureWidth, yPos);
  doc.line(rightSignX, yPos, rightSignX + signatureWidth, yPos);
  doc.setLineDashPattern([], 0);

  yPos += 3.5;
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text(service.client?.name || "Cliente", leftSignX + signatureWidth / 2, yPos, { align: "center" });
  doc.text(organizationName, rightSignX + signatureWidth / 2, yPos, { align: "center" });

  if (needsClause) {
    yPos += 6;
    doc.setFontSize(5.5); doc.setFont("helvetica", "italic"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    const clause = "A assinatura da empresa neste documento representa apenas a emissão formal da Ordem de Serviço e não confirma a execução do serviço, que depende da realização e aceite final do cliente.";
    const clauseLines = doc.splitTextToSize(clause, contentWidth - 20);
    doc.text(clauseLines, pageWidth / 2, yPos, { align: "center" });
  }

  // ═══════════════════════════════════════════
  //  FOOTER (all pages)
  // ═══════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 6;

    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("Documento gerado pela Tecvo · tecvo.com.br", margin, footerY);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  }

  // ── Output ──
  const fileName = `OS-${osNumber}-${(service.client?.name || "cliente").replace(/\s+/g, "_")}.pdf`;

  try {
    const blob = doc.output("blob");
    const orgId = service.organization_id;
    if (orgId) {
      const storagePath = `os-pdfs/${orgId}/${service.id}.pdf`;
      await supabase.storage
        .from("whatsapp-media")
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });
      await supabase
        .from("services")
        .update({ pdf_status: "ready", pdf_generated_at: new Date().toISOString() })
        .eq("id", service.id);
      console.log(`[PDF] Official PDF uploaded: ${storagePath} (${blob.size} bytes)`);
    }
  } catch (e) {
    console.warn("[PDF] Failed to upload PDF to storage:", e);
  }

  if (returnBlob) {
    return doc.output("blob");
  }

  doc.save(fileName);
}
