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
    
    const footerText = [
      organizationName,
      organizationCnpj ? `CNPJ: ${organizationCnpj}` : null,
      organizationPhone ? `WhatsApp: ${organizationPhone}` : null
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
    let label = status.toUpperCase();
    
    if (status === "good" || status === "yes" || status.toLowerCase().includes("func")) {
      color = colors.success;
      label = "FUNCIONANDO";
    } else if (status === "regular" || status === "partial" || status.toLowerCase().includes("aten")) {
      color = colors.warning;
      label = "ATENÇÃO";
    } else if (status === "bad" || status === "critical" || status === "no" || status === "inoperative" || status.toLowerCase().includes("crit")) {
      color = colors.danger;
      label = status === "bad" ? "RUIM" : status === "critical" ? "CRÍTICO" : status === "inoperative" ? "INOPERANTE" : "CRÍTICO";
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

  // Top Accent Bar
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(0, 0, pageWidth, 2, "F");
  yPos = 12;

  // Logo & Header Info
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, yPos, 35, 35, undefined, "FAST");
    } catch { /* skip */ }
  }

  const headerTextX = margin + (logoData ? 45 : 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.text("LAUDO TÉCNICO DE CLIMATIZAÇÃO", headerTextX, yPos + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text(`LAUDO Nº: ${report.report_number.toString().padStart(4, "0")}`, headerTextX, yPos + 15);
  
  const reportDate = report.report_date ? format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR }) : "---";
  doc.text(`DATA DE EMISSÃO: ${reportDate}`, headerTextX, yPos + 20);

  if (report.service?.quote_number) {
    doc.text(`VINCULADO À OS: #${report.service.quote_number.toString().padStart(4, "0")}`, headerTextX, yPos + 25);
  }

  yPos += 42;

  // ========== CLIENT CARD ==========
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.1);
  doc.roundedRect(margin, yPos, contentWidth, 25, 1, 1, "FD");

  drawInfoBlock("Cliente", report.client?.name, margin + 5, yPos + 7, contentWidth / 2 - 10);
  drawInfoBlock("Endereço", [report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", "), margin + 5, yPos + 18, contentWidth - 10);
  drawInfoBlock("Contato", [report.client?.phone, report.client?.email].filter(Boolean).join(" | "), margin + contentWidth / 2 + 5, yPos + 7, contentWidth / 2 - 10);

  yPos += 35;

  // ========== EXECUTIVE SUMMARY ==========
  drawSectionTitle("Resumo Executivo");
  ensureSpace(40);
  
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.roundedRect(margin, yPos, contentWidth, 25, 1, 1, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text("STATUS DO EQUIPAMENTO", margin + 5, yPos + 7);
  
  let badgeX = margin + 5;
  badgeX += drawStatusBadge(report.equipment_condition || "---", badgeX, yPos + 15) + 3;
  drawStatusBadge(report.equipment_working, badgeX, yPos + 15);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  doc.setFontSize(9);
  const summaryText = report.visit_reason || "Relatório técnico detalhado das condições de funcionamento e integridade do equipamento de climatização após inspeção técnica realizada no local.";
  const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 85);
  doc.text(summaryLines, margin + 80, yPos + 7);

  yPos += 35;

  // ========== EQUIPMENT INFO ==========
  drawSectionTitle("Dados do Equipamento");
  ensureSpace(35);
  
  const colW = contentWidth / 3;
  drawInfoBlock("Tipo de Equipamento", report.equipment_type, margin, yPos, colW - 5);
  drawInfoBlock("Marca / Modelo", [report.equipment_brand, report.equipment_model].filter(Boolean).join(" / "), margin + colW, yPos, colW - 5);
  drawInfoBlock("Capacidade", report.capacity_btus ? `${report.capacity_btus} BTUs` : "---", margin + colW * 2, yPos, colW - 5);
  
  yPos += 14;
  drawInfoBlock("Localização Técnica", report.equipment_location, margin, yPos, colW * 2 - 5);
  drawInfoBlock("Número de Série", report.serial_number, margin + colW * 2, yPos, colW - 5);

  yPos += 20;

  // ========== CHECKLIST ==========
  const checklist = (report.inspection_checklist as string[]) || [];
  if (checklist.length > 0) {
    drawSectionTitle("Checklist de Inspeção Técnica");
    ensureSpace(45);
    
    const checkedItems = INSPECTION_ITEMS.filter((i) => checklist.includes(i.key));
    const itemsPerCol = Math.ceil(checkedItems.length / 2);
    
    doc.setFontSize(8);
    checkedItems.forEach((item, index) => {
      const col = Math.floor(index / itemsPerCol);
      const row = index % itemsPerCol;
      const x = margin + col * (contentWidth / 2);
      const y = yPos + row * 6;
      
      ensureSpace(8);
      
      // Modern Check Icon
      doc.setFillColor(colors.success.r, colors.success.g, colors.success.b);
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
    drawSectionTitle("Diagnóstico Técnico e Problemas Identificados");
    ensureSpace(25);
    
    doc.setFillColor(255, 245, 245); // Light Red Background for highlight
    doc.setDrawColor(colors.danger.r, colors.danger.g, colors.danger.b);
    doc.setLineWidth(0.1);
    
    const diagLines = doc.splitTextToSize(report.diagnosis, contentWidth - 10);
    const boxHeight = diagLines.length * 5 + 10;
    
    doc.roundedRect(margin, yPos - 5, contentWidth, boxHeight, 1, 1, "FD");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.text(diagLines, margin + 5, yPos + 2);
    
    yPos += boxHeight + 10;
  }

  // ========== MEASUREMENTS ==========
  const measurements = (report.measurements as Record<string, string>) || {};
  const hasMeasurements = ["pressure", "temperature", "voltage_measured", "current_measured"].some(k => measurements[k]);
  
  if (hasMeasurements) {
    drawSectionTitle("Medições e Evidências Técnicas");
    ensureSpace(20);
    
    const measW = contentWidth / 4;
    drawInfoBlock("Pressão", measurements.pressure, margin, yPos, measW - 5);
    drawInfoBlock("Temperatura", measurements.temperature, margin + measW, yPos, measW - 5);
    drawInfoBlock("Tensão", measurements.voltage_measured, margin + measW * 2, yPos, measW - 5);
    drawInfoBlock("Corrente", measurements.current_measured, margin + measW * 3, yPos, measW - 5);
    
    yPos += 15;
  }

  // ========== SERVICE PERFORMED ==========
  if (report.conclusion) {
    drawSectionTitle("Serviços Realizados");
    ensureSpace(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const conclusionLines = doc.splitTextToSize(report.conclusion, contentWidth);
    doc.text(conclusionLines, margin, yPos);
    yPos += conclusionLines.length * 5 + 10;
  }

  // ========== RECOMMENDATIONS ==========
  if (report.recommendation) {
    drawSectionTitle("Recomendações e Plano de Ação");
    ensureSpace(25);
    
    doc.setFillColor(245, 250, 255); // Light Blue Background
    doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.setLineWidth(0.1);
    
    const recLines = doc.splitTextToSize(report.recommendation, contentWidth - 10);
    const recBoxHeight = recLines.length * 5 + 10;
    
    doc.roundedRect(margin, yPos - 5, contentWidth, recBoxHeight, 1, 1, "FD");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.text(recLines, margin + 5, yPos + 2);
    
    yPos += recBoxHeight + 15;
  }

  // ========== PHOTOS ==========
  const PHOTO_CAT_LABELS: Record<string, string> = { before: "Antes", problem: "Problema Identificado", after: "Depois" };
  const categories: Array<"before" | "problem" | "after"> = ["before", "problem", "after"];
  
  const hasPhotos = photos.length > 0;
  if (hasPhotos) {
    drawSectionTitle("Registro Fotográfico (Evidências)");
    
    for (const cat of categories) {
      const catPhotos = photos.filter(p => p.category === cat).slice(0, 2);
      if (catPhotos.length === 0) continue;

      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(PHOTO_CAT_LABELS[cat], margin, yPos);
      yPos += 6;

      const imgW = (contentWidth - 10) / 2;
      const imgH = imgW * 0.75;
      
      ensureSpace(imgH + 10);
      
      for (let i = 0; i < catPhotos.length; i++) {
        const p = catPhotos[i];
        const x = margin + i * (imgW + 10);
        try {
          const data = await loadImageAsBase64(p.photo_url);
          if (data) {
            doc.addImage(data, "JPEG", x, yPos, imgW, imgH, undefined, "MEDIUM");
          }
        } catch {
          doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
          doc.rect(x, yPos, imgW, imgH);
          doc.setFontSize(7);
          doc.text("Erro no carregamento", x + imgW / 2, yPos + imgH / 2, { align: "center" });
        }
      }
      yPos += imgH + 10;
    }
  }

  // ========== SIGNATURES ==========
  ensureSpace(60);
  yPos += 20;
  
  const sW = 75;
  const sTop = yPos + 20;
  
  doc.setDrawColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.setLineWidth(0.2);
  
  // Technician Signature
  doc.line(margin + 5, sTop, margin + 5 + sW, sTop);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  const tName = report.technician_profile?.full_name || report.responsible_technician_name || "Técnico Responsável";
  doc.text(tName, margin + 5 + sW / 2, sTop + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Assinatura do Técnico", margin + 5 + sW / 2, sTop + 9, { align: "center" });

  // Client Signature
  const cX = pageWidth - margin - 5 - sW;
  doc.line(cX, sTop, cX + sW, sTop);
  doc.setFont("helvetica", "bold");
  doc.text(report.client?.name || "Cliente", cX + sW / 2, sTop + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Assinatura do Cliente", cX + sW / 2, sTop + 9, { align: "center" });

  // Apply footer to all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter();
  }

  doc.save(`Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}_${report.client?.name?.replace(/\s+/g, "_") || ""}.pdf`);
}
