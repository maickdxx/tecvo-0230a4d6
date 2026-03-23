import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPaymentMethod } from "./formatPaymentMethod";
import type { RecebimentoTecnico, TechnicianSummary } from "@/hooks/useRecebimentosTecnico";

interface ReportData {
  recebimentos: RecebimentoTecnico[];
  summaries: TechnicianSummary[];
  organizationName: string;
  filters: {
    technicianName?: string;
    dateFrom?: string;
    dateTo?: string;
    paymentMethod?: string;
  };
}

export function generateRecebimentosTecnicoPDF({
  recebimentos,
  summaries,
  organizationName,
  filters,
}: ReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(organizationName, margin, yPos);

  yPos += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Recebimentos por Técnico", margin, yPos);

  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin - 50, 20);

  // Filters applied
  yPos += 10;
  doc.setFontSize(9);
  const filterParts: string[] = [];
  if (filters.technicianName) filterParts.push(`Técnico: ${filters.technicianName}`);
  if (filters.dateFrom) filterParts.push(`De: ${filters.dateFrom}`);
  if (filters.dateTo) filterParts.push(`Até: ${filters.dateTo}`);
  if (filters.paymentMethod) filterParts.push(`Pagamento: ${formatPaymentMethod(filters.paymentMethod)}`);
  if (filterParts.length > 0) {
    doc.text(`Filtros: ${filterParts.join(" | ")}`, margin, yPos);
    yPos += 6;
  }

  yPos += 4;
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Summaries
  if (summaries.length > 0) {
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO POR TÉCNICO", margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    for (const s of summaries) {
      checkPageBreak(14);
      doc.setFont("helvetica", "bold");
      doc.text(s.technician_name, margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(s.total), margin + 80, yPos);

      const methods = Object.entries(s.byMethod)
        .map(([k, v]) => `${formatPaymentMethod(k)}: ${formatCurrency(v)}`)
        .join("  |  ");
      yPos += 5;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(methods, margin + 4, yPos);
      doc.setTextColor(0);
      doc.setFontSize(10);
      yPos += 8;
    }

    yPos += 4;
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;
  }

  // Table
  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DETALHAMENTO", margin, yPos);
  yPos += 10;

  if (recebimentos.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text("Nenhum serviço concluído encontrado.", margin, yPos);
  } else {
    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("OS", margin + 2, yPos);
    doc.text("Cliente", margin + 14, yPos);
    doc.text("Técnico", margin + 70, yPos);
    doc.text("Pagamento", margin + 110, yPos);
    doc.text("Valor", pageWidth - margin - 20, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    let totalGeral = 0;

    for (const r of recebimentos) {
      checkPageBreak(7);
      doc.setTextColor(0);
      doc.text(`#${r.quote_number}`, margin + 2, yPos);

      const clientName = r.client_name.length > 28 ? r.client_name.substring(0, 28) + "..." : r.client_name;
      doc.text(clientName, margin + 14, yPos);

      const techName = (r.technician_name ?? "—").length > 18
        ? (r.technician_name ?? "—").substring(0, 18) + "..."
        : (r.technician_name ?? "—");
      doc.text(techName, margin + 70, yPos);

      doc.text(r.payment_method ? formatPaymentMethod(r.payment_method) : "N/I", margin + 110, yPos);
      doc.text(formatCurrency(r.amount), pageWidth - margin - 20, yPos);

      totalGeral += r.amount;
      yPos += 6;
    }

    // Total
    yPos += 4;
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total: ${recebimentos.length} serviços`, margin + 2, yPos);
    doc.text(formatCurrency(totalGeral), pageWidth - margin - 20, yPos);
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setDrawColor(200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Documento gerado automaticamente pelo Tecvo", pageWidth / 2, footerY, { align: "center" });

  doc.save(`recebimentos-tecnico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
