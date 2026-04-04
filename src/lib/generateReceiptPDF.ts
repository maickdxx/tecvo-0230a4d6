import jsPDF from "jspdf";

export interface ReceiptPDFData {
  organizationName: string;
  organizationCnpj?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationLogo?: string;
  clientName: string;
  clientDocument?: string;
  quoteNumber?: string | number | null;
  serviceDescription?: string;
  serviceValue: number;
  payments: { method: string; amount: number }[];
  completedDate?: string;
  scheduledDate?: string;
  technicianName?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const C = {
  primary: [23, 37, 84] as [number, number, number],
  primaryMid: [30, 64, 175] as [number, number, number],
  primaryLight: [239, 246, 255] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  lightBg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 101, 52] as [number, number, number],
  successBg: [220, 252, 231] as [number, number, number],
};

function rRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill?: [number, number, number], stroke?: [number, number, number]) {
  if (fill) doc.setFillColor(...fill);
  if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(0.3); }
  doc.roundedRect(x, y, w, h, r, r, fill && stroke ? "FD" : fill ? "F" : "S");
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.primaryMid);
  doc.text(text.toUpperCase(), x, y);
}

function fieldLabel(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(label, x, y);
}

function fieldValue(doc: jsPDF, value: string, x: number, y: number, options?: any) {
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text(value, x, y, options);
}

