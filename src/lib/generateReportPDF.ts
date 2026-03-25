import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  INSPECTION_ITEMS,
  CLEANLINESS_STATUS,
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
  signature?: {
    signature_url: string | null;
    signer_name: string | null;
    signed_at: string | null;
    ip_address: string | null;
  } | null;
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
  const margin = 20; // Increased margin for premium feel
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;
  const FOOTER_RESERVED = 25;
  const usableHeight = pageHeight - FOOTER_RESERVED;

  // Premium Color Palette
  const colors = {
    primary: { r: 10, g: 30, b: 60 },      // Deep Navy Blue
    accent: { r: 0, g: 100, b: 200 },      // Tech Blue
    success: { r: 30, g: 150, b: 80 },     // Professional Green
    warning: { r: 230, g: 150, b: 0 },     // Amber
    danger: { r: 190, g: 30, b: 45 },      // Deep Red
    textMain: { r: 40, g: 45, b: 50 },     // Dark Gray/Black
    textMuted: { r: 120, g: 130, b: 140 }, // Muted Slate
    bgLight: { r: 245, g: 247, b: 250 },   // Very Light Slate
    border: { r: 210, g: 215, b: 220 },    // Subtle Border
  };

  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      addFooter();
      doc.addPage();
      yPos = margin + 10; // Extra top space on new pages
    }
  };

  const addFooter = () => {
    const footerY = pageHeight - 12;
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(7);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    
    const footerText = [
      organizationName,
      organizationCnpj ? `CNPJ: ${organizationCnpj}` : null,
      organizationPhone ? `Fale conosco: ${organizationPhone}` : null
    ].filter(Boolean).join("  |  ");
    
    doc.text(footerText, margin, footerY);
    doc.text(
      `Página ${doc.getNumberOfPages()}`,
      pageWidth - margin,
      footerY,
      { align: "right" }
    );
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(title.toUpperCase(), margin, yPos + 5);
    
    if (subtitle) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
      doc.text(subtitle, margin, yPos + 9);
    }
    
    doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.setLineWidth(0.8);
    doc.line(margin, yPos + 11, margin + 15, yPos + 11);
    
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(margin + 15, yPos + 11, pageWidth - margin, yPos + 11);
    
    yPos += 18;
  };

  const drawInfoBlock = (label: string, value: string | null | undefined, x: number, y: number, width: number, forceShow: boolean = false) => {
    if (!value && !forceShow) return 0;
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.setFontSize(9);
    const val = value || "N/A";
    const lines = doc.splitTextToSize(val, width);
    doc.text(lines, x, y + 4.5);
    return lines.length * 4.5 + 8;
  };

  const drawStatusBadge = (report: TechnicalReport, x: number, y: number) => {
    const condition = report.equipment_condition;
    const working = report.equipment_working;
    
    let color = colors.primary;
    let label = "INSPEÇÃO REALIZADA";
    
    if ((condition === "good" || !condition) && working === "yes") {
      color = colors.success;
      label = "EM PERFEITO ESTADO";
    } else if (condition === "regular" || working === "partial") {
      color = colors.warning;
      label = "REQUER ATENÇÃO";
    } else if (condition === "bad" || condition === "critical" || condition === "inoperative" || working === "no") {
      color = colors.danger;
      label = "NECESSITA REPARO IMEDIATO";
    }

    const paddingX = 8;
    const paddingY = 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const textWidth = doc.getTextWidth(label);
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = 10;

    doc.setFillColor(color.r, color.g, color.b);
    doc.roundedRect(x, y - 7, badgeWidth, badgeHeight, 1.5, 1.5, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + paddingX, y);
    
    return badgeWidth;
  };

  // ========== HEADER ==========
  let logoData = null;
  if (organizationLogo) {
    logoData = await loadImageAsBase64(organizationLogo);
  }

  // Top Accent Bar (Brand impact)
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(0, 0, pageWidth, 5, "F");
  yPos = 15;

  // Logo & Header Info
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, yPos, 35, 35, undefined, "FAST");
    } catch { /* skip */ }
  }

  const headerTextX = margin + (logoData ? 42 : 0);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.text("LAUDO TÉCNICO", headerTextX, yPos + 10);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.text("SISTEMAS DE CLIMATIZAÇÃO E REFRIGERAÇÃO", headerTextX, yPos + 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text(`Nº DE CONTROLE: ${report.report_number.toString().padStart(4, "0")}`, headerTextX, yPos + 23);
  
  const cityState = [organizationCity, organizationState].filter(Boolean).join(" - ");
  const reportDate = report.report_date ? format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR }) : "---";
  doc.text(`${cityState ? cityState + ", " : ""}Data de Emissão: ${reportDate}`, headerTextX, yPos + 28);

  if (report.service?.quote_number) {
    doc.text(`Referência OS: #${report.service.quote_number.toString().padStart(4, "0")}`, headerTextX, yPos + 33);
  }

  yPos += 45;

  // ========== CLIENT DATA ==========
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.1);
  doc.roundedRect(margin, yPos, contentWidth, 28, 1.5, 1.5, "FD");

  drawInfoBlock("Contratante", report.client?.name, margin + 6, yPos + 8, contentWidth / 2 - 12);
  drawInfoBlock("Local da Prestação", [report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", "), margin + 6, yPos + 19, contentWidth - 12);
  drawInfoBlock("Identificação / Contato", [report.client?.phone, report.client?.email].filter(Boolean).join(" | "), margin + contentWidth / 2 + 6, yPos + 8, contentWidth / 2 - 12);

  yPos += 40;

  // ========== EXECUTIVE STATUS ==========
  drawSectionTitle("Status Geral do Equipamento", "Resumo visual das condições identificadas");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const summaryText = report.visit_reason || "Relatório de inspeção técnica detalhada para avaliação das condições operacionais, integridade física e performance do sistema de climatização, visando garantir a eficiência energética e a vida útil do patrimônio.";
  const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 95);
  const boxHeight = Math.max(35, summaryLines.length * 5.5 + 18);
  
  ensureSpace(boxHeight + 10);
  
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.1);
  doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, "FD");

  // Vertical Divider
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.line(margin + 85, yPos + 5, margin + 85, yPos + boxHeight - 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text("CLASSIFICAÇÃO TÉCNICA", margin + 8, yPos + 10);
  
  drawStatusBadge(report, margin + 8, yPos + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  doc.setFontSize(9);
  doc.text(summaryLines, margin + 92, yPos + 10);

  yPos += boxHeight + 12;

  // ========== EQUIPMENT SPECIFICATIONS ==========
  const hasEquipmentData = report.equipment_type || report.equipment_brand || report.equipment_model || report.capacity_btus || report.equipment_location || report.serial_number;
  
  if (hasEquipmentData) {
    drawSectionTitle("Informações do Ativo", "Dados técnicos e localização do equipamento");
    ensureSpace(40);
    
    const colW = contentWidth / 3;
    let currentY = yPos;
    let maxH = 0;
    
    maxH = Math.max(maxH, drawInfoBlock("Tipo", report.equipment_type, margin, currentY, colW - 8));
    maxH = Math.max(maxH, drawInfoBlock("Fabricante / Modelo", [report.equipment_brand, report.equipment_model].filter(Boolean).join(" / "), margin + colW, currentY, colW - 8));
    maxH = Math.max(maxH, drawInfoBlock("Capacidade Nominal", report.capacity_btus ? `${report.capacity_btus} BTUs` : null, margin + colW * 2, currentY, colW - 8));
    
    currentY += maxH + 4;
    maxH = 0;
    
    maxH = Math.max(maxH, drawInfoBlock("Ambiente / Localização", report.equipment_location, margin, currentY, colW * 2 - 8));
    maxH = Math.max(maxH, drawInfoBlock("Nº de Série / Patrimônio", report.serial_number, margin + colW * 2, currentY, colW - 8));

    yPos = currentY + maxH + 12;
  }

  // ========== INSPECTION CHECKLIST ==========
  const checklist = (report.inspection_checklist as string[]) || [];
  if (checklist.length > 0) {
    drawSectionTitle("Checklist de Conformidade", "Itens verificados durante a inspeção");
    ensureSpace(50);
    
    const checkedItems = INSPECTION_ITEMS.filter((i) => checklist.includes(i.key));
    const itemsPerCol = Math.ceil(checkedItems.length / 2);
    
    doc.setFontSize(8.5);
    checkedItems.forEach((item, index) => {
      const col = Math.floor(index / itemsPerCol);
      const row = index % itemsPerCol;
      const x = margin + col * (contentWidth / 2);
      const y = yPos + row * 8;
      
      ensureSpace(10);
      
      // Premium Checkmark Icon
      doc.setFillColor(colors.success.r, colors.success.g, colors.success.b);
      doc.setDrawColor(colors.success.r, colors.success.g, colors.success.b);
      doc.circle(x + 2, y + 1.5, 1.8, "F");
      
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.line(x + 1.2, y + 1.5, x + 1.8, y + 2.1);
      doc.line(x + 1.8, y + 2.1, x + 2.8, y + 1.1);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
      doc.text(item.label, x + 7, y + 2.5);
    });
    
    yPos += itemsPerCol * 8 + 12;
  }

  // ========== TECHNICAL DIAGNOSIS ==========
  if (report.diagnosis) {
    drawSectionTitle("Diagnóstico Técnico", "Análise detalhada das inconformidades");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    
    const padding = 8;
    const diagLines = doc.splitTextToSize(report.diagnosis, contentWidth - (padding * 2));
    const boxHeight = diagLines.length * 5.5 + (padding * 2);
    
    ensureSpace(boxHeight + 10);
    
    doc.setFillColor(255, 248, 248); // Subtle red tint
    doc.setDrawColor(colors.danger.r, colors.danger.g, colors.danger.b);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, yPos, contentWidth, boxHeight, 1.5, 1.5, "FD");
    
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.text(diagLines, margin + padding, yPos + padding + 4);
    
    yPos += boxHeight + 12;
  }

  // ========== RECOMMENDATIONS & RISKS ==========
  if (report.recommendation || report.risks) {
    drawSectionTitle("Plano de Ação e Segurança", "Recomendações técnicas e riscos associados");
    ensureSpace(30);

    if (report.recommendation) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
      doc.text("AÇÕES RECOMENDADAS:", margin, yPos);
      yPos += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
      const recLines = doc.splitTextToSize(report.recommendation, contentWidth);
      doc.text(recLines, margin, yPos);
      yPos += recLines.length * 5.5 + 10;
    }

    if (report.risks) {
      ensureSpace(35);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(colors.danger.r, colors.danger.g, colors.danger.b);
      doc.text("RISCOS OPERACIONAIS (SE NÃO EXECUTADO):", margin, yPos);
      yPos += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
      const riskLines = doc.splitTextToSize(report.risks, contentWidth - 10);
      
      const padding = 6;
      const boxH = riskLines.length * 5.5 + padding * 2;
      ensureSpace(boxH + 10);
      
      doc.setFillColor(255, 242, 242);
      doc.setDrawColor(colors.danger.r, colors.danger.g, colors.danger.b);
      doc.setLineWidth(0.1);
      doc.roundedRect(margin, yPos - 2, contentWidth, boxH, 1, 1, "FD");
      
      doc.text(riskLines, margin + padding, yPos + padding + 3);
      yPos += boxH + 12;
    }
  }

  // ========== TECHNICAL MEASUREMENTS ==========
  const measurements = (report.measurements as Record<string, string>) || {};
  const hasMeasurements = ["pressure", "temperature", "voltage_measured", "current_measured"].some(k => measurements[k]);
  
  if (hasMeasurements) {
    drawSectionTitle("Dados Operacionais", "Aferições técnicas de performance");
    ensureSpace(35);
    
    const measW = contentWidth / 4;
    let measY = yPos;
    let maxMH = 0;
    
    maxMH = Math.max(maxMH, drawInfoBlock("Pressão de Sucção", measurements.pressure, margin, measY, measW - 8));
    maxMH = Math.max(maxMH, drawInfoBlock("Temp. de Saída", measurements.temperature, margin + measW, measY, measW - 8));
    maxMH = Math.max(maxMH, drawInfoBlock("Tensão Elétrica", measurements.voltage_measured, margin + measW * 2, measY, measW - 8));
    maxMH = Math.max(maxMH, drawInfoBlock("Corrente Nominal", measurements.current_measured, margin + measW * 3, measY, measW - 8));
    
    yPos = measY + maxMH + 12;
  }

  // ========== SERVICES PERFORMED ==========
  if (report.conclusion) {
    drawSectionTitle("Conclusão dos Serviços", "Intervenções realizadas nesta visita");
    ensureSpace(25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const conclusionLines = doc.splitTextToSize(report.conclusion, contentWidth);
    doc.text(conclusionLines, margin, yPos);
    yPos += conclusionLines.length * 5.5 + 12;
  }

  // ========== PHOTO REGISTRY ==========
  const PHOTO_CAT_LABELS: Record<string, string> = { 
    before: "REGISTRO INICIAL (CONDIÇÃO DE CHEGADA)", 
    problem: "EVIDÊNCIAS DE FALHA / NÃO-CONFORMIDADE", 
    after: "REGISTRO FINAL (CONDIÇÃO DE ENTREGA)" 
  };
  const categories: Array<"before" | "problem" | "after"> = ["before", "problem", "after"];
  
  const hasPhotos = photos.length > 0;
  if (hasPhotos) {
    drawSectionTitle("Registro Fotográfico", "Documentação visual da execução");
    
    for (const cat of categories) {
      const catPhotos = photos.filter(p => p.category === cat).slice(0, 4);
      if (catPhotos.length === 0) continue;

      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(PHOTO_CAT_LABELS[cat], margin, yPos);
      yPos += 8;

      const imgSpacing = 8;
      const imgW = (contentWidth - imgSpacing) / 2;
      const imgH = imgW * 0.75;
      
      for (let i = 0; i < catPhotos.length; i++) {
        if (i > 0 && i % 2 === 0) {
          yPos += imgH + 15;
          ensureSpace(imgH + 15);
        }
        
        const p = catPhotos[i];
        const x = margin + (i % 2) * (imgW + imgSpacing);
        
        try {
          const data = await loadImageAsBase64(p.photo_url);
          if (data) {
            doc.addImage(data, "JPEG", x, yPos, imgW, imgH, undefined, "MEDIUM");
            
            // Photo Frame/Border
            doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
            doc.setLineWidth(0.1);
            doc.rect(x, yPos, imgW, imgH);

            if (p.caption) {
              doc.setFontSize(7.5);
              doc.setFont("helvetica", "italic");
              doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
              doc.text(p.caption, x, yPos + imgH + 5);
            }
          }
        } catch {
          doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
          doc.rect(x, yPos, imgW, imgH);
          doc.setFontSize(8);
          doc.text("Erro ao processar imagem", x + imgW / 2, yPos + imgH / 2, { align: "center" });
        }
      }
      yPos += imgH + 20;
    }
  }

  // ========== SIGNATURES ==========
  ensureSpace(70);
  yPos += 25;
  
  const sW = 70;
  const sTop = yPos + 20;
  
  doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.setLineWidth(0.3);
  
  // Technician
  doc.line(margin + 5, sTop, margin + 5 + sW, sTop);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  const tName = report.technician_profile?.full_name || report.responsible_technician_name || "Técnico Responsável";
  doc.text(tName, margin + 5 + sW / 2, sTop + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Responsável Técnico", margin + 5 + sW / 2, sTop + 10, { align: "center" });

  // Client
  const cX = pageWidth - margin - 5 - sW;
  doc.line(cX, sTop, cX + sW, sTop);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(report.client?.name || "Representante do Cliente", cX + sW / 2, sTop + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Assinatura / Carimbo", cX + sW / 2, sTop + 10, { align: "center" });

  // Apply footer to all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter();
  }

  doc.save(`Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}_${report.client?.name?.replace(/\s+/g, "_") || ""}.pdf`);
}
