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

export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // === Logo ===
  if (data.organizationLogo) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = data.organizationLogo!;
      });
      const maxH = 18;
      const ratio = img.width / img.height;
      const imgH = maxH;
      const imgW = imgH * ratio;
      doc.addImage(img, "PNG", margin, y, Math.min(imgW, 50), imgH);
      y += imgH + 4;
    } catch {
      // Skip logo if failed
    }
  }

  // === Organization Header ===
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizationName, margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const orgDetails = [
    data.organizationCnpj && `CNPJ: ${data.organizationCnpj}`,
    data.organizationPhone && `Tel: ${data.organizationPhone}`,
    data.organizationEmail,
    data.organizationAddress,
  ].filter(Boolean);
  orgDetails.forEach((line) => {
    doc.text(line!, margin, y);
    y += 4;
  });

  y += 4;

  // === Divider ===
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // === Title ===
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE PAGAMENTO", pageWidth / 2, y, { align: "center" });
  y += 10;

  // === OS Number ===
  if (data.quoteNumber) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Ordem de Serviço: #${String(data.quoteNumber).padStart(4, "0")}`, margin, y);
    y += 6;
  }

  // === Date ===
  const dateStr = data.completedDate
    ? new Date(data.completedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Data: ${dateStr}`, margin, y);
  y += 10;

  // === Client ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, margin, y);
  y += 8;

  // === Service Description ===
  if (data.serviceDescription) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Serviço", margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.serviceDescription, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  y += 2;

  // === Value ===
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Valor Total:", margin, y);
  doc.text(formatCurrency(data.serviceValue), pageWidth - margin, y, { align: "right" });
  y += 8;

  // === Payment Methods ===
  if (data.payments.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Forma(s) de Pagamento", margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    data.payments.forEach((p) => {
      doc.text(`• ${p.method}`, margin + 2, y);
      doc.text(formatCurrency(p.amount), pageWidth - margin, y, { align: "right" });
      y += 5;
    });
    y += 4;
  }

  // === Divider ===
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // === Confirmation ===
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("✓ Pagamento recebido com sucesso.", pageWidth / 2, y, { align: "center" });
  y += 20;

  // === Signature lines ===
  const sigWidth = 60;
  const sigY = y + 10;

  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + sigWidth, sigY);
  doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(data.organizationName, margin + sigWidth / 2, sigY + 5, { align: "center" });
  doc.text(data.clientName, pageWidth - margin - sigWidth / 2, sigY + 5, { align: "center" });

  // Return as blob
  return doc.output("blob");
}