export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = pw - m * 2;
  let y = 0;

  // ── TOP BAR ──
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pw, 5, "F");
  doc.setFillColor(...C.primaryMid);
  doc.rect(0, 5, pw, 1.5, "F");

  y = 16;

  // ── HEADER: Logo + Company Info ──
  let logoEndX = m;
  if (data.organizationLogo) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = data.organizationLogo!;
      });
      const maxH = 15;
      const ratio = img.width / img.height;
      const imgW = Math.min(maxH * ratio, 40);
      doc.addImage(img, "PNG", m, y - 4, imgW, maxH);
      logoEndX = m + imgW + 5;
    } catch { /* skip */ }
  }

  // Company name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.primary);
  doc.text(data.organizationName, logoEndX, y + 1);

  // Company details below name
  const orgLines = [
    data.organizationCnpj && `CNPJ: ${data.organizationCnpj}`,
    data.organizationPhone && `Tel: ${data.organizationPhone}`,
    data.organizationEmail,
    data.organizationAddress,
  ].filter(Boolean) as string[];

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  let oy = y + 6;
  orgLines.forEach(l => { doc.text(l, logoEndX, oy); oy += 3.2; });

  y = Math.max(y + 16, oy + 2);

  // ── DIVIDER + TITLE ──
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);
  y += 6;

  // Title centered
  rRect(doc, (pw - 96) / 2, y, 96, 11, 2.5, C.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("RECIBO DE PAGAMENTO", pw / 2, y + 7.5, { align: "center" });
  y += 18;

  // ── OS + DATES ROW ──
  const completedStr = data.completedDate
    ? new Date(data.completedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const scheduledStr = data.scheduledDate
    ? new Date(data.scheduledDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  rRect(doc, m, y, cw, 14, 2, C.lightBg, C.border);

  const col3w = cw / 3;
  // OS Number
  if (data.quoteNumber) {
    fieldLabel(doc, "N\u00ba da OS", m + 5, y + 5);
    fieldValue(doc, `#${String(data.quoteNumber).padStart(4, "0")}`, m + 5, y + 10.5);
  }
  // Execution date
  if (scheduledStr) {
    fieldLabel(doc, "Data de Execu\u00e7\u00e3o", m + col3w + 5, y + 5);
    fieldValue(doc, scheduledStr, m + col3w + 5, y + 10.5);
  }
  // Issue date
  fieldLabel(doc, "Data de Emiss\u00e3o", m + col3w * 2 + 5, y + 5);
  fieldValue(doc, completedStr, m + col3w * 2 + 5, y + 10.5);

  y += 20;

  // ── CLIENTE SECTION ──
  sectionTitle(doc, "Dados do Cliente", m, y);
  y += 3;
  rRect(doc, m, y, cw, data.clientDocument ? 16 : 12, 2, C.primaryLight, C.border);

  fieldLabel(doc, "Nome", m + 5, y + 5);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text(data.clientName, m + 5, y + 10.5);

  if (data.clientDocument) {
    fieldLabel(doc, "CPF/CNPJ", m + cw / 2 + 5, y + 5);
    fieldValue(doc, data.clientDocument, m + cw / 2 + 5, y + 10.5);
  }

  y += (data.clientDocument ? 16 : 12) + 6;

  // ── SERVICO SECTION ──
  if (data.serviceDescription) {
    sectionTitle(doc, "Descri\u00e7\u00e3o do Servi\u00e7o", m, y);
    y += 3;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
    const descLines = doc.splitTextToSize(data.serviceDescription, cw - 10);
    const descH = Math.max(descLines.length * 4.2 + 6, 12);
    rRect(doc, m, y, cw, descH, 2, C.white, C.border);
    doc.text(descLines, m + 5, y + 5.5);
    y += descH + 6;
  }

  // ── TECNICO ──
  if (data.technicianName) {
    sectionTitle(doc, "T\u00e9cnico Respons\u00e1vel", m, y);
    y += 3;
    rRect(doc, m, y, cw, 10, 2, C.lightBg, C.border);
    fieldValue(doc, data.technicianName, m + 5, y + 7);
    y += 16;
  } else {
    y += 2;
  }

  // ── PAGAMENTO TABLE ──
  sectionTitle(doc, "Pagamento", m, y);
  y += 4;

  // Table header
  rRect(doc, m, y, cw, 8, 2, C.primary);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("FORMA DE PAGAMENTO", m + 5, y + 5.5);
  doc.text("VALOR", pw - m - 5, y + 5.5, { align: "right" });
  y += 9;

  // Table rows
  const payments = data.payments.length > 0 ? data.payments : [{ method: "N\u00e3o informado", amount: data.serviceValue }];
  payments.forEach((p, i) => {
    const bg = i % 2 === 0 ? C.white : C.lightBg;
    doc.setFillColor(...bg);
    doc.rect(m, y, cw, 7, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
    doc.text(p.method, m + 5, y + 5);

    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(p.amount), pw - m - 5, y + 5, { align: "right" });
    y += 7;
  });

  // Bottom border on last row
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(m, y, pw - m, y);
  y += 2;

  // Total
  rRect(doc, m, y, cw, 12, 2, C.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("VALOR TOTAL", m + 5, y + 8);
  doc.setFontSize(13);
  doc.text(formatCurrency(data.serviceValue), pw - m - 5, y + 8, { align: "right" });
  y += 18;

  // ── SUCCESS CONFIRMATION ──
  const sW = 80;
  const sX = (pw - sW) / 2;
  rRect(doc, sX, y, sW, 10, 3, C.successBg);
  doc.setDrawColor(...C.success);
  doc.setLineWidth(0.4);
  doc.roundedRect(sX, y, sW, 10, 3, 3, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.success);
  doc.text("Pagamento recebido com sucesso", pw / 2, y + 6.8, { align: "center" });
  y += 20;

  // ── SIGNATURES ──
  const sigW = 65;
  const sigGap = 20;
  const leftX = (pw - sigW * 2 - sigGap) / 2;
  const rightX = leftX + sigW + sigGap;
  const sigY = y + 12;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.4);
  doc.line(leftX, sigY, leftX + sigW, sigY);
  doc.line(rightX, sigY, rightX + sigW, sigY);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text(data.technicianName || data.organizationName, leftX + sigW / 2, sigY + 5, { align: "center" });
  doc.text(data.clientName, rightX + sigW / 2, sigY + 5, { align: "center" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text("T\u00e9cnico / Prestador", leftX + sigW / 2, sigY + 9, { align: "center" });
  doc.text("Cliente", rightX + sigW / 2, sigY + 9, { align: "center" });

  // ── FOOTER ──
  doc.setFillColor(...C.primary);
  doc.rect(0, ph - 8, pw, 8, "F");
  doc.setFillColor(...C.primaryMid);
  doc.rect(0, ph - 9.5, pw, 1.5, "F");

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(
    `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} \u00e0s ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pw / 2, ph - 12, { align: "center" }
  );

  return doc.output("blob");
}
