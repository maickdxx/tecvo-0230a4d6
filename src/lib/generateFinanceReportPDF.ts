import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transaction } from "@/hooks/useTransactions";
import { CATEGORY_LABELS } from "@/hooks/useTransactions";

interface FinanceReportData {
  transactions: Transaction[];
  month: Date;
  totals: {
    income: number;
    expense: number;
    balance: number;
  };
  organizationName: string;
}

export function generateFinanceReportPDF({
  transactions,
  month,
  totals,
  organizationName,
}: FinanceReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date: string) =>
    format(new Date(date), "dd/MM/yyyy", { locale: ptBR });

  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(organizationName, margin, yPos);

  yPos += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Relatório Financeiro", margin, yPos);

  // Period and date
  doc.setFontSize(10);
  const periodText = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Período: ${periodText.charAt(0).toUpperCase() + periodText.slice(1)}`, pageWidth - margin - 60, 20);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - margin - 60, 26);

  yPos += 15;
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Summary section
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO DO PERÍODO", margin, yPos);
  yPos += 10;

  // Summary boxes
  const boxWidth = (pageWidth - margin * 2 - 20) / 3;
  const boxHeight = 25;

  // Income box
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(34, 197, 94);
  doc.text("Entradas", margin + 5, yPos + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totals.income), margin + 5, yPos + 18);

  // Expense box
  doc.setFillColor(254, 226, 226);
  doc.roundedRect(margin + boxWidth + 10, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(239, 68, 68);
  doc.text("Saídas", margin + boxWidth + 15, yPos + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totals.expense), margin + boxWidth + 15, yPos + 18);

  // Balance box
  const balanceColor = totals.balance >= 0 ? [34, 197, 94] : [239, 68, 68];
  const balanceBgColor = totals.balance >= 0 ? [220, 252, 231] : [254, 226, 226];
  doc.setFillColor(balanceBgColor[0], balanceBgColor[1], balanceBgColor[2]);
  doc.roundedRect(margin + (boxWidth + 10) * 2, yPos, boxWidth, boxHeight, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
  doc.text("Saldo", margin + (boxWidth + 10) * 2 + 5, yPos + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totals.balance), margin + (boxWidth + 10) * 2 + 5, yPos + 18);

  yPos += boxHeight + 20;

  // Transactions section
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSAÇÕES", margin, yPos);
  yPos += 10;

  if (transactions.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text("Nenhuma transação registrada neste período.", margin, yPos);
  } else {
    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Data", margin + 2, yPos);
    doc.text("Descrição", margin + 25, yPos);
    doc.text("Categoria", margin + 95, yPos);
    doc.text("Valor", pageWidth - margin - 25, yPos);
    yPos += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedTransactions.forEach((transaction) => {
      checkPageBreak(8);

      doc.setTextColor(0);
      doc.text(formatDate(transaction.date), margin + 2, yPos);

      // Truncate description if too long
      const maxDescLength = 35;
      const desc = transaction.description.length > maxDescLength
        ? transaction.description.substring(0, maxDescLength) + "..."
        : transaction.description;
      doc.text(desc, margin + 25, yPos);

      doc.text(CATEGORY_LABELS[transaction.category], margin + 95, yPos);

      // Value with color
      if (transaction.type === "income") {
        doc.setTextColor(34, 197, 94);
        doc.text(`+${formatCurrency(Number(transaction.amount))}`, pageWidth - margin - 25, yPos);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.text(`-${formatCurrency(Number(transaction.amount))}`, pageWidth - margin - 25, yPos);
      }

      yPos += 6;
    });

    // Totals row
    yPos += 4;
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Total de transações: ${transactions.length}`, margin + 2, yPos);
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setDrawColor(200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    "Documento gerado automaticamente pelo Tecvo",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Save
  const monthStr = format(month, "yyyy-MM", { locale: ptBR });
  const fileName = `relatorio-financeiro-${monthStr}.pdf`;
  doc.save(fileName);
}
