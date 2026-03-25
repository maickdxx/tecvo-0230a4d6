import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  INSPECTION_ITEMS,
  EQUIPMENT_CONDITIONS,
  type TechnicalReport,
} from "@/hooks/useTechnicalReports";
import type { ReportPhoto } from "@/hooks/useReportPhotos";

interface ReportPDFData {
  report: TechnicalReport;
  photos?: ReportPhoto[];
  organizationName: string;
  organizationCnpj?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationLogo?: string;
  organizationCity?: string;
  organizationState?: string;
  timezone?: string;
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

export async function generateReportPDF({
  report,
  photos = [],
  organizationName,
  organizationCnpj,
  organizationPhone,
  organizationEmail,
  organizationAddress,
  organizationLogo,
  organizationCity,
  organizationState,
}: ReportPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;
  const FOOTER_RESERVED = 25;
  const usableHeight = pageHeight - FOOTER_RESERVED;

  // Modern Color Palette
  const colors = {
    primary: { r: 0, g: 68, b: 148 },     // Deep Blue
    accent: { r: 0, g: 122, b: 255 },     // Bright Blue
    success: { r: 40, g: 167, b: 69 },    // Green
    warning: { r: 255, g: 193, b: 7 },    // Yellow
    danger: { r: 220, g: 53, b: 69 },     // Red
    textMain: { r: 33, g: 37, b: 41 },    // Dark Gray
    textMuted: { r: 108, g: 117, b: 125 }, // Light Gray
    bgLight: { r: 248, g: 249, b: 250 },  // Very Light Gray
    border: { r: 222, g: 226, b: 230 },   // Border Gray
  };

  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      addFooter();
      doc.addPage();
      yPos = margin;
    }
  };

  const addFooter = () => {
    const footerY = pageHeight - 15;
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(7);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    
    // Company Info in Footer
    const footerText = [
      organizationName,
      organizationCnpj ? `CNPJ: ${organizationCnpj}` : null,
      organizationPhone ? `Tel/WhatsApp: ${organizationPhone}` : null
    ].filter(Boolean).join("  |  ");
    
    doc.text(footerText, margin, footerY);
    doc.text(
      `Página ${doc.getNumberOfPages()}`,
      pageWidth - margin,
      footerY,
      { align: "right" }
    );
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(title.toUpperCase(), margin, yPos + 5);
    
    doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos + 7, margin + 20, yPos + 7);
    
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(margin + 20, yPos + 7, pageWidth - margin, yPos + 7);
    
    yPos += 12;
  };

  const drawInfoBlock = (label: string, value: string | null | undefined, x: number, y: number, width: number) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.setFontSize(9);
    const val = value || "---";
    const lines = doc.splitTextToSize(val, width);
    doc.text(lines, x, y + 4.5);
    return lines.length * 4.5 + 6;
  };

  const drawStatusBadge = (status: string, x: number, y: number) => {
    let color = colors.primary;
    let label = status;
    
    if (status.toLowerCase().includes("func") || status === "good" || status === "yes") {
      color = colors.success;
      label = "FUNCIONANDO";
    } else if (status.toLowerCase().includes("aten") || status === "regular" || status === "partial") {
      color = colors.warning;
      label = "ATENÇÃO";
    } else if (status.toLowerCase().includes("crit") || status === "bad" || status === "no") {
      color = colors.danger;
      label = "CRÍTICO";
    } else if (status === "inoperative") {
      color = colors.danger;
      label = "INOPERANTE";
    }

    const padding = 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const textWidth = doc.getTextWidth(label);
    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = 6;

    doc.setFillColor(color.r, color.g, color.b);
    doc.roundedRect(x, y - 4, badgeWidth, badgeHeight, 1, 1, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + padding, y);
    
    return badgeWidth;
  };

  // ========== HEADER ==========
  let logoData = null;
  if (organizationLogo) {
    logoData = await loadImageAsBase64(organizationLogo);
  }

  // Top Bar
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(0, 0, pageWidth, 2, "F");
  yPos = 12;

  // Logo & Title
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, yPos, 35, 35, undefined, "FAST");
    } catch { /* skip */ }
  }

  const headerTextX = margin + (logoData ? 45 : 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.text("LAUDO TÉCNICO DE CLIMATIZAÇÃO", headerTextX, yPos + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text(`LAUDO Nº: ${report.report_number.toString().padStart(4, "0")}`, headerTextX, yPos + 17);
  
  const reportDate = report.report_date ? format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR }) : "---";
  doc.text(`DATA: ${reportDate}`, headerTextX, yPos + 22);

  if (report.service?.quote_number) {
    doc.text(`ORDEM DE SERVIÇO: #${report.service.quote_number.toString().padStart(4, "0")}`, headerTextX, yPos + 27);
  }

  yPos += 40;

  // ========== CLIENT DATA ==========
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.roundedRect(margin, yPos, contentWidth, 22, 1, 1, "FD");

  drawInfoBlock("Cliente", report.client?.name, margin + 5, yPos + 7, contentWidth / 2 - 10);
  drawInfoBlock("Endereço", [report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", "), margin + 5, yPos + 16, contentWidth - 10);
  drawInfoBlock("Contato", report.client?.phone || report.client?.email, margin + contentWidth / 2 + 5, yPos + 7, contentWidth / 2 - 10);

  yPos += 30;

  // ========== EXECUTIVE SUMMARY ==========
  drawSectionTitle("Resumo Executivo");
  ensureSpace(30);
  
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.roundedRect(margin, yPos, contentWidth, 20, 1, 1, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text("SITUAÇÃO DO EQUIPAMENTO", margin + 5, yPos + 7);
  
  // Status badges
  let badgeX = margin + 5;
  badgeX += drawStatusBadge(EQUIPMENT_CONDITIONS[report.equipment_condition || ""] || report.equipment_condition || "N/A", badgeX, yPos + 14) + 3;
  
  const workingLabel = report.equipment_working === "yes" ? "Operacional" : report.equipment_working === "no" ? "Inoperante" : "Parcial";
  drawStatusBadge(report.equipment_working, badgeX, yPos + 14);

  // Summary text
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  doc.setFontSize(9);
  const summaryText = report.visit_reason || "Relatório técnico de inspeção e manutenção preventiva/corretiva.";
  const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 85);
  doc.text(summaryLines, margin + 80, yPos + 7);

  yPos += 28;

  // ========== EQUIPMENT INFO ==========
  drawSectionTitle("Dados do Equipamento");
  ensureSpace(30);
  
  const colW = contentWidth / 3;
  drawInfoBlock("Tipo", report.equipment_type, margin, yPos, colW - 5);
  drawInfoBlock("Marca / Modelo", [report.equipment_brand, report.equipment_model].filter(Boolean).join(" / "), margin + colW, yPos, colW - 5);
  drawInfoBlock("Capacidade", report.capacity_btus ? `${report.capacity_btus} BTUs` : null, margin + colW * 2, yPos, colW - 5);
  
  yPos += 12;
  drawInfoBlock("Localização", report.equipment_location, margin, yPos, colW * 2 - 5);
  drawInfoBlock("Nº de Série", report.serial_number, margin + colW * 2, yPos, colW - 5);

  yPos += 15;

  // ========== CHECKLIST ==========
  const checklist = (report.inspection_checklist as string[]) || [];
  if (checklist.length > 0) {
    drawSectionTitle("Checklist de Inspeção");
    ensureSpace(40);
    
    const checkedItems = INSPECTION_ITEMS.filter((i) => checklist.includes(i.key));
    const itemsPerCol = Math.ceil(checkedItems.length / 2);
    
    doc.setFontSize(8);
    checkedItems.forEach((item, index) => {
      const col = Math.floor(index / itemsPerCol);
      const row = index % itemsPerCol;
      const x = margin + col * (contentWidth / 2);
      const y = yPos + row * 6;
      
      ensureSpace(8);
      
      // Draw check icon
      doc.setDrawColor(colors.success.r, colors.success.g, colors.success.b);
      doc.setLineWidth(0.5);
      doc.line(x, y + 2, x + 1, y + 3);
      doc.line(x + 1, y + 3, x + 3, y + 1);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
      doc.text(item.label, x + 5, y + 3);
    });
    
    yPos += itemsPerCol * 6 + 10;
  }

  // ========== DIAGNOSIS & PROBLEM ==========
  if (report.diagnosis) {
    drawSectionTitle("Diagnóstico Técnico");
    ensureSpace(20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const lines = doc.splitTextToSize(report.diagnosis, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 10;
  }

  // ========== RECOMMENDATIONS ==========
  if (report.recommendation) {
    drawSectionTitle("Recomendações e Observações");
    ensureSpace(20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const lines = doc.splitTextToSize(report.recommendation, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 10;
  }

  // ========== PHOTOS ==========
  const catPhotos = {
    before: photos.filter(p => p.category === "before").slice(0, 2),
    problem: photos.filter(p => p.category === "problem").slice(0, 2),
    after: photos.filter(p => p.category === "after").slice(0, 2),
  };

  const hasPhotos = Object.values(catPhotos).some(arr => arr.length > 0);
  
  if (hasPhotos) {
    drawSectionTitle("Registro Fotográfico");
    
    const photoCategories: Array<keyof typeof catPhotos> = ["before", "problem", "after"];
    const labels = { before: "Antes", problem: "Problema Identificado", after: "Depois" };

    for (const cat of photoCategories) {
      const currentPhotos = catPhotos[cat];
      if (currentPhotos.length === 0) continue;

      ensureSpace(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(labels[cat], margin, yPos);
      yPos += 5;

      const imgWidth = (contentWidth - 10) / 2;
      const imgHeight = imgWidth * 0.75;
      
      ensureSpace(imgHeight + 10);
      
      for (let i = 0; i < currentPhotos.length; i++) {
        const photo = currentPhotos[i];
        const x = margin + i * (imgWidth + 10);
        try {
          const imgData = await loadImageAsBase64(photo.photo_url);
          if (imgData) {
            doc.addImage(imgData, "JPEG", x, yPos, imgWidth, imgHeight, undefined, "MEDIUM");
          }
        } catch {
          doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
          doc.rect(x, yPos, imgWidth, imgHeight);
          doc.setFontSize(7);
          doc.text("Erro ao carregar imagem", x + imgWidth / 2, yPos + imgHeight / 2, { align: "center" });
        }
      }
      yPos += imgHeight + 10;
    }
  }

  // ========== SIGNATURES ==========
  ensureSpace(50);
  yPos += 15;
  
  const sigWidth = 70;
  const sigSpacing = (contentWidth - sigWidth * 2) / 2;
  
  // Technician
  doc.setDrawColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.setLineWidth(0.2);
  doc.line(margin + 5, yPos + 20, margin + 5 + sigWidth, yPos + 20);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  const techName = report.technician_profile?.full_name || report.responsible_technician_name || "Técnico Responsável";
  doc.text(techName, margin + 5 + sigWidth / 2, yPos + 25, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Técnico Responsável", margin + 5 + sigWidth / 2, yPos + 29, { align: "center" });

  // Client
  doc.line(pageWidth - margin - 5 - sigWidth, yPos + 20, pageWidth - margin - 5, yPos + 20);
  doc.setFont("helvetica", "bold");
  doc.text(report.client?.name || "Cliente", pageWidth - margin - 5 - sigWidth / 2, yPos + 25, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Cliente / Responsável", pageWidth - margin - 5 - sigWidth / 2, yPos + 29, { align: "center" });

  // Add final footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  doc.save(`Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}.pdf`);
}
