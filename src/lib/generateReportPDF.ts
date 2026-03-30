import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TechnicalReport } from "@/hooks/useTechnicalReports";
import type { ReportPhoto } from "@/hooks/useReportPhotos";
import {
  CHECKLIST_ITEMS,
  IMPACT_LEVELS,
  FINAL_STATUS_OPTIONS,
  type ReportEquipment,
} from "@/hooks/useReportEquipment";
import {
  EQUIPMENT_CONDITIONS,
  CLEANLINESS_STATUS,
} from "@/hooks/useTechnicalReports";

interface ReportPDFData {
  report: TechnicalReport;
  equipment?: ReportEquipment[];
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
  equipment = [],
  photos = [],
  organizationName,
  organizationCnpj,
  organizationPhone,
  organizationEmail,
  organizationAddress,
  organizationLogo,
  organizationCity,
  organizationState,
  signature,
}: ReportPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;
  const FOOTER_RESERVED = 20;
  const usableHeight = pageHeight - FOOTER_RESERVED;

  const colors = {
    primary: { r: 10, g: 30, b: 60 },
    accent: { r: 0, g: 100, b: 200 },
    success: { r: 30, g: 150, b: 80 },
    warning: { r: 230, g: 150, b: 0 },
    danger: { r: 190, g: 30, b: 45 },
    textMain: { r: 25, g: 30, b: 35 },
    textMuted: { r: 100, g: 110, b: 120 },
    bgLight: { r: 248, g: 250, b: 252 },
    border: { r: 220, g: 225, b: 230 },
  };

  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      addFooter();
      doc.addPage();
      yPos = margin + 10;
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
      organizationPhone ? `Fale conosco: ${organizationPhone}` : null,
    ].filter(Boolean).join("  |  ");
    doc.text(footerText, margin, footerY);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, footerY, { align: "right" });
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(title.toUpperCase(), margin, yPos + 5);
    if (subtitle) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
      doc.text(subtitle, margin, yPos + 8.5);
    }
    doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.setLineWidth(0.6);
    doc.line(margin, yPos + 10, margin + 12, yPos + 10);
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(margin + 12, yPos + 10, pageWidth - margin, yPos + 10);
    yPos += 14;
  };

  const drawInfoBlock = (label: string, value: string | null | undefined, x: number, y: number, width: number) => {
    if (!value) return 0;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(value, width);
    doc.text(lines, x, y + 4.5);
    return lines.length * 4.5 + 8;
  };

  const drawTextBlock = (label: string, text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text(label.toUpperCase(), margin + 2, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const lines = doc.splitTextToSize(text, contentWidth - 4);
    ensureSpace(lines.length * 4.5 + 4);
    doc.text(lines, margin + 2, yPos);
    yPos += lines.length * 4.5 + 4;
  };

  // ========== HEADER ==========
  let logoData = null;
  if (organizationLogo) {
    logoData = await loadImageAsBase64(organizationLogo);
  }

  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(0, 0, pageWidth, 5, "F");
  yPos = 15;

  if (logoData) {
    try {
      doc.addImage(logoData, "AUTO", margin, yPos, 35, 35, undefined, "FAST");
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

  // ========== COMPANY DATA ==========
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.1);
  doc.roundedRect(margin, yPos, contentWidth, 22, 1.5, 1.5, "FD");

  drawInfoBlock("Empresa Responsável", organizationName, margin + 6, yPos + 8, contentWidth / 2 - 12);
  drawInfoBlock("CNPJ", organizationCnpj, margin + contentWidth / 2 + 6, yPos + 8, contentWidth / 2 - 12);
  drawInfoBlock("Endereço", [organizationAddress, organizationCity, organizationState].filter(Boolean).join(", "), margin + 6, yPos + 16, contentWidth - 12);

  yPos += 28;

  // ========== CLIENT DATA ==========
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.1);
  doc.roundedRect(margin, yPos, contentWidth, 28, 1.5, 1.5, "FD");

  drawInfoBlock("Contratante (Cliente)", report.client?.name, margin + 6, yPos + 8, contentWidth / 2 - 12);
  drawInfoBlock("Local da Prestação", [report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", "), margin + 6, yPos + 19, contentWidth - 12);
  drawInfoBlock("Identificação / Contato", [report.client?.phone, report.client?.email].filter(Boolean).join(" | "), margin + contentWidth / 2 + 6, yPos + 8, contentWidth / 2 - 12);

  const technicianName = report.technician_profile?.full_name || report.responsible_technician_name;
  if (technicianName) {
    drawInfoBlock("Técnico Responsável", technicianName, margin + contentWidth / 2 + 6, yPos + 19, contentWidth / 2 - 12);
  }

  yPos += 36;

  // ========== VISIT REASON ==========
  if (report.visit_reason) {
    drawSectionTitle("Motivo da Visita");
    ensureSpace(20);
    drawTextBlock("Solicitação", report.visit_reason);
    yPos += 4;
  }

  // ========== EQUIPMENT SECTIONS ==========
  if (equipment.length > 0) {
    for (let idx = 0; idx < equipment.length; idx++) {
      const eq = equipment[idx];
      const eqChecklist = (eq.inspection_checklist as any[]) || [];
      const eqMeasurements = (eq.measurements as Record<string, string>) || {};

      // Equipment header
      ensureSpace(25);
      const eqTitle = `EQUIPAMENTO ${idx + 1}${eq.equipment_type ? ` — ${eq.equipment_type}` : ""}`;
      const finalLabel = eq.final_status ? (FINAL_STATUS_OPTIONS[eq.final_status] || eq.final_status) : null;

      doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.roundedRect(margin, yPos, contentWidth, 9, 1, 1, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(eqTitle, margin + 4, yPos + 6);

      if (finalLabel) {
        const statusColor = eq.final_status === "operational" ? colors.success
          : eq.final_status === "operational_with_caveats" ? colors.warning
          : colors.danger;
        doc.setFontSize(7.5);
        const sw = doc.getTextWidth(finalLabel) + 8;
        doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
        doc.roundedRect(pageWidth - margin - sw - 2, yPos + 1, sw, 7, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(finalLabel, pageWidth - margin - sw + 2, yPos + 5.5);
      }

      yPos += 14;

      // Equipment identification
      const hasIdData = eq.equipment_type || eq.equipment_brand || eq.equipment_model || eq.capacity_btus || eq.serial_number || eq.equipment_location;
      if (hasIdData) {
        ensureSpace(22);
        const colW = contentWidth / 3;
        let maxH = 0;
        maxH = Math.max(maxH, drawInfoBlock("Tipo", eq.equipment_type, margin, yPos, colW - 5));
        maxH = Math.max(maxH, drawInfoBlock("Marca / Modelo", [eq.equipment_brand, eq.equipment_model].filter(Boolean).join(" / ") || null, margin + colW, yPos, colW - 5));
        maxH = Math.max(maxH, drawInfoBlock("Capacidade", eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null, margin + colW * 2, yPos, colW - 5));
        yPos += Math.max(maxH, 10);

        maxH = 0;
        maxH = Math.max(maxH, drawInfoBlock("Local", eq.equipment_location, margin, yPos, colW * 2 - 5));
        maxH = Math.max(maxH, drawInfoBlock("Nº de Série", eq.serial_number, margin + colW * 2, yPos, colW - 5));
        if (maxH > 0) yPos += maxH + 2;
      }

      // Checklist
      if (eqChecklist.length > 0) {
        ensureSpace(eqChecklist.length * 5 + 12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.text("CHECKLIST TÉCNICO", margin, yPos);
        yPos += 5;

        const itemsPerCol = Math.ceil(eqChecklist.length / 2);
        eqChecklist.forEach((item: any, i: number) => {
          const col = Math.floor(i / itemsPerCol);
          const row = i % itemsPerCol;
          const x = margin + col * (contentWidth / 2);
          const y = yPos + row * 5;

          const label = CHECKLIST_ITEMS.find((c) => c.key === item.key)?.label || item.key;
          const statusText = item.status === "ok" ? "OK" : item.status === "attention" ? "ATENÇÃO" : "CRÍTICO";
          const statusColor = item.status === "ok" ? colors.success : item.status === "attention" ? colors.warning : colors.danger;

          doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
          doc.circle(x + 1.2, y + 1.1, 1, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
          doc.text(`${label} [${statusText}]`, x + 4, y + 2);
        });

        yPos += itemsPerCol * 5 + 6;
      }

      // Measurements
      const hasMeasurements = ["pressure", "temperature", "voltage_measured", "current_measured"].some(k => eqMeasurements[k]);
      if (hasMeasurements) {
        ensureSpace(18);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.text("MEDIÇÕES", margin, yPos);
        yPos += 6;

        const measW = contentWidth / 4;
        drawInfoBlock("Pressão", eqMeasurements.pressure ? `${eqMeasurements.pressure} PSI` : null, margin, yPos, measW - 4);
        drawInfoBlock("Temperatura", eqMeasurements.temperature ? `${eqMeasurements.temperature} °C` : null, margin + measW, yPos, measW - 4);
        drawInfoBlock("Tensão", eqMeasurements.voltage_measured ? `${eqMeasurements.voltage_measured} V` : null, margin + measW * 2, yPos, measW - 4);
        drawInfoBlock("Corrente", eqMeasurements.current_measured ? `${eqMeasurements.current_measured} A` : null, margin + measW * 3, yPos, measW - 4);
        yPos += 14;
      }

      // Diagnosis
      const hasDiagnosis = eq.condition_found || eq.procedure_performed || eq.technical_observations;
      if (hasDiagnosis) {
        ensureSpace(25);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.text("DIAGNÓSTICO TÉCNICO", margin, yPos);
        yPos += 6;

        if (eq.condition_found) {
          drawTextBlock("Condição encontrada", eq.condition_found);
        }
        if (eq.procedure_performed) {
          drawTextBlock("Procedimento realizado", eq.procedure_performed);
        }
        if (eq.technical_observations) {
          drawTextBlock("Observações técnicas", eq.technical_observations);
        }
      }

      // Impact level
      if (eq.impact_level) {
        const impactInfo = IMPACT_LEVELS[eq.impact_level];
        if (impactInfo) {
          ensureSpace(14);
          const impColor = eq.impact_level === "low" ? colors.success : eq.impact_level === "medium" ? colors.warning : colors.danger;
          doc.setFillColor(impColor.r, impColor.g, impColor.b);
          const impText = `IMPACTO: ${impactInfo.label.toUpperCase()} — ${impactInfo.description}`;
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          const impW = doc.getTextWidth(impText) + 10;
          doc.roundedRect(margin, yPos, Math.min(impW, contentWidth), 7, 1, 1, "F");
          doc.setTextColor(255, 255, 255);
          doc.text(impText, margin + 4, yPos + 5);
          yPos += 12;
        }
      }

      // Services performed on this equipment
      if (eq.services_performed) {
        ensureSpace(15);
        drawTextBlock("Serviços executados", eq.services_performed);
      }

      // Equipment condition badges
      const condLabel = eq.equipment_condition ? (EQUIPMENT_CONDITIONS[eq.equipment_condition] || null) : null;
      const cleanLabel = eq.cleanliness_status ? (CLEANLINESS_STATUS[eq.cleanliness_status] || null) : null;
      if (condLabel || cleanLabel) {
        ensureSpace(10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
        const badges = [condLabel ? `Condição: ${condLabel}` : null, cleanLabel ? `Limpeza: ${cleanLabel}` : null].filter(Boolean).join("  |  ");
        doc.text(badges, margin, yPos);
        yPos += 6;
      }

      // Separator between equipment
      if (idx < equipment.length - 1) {
        yPos += 4;
        doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
        doc.setLineWidth(0.3);
        doc.line(margin + 20, yPos, pageWidth - margin - 20, yPos);
        yPos += 8;
      }
    }
  } else {
    // Fallback: legacy single equipment from technical_reports
    const hasLegacyEquip = report.equipment_type || report.equipment_brand || report.equipment_model;
    if (hasLegacyEquip) {
      drawSectionTitle("Identificação do Ativo");
      ensureSpace(22);
      const colW = contentWidth / 3;
      drawInfoBlock("Tipo", report.equipment_type, margin, yPos, colW - 5);
      drawInfoBlock("Fabricante / Modelo", [report.equipment_brand, report.equipment_model].filter(Boolean).join(" / ") || null, margin + colW, yPos, colW - 5);
      drawInfoBlock("Capacidade", report.capacity_btus ? `${report.capacity_btus} BTUs` : null, margin + colW * 2, yPos, colW - 5);
      yPos += 14;
      drawInfoBlock("Local", report.equipment_location, margin, yPos, colW * 2 - 5);
      drawInfoBlock("Nº de Série", report.serial_number, margin + colW * 2, yPos, colW - 5);
      yPos += 12;
    }

    // Legacy diagnosis
    if (report.diagnosis) {
      drawSectionTitle("Diagnóstico Técnico");
      drawTextBlock("Diagnóstico", report.diagnosis);
    }

    // Legacy interventions
    if (report.interventions_performed) {
      drawSectionTitle("Serviços Executados");
      drawTextBlock("Intervenções", report.interventions_performed);
    }
  }

  // ========== GLOBAL SERVICES ==========
  if (report.interventions_performed && equipment.length > 0) {
    drawSectionTitle("Serviços Gerais da OS");
    ensureSpace(15);
    drawTextBlock("Serviços", report.interventions_performed);
  }

  // ========== RECOMMENDATIONS ==========
  if (report.recommendation) {
    drawSectionTitle("Parecer Técnico e Recomendações");
    ensureSpace(20);
    drawTextBlock("Recomendação", report.recommendation);
  }

  // ========== RISKS ==========
  if (report.risks) {
    ensureSpace(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(colors.danger.r, colors.danger.g, colors.danger.b);
    doc.text("ANÁLISE DE RISCO:", margin, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const riskLines = doc.splitTextToSize(report.risks, contentWidth - 8);
    const boxH = riskLines.length * 5 + 10;
    ensureSpace(boxH + 8);
    doc.setFillColor(255, 245, 245);
    doc.roundedRect(margin, yPos - 2, contentWidth, boxH, 1, 1, "F");
    doc.text(riskLines, margin + 4, yPos + 4);
    yPos += boxH + 10;
  }

  // ========== CONCLUSION ==========
  // Derive overall status from equipment
  let overallStatus: "operational" | "operational_with_caveats" | "non_operational" = "operational";
  if (equipment.length > 0) {
    const statuses = equipment.map((eq) => eq.final_status || "operational");
    if (statuses.includes("non_operational")) overallStatus = "non_operational";
    else if (statuses.includes("operational_with_caveats")) overallStatus = "operational_with_caveats";
  } else {
    if (report.equipment_working === "no") overallStatus = "non_operational";
    else if (report.equipment_working === "partial") overallStatus = "operational_with_caveats";
  }

  const statusColorMap = {
    operational: colors.success,
    operational_with_caveats: colors.warning,
    non_operational: colors.danger,
  };
  const statusLabelMap = {
    operational: "OPERACIONAL",
    operational_with_caveats: "OPERACIONAL COM RESSALVAS",
    non_operational: "NÃO OPERACIONAL",
  };

  drawSectionTitle("Status Final do Atendimento");
  ensureSpace(25);

  const conclusionColor = statusColorMap[overallStatus];
  const conclusionLabel = statusLabelMap[overallStatus];

  // Status badge
  doc.setFillColor(conclusionColor.r, conclusionColor.g, conclusionColor.b);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const badgeW = doc.getTextWidth(conclusionLabel) + 12;
  doc.roundedRect(margin, yPos, badgeW, 8, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(conclusionLabel, margin + 6, yPos + 5.5);
  yPos += 14;

  // Conclusion text if provided
  if (report.conclusion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const conclLines = doc.splitTextToSize(report.conclusion, contentWidth - 4);
    ensureSpace(conclLines.length * 5 + 6);
    doc.text(conclLines, margin + 2, yPos);
    yPos += conclLines.length * 5 + 8;
  }

  // ========== OBSERVATIONS ==========
  if (report.observations) {
    drawSectionTitle("Observações Finais");
    ensureSpace(15);
    drawTextBlock("Observações", report.observations);
  }

  // ========== PHOTO REGISTRY ==========
  const PHOTO_CAT_LABELS: Record<string, string> = {
    before: "REGISTRO INICIAL (CONDIÇÃO DE CHEGADA)",
    problem: "EVIDÊNCIAS DE FALHA / NÃO-CONFORMIDADE",
    after: "REGISTRO FINAL (CONDIÇÃO DE ENTREGA)",
  };
  const categories: Array<"before" | "problem" | "after"> = ["before", "problem", "after"];

  if (photos.length > 0) {
    drawSectionTitle("Registro Fotográfico", "Documentação visual da execução");

    for (const cat of categories) {
      const catPhotos = photos.filter((p) => p.category === cat).slice(0, 4);
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
  ensureSpace(60);
  yPos += 20;

  const sW = 80;
  const sTop = yPos + 30;

  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.1);
  doc.line(margin, sTop, margin + sW, sTop);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  const tName = report.technician_profile?.full_name || report.responsible_technician_name || "Técnico Responsável";
  doc.text(tName, margin, sTop + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text("Responsável Técnico", margin, sTop + 9);

  const cX = pageWidth - margin - sW;
  if (signature?.signature_url) {
    try {
      const sigImg = await loadImageAsBase64(signature.signature_url);
      if (sigImg) {
        doc.addImage(sigImg, "PNG", cX + 10, sTop - 22, 60, 20, undefined, "FAST");
      }
    } catch (e) {
      console.error("Error loading signature", e);
    }

    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(cX, sTop, cX + sW, sTop);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(signature.signer_name || report.client?.name || "Representante", cX, sTop + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    const signedDate = signature.signed_at ? format(new Date(signature.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";
    const ipInfo = signature.ip_address ? `IP: ${signature.ip_address}` : "";
    const osRef = report.service?.quote_number ? `Ref. OS: #${report.service.quote_number.toString().padStart(4, "0")}` : "";

    doc.text(`Assinado digitalmente em ${signedDate}`, cX, sTop + 9);
    doc.text(`${ipInfo} | ${osRef}`, cX, sTop + 13);
  } else {
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.1);
    doc.line(cX, sTop, cX + sW, sTop);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(report.client?.name || "Representante do Cliente", cX, sTop + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text("Assinatura do Cliente", cX, sTop + 9);
  }

  // Apply footer to all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter();
  }

  doc.save(`Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}_${report.client?.name?.replace(/\s+/g, "_") || ""}.pdf`);
}
