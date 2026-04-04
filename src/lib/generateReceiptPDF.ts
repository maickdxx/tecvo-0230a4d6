import jsPDF from "jspdf";

export interface ReceiptPDFData {
  organizationName: string;
  organizationCnpj?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationLogo?: string;
  clientName: string;
  quoteNumber?: string | number | null;
  serviceDescription?: string;
  serviceValue: number;
  payments: { method: string; amount: number }[];
  completedDate?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Brand colors
const COLORS = {
  primary: [30, 64, 175] as [number, number, number],      // Deep blue
  primaryLight: [219, 234, 254] as [number, number, number], // Light blue bg
  dark: [15, 23, 42] as [number, number, number],           // Slate 900
  muted: [100, 116, 139] as [number, number, number],       // Slate 500
  border: [203, 213, 225] as [number, number, number],      // Slate 300
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],       // Green 600
  successLight: [220, 252, 231] as [number, number, number], // Green 100
};

function drawRoundedRect(
  doc: jsPDF, x: number, y: number, w: number, h: number, r: number,
  fill?: [number, number, number], stroke?: [number, number, number]
) {
  if (fill) doc.setFillColor(...fill);
  if (stroke) {
    doc.setDrawColor(...stroke);
    doc.setLineWidth(0.3);
  }
  doc.roundedRect(x, y, w, h, r, r, fill && stroke ? "FD" : fill ? "F" : "S");
}

export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ═══════════════════════════════════════════
  // TOP ACCENT BAR
  // ═══════════════════════════════════════════
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 4, "F");

  y = 14;

  // ═══════════════════════════════════════════
  // HEADER: Logo + Org Info
  // ═══════════════════════════════════════════
  let logoEndX = margin;

  if (data.organizationLogo) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = data.organizationLogo!;
      });
      const maxH = 16;
      const ratio = img.width / img.height;
      const imgH = maxH;
      const imgW = Math.min(imgH * ratio, 45);
      doc.addImage(img, "PNG", margin, y, imgW, imgH);
      logoEndX = margin + imgW + 6;
    } catch {
      // Skip logo
    }
  }

  // Organization name
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(data.organizationName, logoEndX, y + 6);

  // Org details (right-aligned)
  const orgDetails = [
    data.organizationCnpj && `CNPJ: ${data.organizationCnpj}`,
    data.organizationPhone && `Tel: ${data.organizationPhone}`,
    data.organizationEmail,
    data.organizationAddress,
  ].filter(Boolean) as string[];

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  let detailY = y + 2;
  orgDetails.forEach((line) => {
    doc.text(line, pageWidth - margin, detailY, { align: "right" });
    detailY += 3.5;
  });

  y = Math.max(y + 20, detailY + 4);

  // Divider
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ═══════════════════════════════════════════
  // TITLE BADGE
  // ═══════════════════════════════════════════
  const titleText = "RECIBO DE PAGAMENTO";
  const badgeW = 90;
  const badgeH = 12;
  const badgeX = (pageWidth - badgeW) / 2;

  drawRoundedRect(doc, badgeX, y, badgeW, badgeH, 3, COLORS.primary);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text(titleText, pageWidth / 2, y + 8.2, { align: "center" });

  y += badgeH + 10;

  // ═══════════════════════════════════════════
  // OS NUMBER + DATE ROW
  // ═══════════════════════════════════════════
  const dateStr = data.completedDate
    ? new Date(data.completedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);

  if (data.quoteNumber) {
    doc.text(`OS nº ${String(data.quoteNumber).padStart(4, "0")}`, margin, y);
  }
  doc.text(dateStr, pageWidth - margin, y, { align: "right" });
  y += 10;

  // ═══════════════════════════════════════════
  // CLIENT CARD
  // ═══════════════════════════════════════════
  const clientCardH = 18;
  drawRoundedRect(doc, margin, y, contentWidth, clientCardH, 3, COLORS.primaryLight, COLORS.border);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("CLIENTE", margin + 5, y + 6);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(data.clientName, margin + 5, y + 13);

  y += clientCardH + 8;

  // ═══════════════════════════════════════════
  // SERVICE DESCRIPTION
  // ═══════════════════════════════════════════
  if (data.serviceDescription) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.muted);
    doc.text("DESCRIÇÃO DO SERVIÇO", margin, y);
    y += 5;

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.dark);
    const lines = doc.splitTextToSize(data.serviceDescription, contentWidth - 4);
    doc.text(lines, margin + 2, y);
    y += lines.length * 4.5 + 6;
  }

  // ═══════════════════════════════════════════
  // PAYMENT TABLE
  // ═══════════════════════════════════════════
  // Table header
  const tableY = y;
  drawRoundedRect(doc, margin, tableY, contentWidth, 8, 2, COLORS.dark);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text("Forma de Pagamento", margin + 5, tableY + 5.5);
  doc.text("Valor", pageWidth - margin - 5, tableY + 5.5, { align: "right" });

  y = tableY + 10;

  // Table rows
  if (data.payments.length > 0) {
    doc.setFontSize(9.5);
    data.payments.forEach((p, i) => {
      const rowBg = i % 2 === 0 ? COLORS.white : [248, 250, 252] as [number, number, number];
      doc.setFillColor(...rowBg);
      doc.rect(margin, y - 1, contentWidth, 7, "F");

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      doc.text(p.method, margin + 5, y + 4);

      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(p.amount), pageWidth - margin - 5, y + 4, { align: "right" });
      y += 7;
    });
  }

  // Total row
  y += 2;
  drawRoundedRect(doc, margin, y, contentWidth, 10, 2, COLORS.primaryLight, COLORS.primary);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("VALOR TOTAL", margin + 5, y + 7);
  doc.text(formatCurrency(data.serviceValue), pageWidth - margin - 5, y + 7, { align: "right" });

  y += 18;

  // ═══════════════════════════════════════════
  // SUCCESS BADGE
  // ═══════════════════════════════════════════
  const successW = 76;
  const successH = 10;
  const successX = (pageWidth - successW) / 2;
  drawRoundedRect(doc, successX, y, successW, successH, 3, COLORS.successLight, COLORS.success);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.success);
  doc.text("✓  Pagamento recebido com sucesso", pageWidth / 2, y + 6.8, { align: "center" });

  y += successH + 24;

  // ═══════════════════════════════════════════
  // SIGNATURE LINES
  // ═══════════════════════════════════════════
  const sigWidth = 65;
  const leftSigX = margin + 10;
  const rightSigX = pageWidth - margin - sigWidth - 10;

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(leftSigX, y, leftSigX + sigWidth, y);
  doc.line(rightSigX, y, rightSigX + sigWidth, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(data.organizationName, leftSigX + sigWidth / 2, y + 5, { align: "center" });
  doc.text(data.clientName, rightSigX + sigWidth / 2, y + 5, { align: "center" });

  doc.setFontSize(6.5);
  doc.text("Prestador", leftSigX + sigWidth / 2, y + 9, { align: "center" });
  doc.text("Cliente", rightSigX + sigWidth / 2, y + 9, { align: "center" });

  // ═══════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, footerY + 4, pageWidth, 6, "F");

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageWidth / 2,
    footerY + 2,
    { align: "center" }
  );

  return doc.output("blob");
}
