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
  const FOOTER_RESERVED = 18;
  const usableHeight = pageHeight - FOOTER_RESERVED;

  const primary = { r: 25, g: 95, b: 170 };
  const primaryLight = { r: 235, g: 244, b: 255 };
  const textDark = { r: 33, g: 37, b: 41 };
  const textMuted = { r: 108, g: 117, b: 125 };
  const borderLight = { r: 222, g: 226, b: 230 };

  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      addFooter();
      doc.addPage();
      yPos = margin;
    }
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(
      `${organizationName} • Laudo Técnico #${report.report_number.toString().padStart(4, "0")}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Página ${doc.getNumberOfPages()}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
  };

  const drawSectionLabel = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, 7, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(title, margin + 4, yPos + 5);
    yPos += 7;
  };

  const drawField = (label: string, value: string | null | undefined, x: number, y: number) => {
    if (!value) return;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(8);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(value, x + doc.getTextWidth(label) + 2, y);
  };

  const drawTextBlock = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(text, contentWidth - 8);
    const lineHeight = 4;
    ensureSpace(lines.length * lineHeight + 4);
    lines.forEach((line: string) => {
      ensureSpace(lineHeight + 2);
      doc.text(line, margin + 4, yPos + 4);
      yPos += lineHeight;
    });
    yPos += 4;
  };

  // ========== HEADER ==========
  const headerHeight = 30;
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(margin, yPos, contentWidth, 3, "F");
  yPos += 3;

  doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, headerHeight, "FD");

  let logoWidth = 0;
  if (organizationLogo) {
    const logoData = await loadImageAsBase64(organizationLogo);
    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", margin + 4, yPos + 3, 24, 24);
        logoWidth = 30;
      } catch { /* skip */ }
    }
  }

  const textStartX = margin + 5 + logoWidth;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(organizationName, textStartX, yPos + 8);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  let infoY = yPos + 13;
  const details: string[] = [];
  if (organizationCnpj) details.push(`CNPJ: ${organizationCnpj}`);
  if (organizationPhone) details.push(organizationPhone);
  if (organizationEmail) details.push(organizationEmail);
  if (details.length > 0) { doc.text(details.join("  •  "), textStartX, infoY); infoY += 4; }
  const addressParts: string[] = [];
  if (organizationAddress) addressParts.push(organizationAddress);
  if (organizationCity) addressParts.push(organizationCity);
  if (organizationState) addressParts.push(organizationState);
  if (addressParts.length > 0) doc.text(addressParts.join(" - "), textStartX, infoY);

  yPos += headerHeight + 6;

  // ========== DOCUMENT TITLE ==========
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(margin, yPos, contentWidth, 14, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`LAUDO TÉCNICO Nº ${report.report_number.toString().padStart(4, "0")}`, margin + 5, yPos + 9.5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const reportDate = report.report_date ? format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR }) : "";
  doc.text(reportDate, pageWidth - margin - 5, yPos + 9.5, { align: "right" });
  yPos += 18;

  doc.setDrawColor(primary.r, primary.g, primary.b);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
  yPos += 3;

  // ========== LINKS ==========
  if (report.service || report.quote_service) {
    ensureSpace(10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(primary.r, primary.g, primary.b);
    const links: string[] = [];
    if (report.service) links.push(`Vinculado à OS #${report.service.quote_number?.toString().padStart(4, "0")}`);
    if (report.quote_service) links.push(`Vinculado ao Orçamento #${report.quote_service.quote_number?.toString().padStart(4, "0")}`);
    doc.text(links.join("  •  "), margin + 4, yPos + 3);
    yPos += 8;
  }

  // ========== CLIENT ==========
  drawSectionLabel("DADOS DO CLIENTE");
  ensureSpace(24);
  const leftX = margin + 4;
  const halfWidth = contentWidth / 2;
  const rightX = margin + halfWidth + 4;
  doc.setFontSize(8);
  drawField("Cliente: ", report.client?.name, leftX, yPos + 5);
  drawField("Telefone: ", report.client?.phone, rightX, yPos + 5);
  yPos += 7;
  drawField("Endereço: ", report.client?.address, leftX, yPos + 5);
  yPos += 7;
  drawField("Cidade: ", [report.client?.city, report.client?.state].filter(Boolean).join(" - "), leftX, yPos + 5);
  drawField("E-mail: ", report.client?.email, rightX, yPos + 5);
  yPos += 10;

  // ========== TECHNICIAN ==========
  const techName = report.technician_profile?.full_name || report.responsible_technician_name;
  if (techName) {
    ensureSpace(10);
    drawField("Técnico Responsável: ", techName, leftX, yPos + 5);
    yPos += 10;
  }

  // ========== EQUIPMENT ==========
  if (report.equipment_type || report.equipment_brand) {
    drawSectionLabel("IDENTIFICAÇÃO DO EQUIPAMENTO");
    ensureSpace(28);
    drawField("Tipo: ", report.equipment_type, leftX, yPos + 5);
    drawField("Marca: ", report.equipment_brand, rightX, yPos + 5);
    yPos += 7;
    drawField("Modelo: ", report.equipment_model, leftX, yPos + 5);
    drawField("BTUs: ", report.capacity_btus, rightX, yPos + 5);
    yPos += 7;
    drawField("Nº Série: ", report.serial_number, leftX, yPos + 5);
    if (report.equipment_quantity > 1) drawField("Qtd: ", String(report.equipment_quantity), rightX, yPos + 5);
    yPos += 7;
    if (report.equipment_location) {
      drawField("Localização: ", report.equipment_location, leftX, yPos + 5);
      yPos += 7;
    }
    yPos += 3;
  }

  // ========== VISIT REASON ==========
  if (report.visit_reason) {
    drawSectionLabel("MOTIVO DA VISITA");
    drawTextBlock(report.visit_reason);
  }

  // ========== INSPECTION CHECKLIST ==========
  const checklist = (report.inspection_checklist as string[]) || [];
  if (checklist.length > 0) {
    drawSectionLabel("INSPEÇÃO REALIZADA");
    const checkedItems = INSPECTION_ITEMS.filter((i) => checklist.includes(i.key));
    ensureSpace(checkedItems.length * 5 + 4);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    checkedItems.forEach((item) => {
      ensureSpace(6);
      doc.text(`✓ ${item.label}`, leftX, yPos + 4);
      yPos += 5;
    });
    yPos += 4;
  }

  // ========== DIAGNOSIS ==========
  if (report.diagnosis) {
    drawSectionLabel("DIAGNÓSTICO TÉCNICO");
    drawTextBlock(report.diagnosis);
  }

  // ========== MEASUREMENTS ==========
  const measurements = (report.measurements as Record<string, string>) || {};
  const measKeys = ["pressure", "temperature", "voltage_measured", "current_measured"];
  const measLabels: Record<string, string> = { pressure: "Pressão", temperature: "Temperatura", voltage_measured: "Tensão", current_measured: "Corrente" };
  const hasMeasurements = measKeys.some((k) => measurements[k]);
  if (hasMeasurements) {
    drawSectionLabel("MEDIÇÕES / EVIDÊNCIAS");
    ensureSpace(14);
    measKeys.forEach((k) => {
      if (measurements[k]) {
        drawField(`${measLabels[k]}: `, measurements[k], leftX, yPos + 5);
        yPos += 6;
      }
    });
    if (measurements.notes) {
      yPos += 2;
      drawTextBlock(measurements.notes);
    }
    yPos += 2;
  }

  // ========== EQUIPMENT CONDITION ==========
  if (report.equipment_condition) {
    drawSectionLabel("CLASSIFICAÇÃO DO EQUIPAMENTO");
    ensureSpace(14);
    drawField("Estado: ", EQUIPMENT_CONDITIONS[report.equipment_condition] || report.equipment_condition, leftX, yPos + 5);
    const workingLabel = report.equipment_working === "yes" ? "Sim" : report.equipment_working === "no" ? "Não" : "Parcial";
    drawField("Funcionando: ", workingLabel, rightX, yPos + 5);
    yPos += 7;
    if (report.needs_quote) {
      doc.setTextColor(200, 100, 0);
      doc.text("⚠ Necessita orçamento", leftX, yPos + 5);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      yPos += 7;
    }
    yPos += 3;
  }

  // ========== RECOMMENDATION ==========
  if (report.recommendation) {
    drawSectionLabel("RECOMENDAÇÃO TÉCNICA");
    drawTextBlock(report.recommendation);
  }

  // ========== RISKS ==========
  if (report.risks) {
    drawSectionLabel("RISCOS / CONSEQUÊNCIAS");
    drawTextBlock(report.risks);
  }

  // ========== CONCLUSION ==========
  if (report.conclusion) {
    drawSectionLabel("CONCLUSÃO FINAL");
    drawTextBlock(report.conclusion);
  }

  // ========== OBSERVATIONS ==========
  if (report.observations) {
    drawSectionLabel("OBSERVAÇÕES FINAIS");
    drawTextBlock(report.observations);
  }

  // ========== PHOTOS ==========
  const PHOTO_CAT_LABELS: Record<string, string> = { before: "ANTES", problem: "PROBLEMA IDENTIFICADO", after: "DEPOIS" };
  const photoCategories: Array<"before" | "problem" | "after"> = ["before", "problem", "after"];
  
  const hasPhotos = photos.length > 0;
  if (hasPhotos) {
    drawSectionLabel("EVIDÊNCIAS FOTOGRÁFICAS");
    
    for (const cat of photoCategories) {
      const catPhotos = photos.filter((p) => p.category === cat).slice(0, 3);
      if (catPhotos.length === 0) continue;
      
      ensureSpace(10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(`▪ ${PHOTO_CAT_LABELS[cat] || cat}`, margin + 4, yPos + 5);
      yPos += 8;
      
      // Layout: 3 photos per row, ~55mm each
      const photosPerRow = Math.min(catPhotos.length, 3);
      const imgGap = 4;
      const totalGap = imgGap * (photosPerRow - 1);
      const imgSize = Math.min(55, (contentWidth - 8 - totalGap) / photosPerRow);
      
      ensureSpace(imgSize + 6);
      
      for (let j = 0; j < catPhotos.length; j++) {
        const photo = catPhotos[j];
        const x = margin + 4 + j * (imgSize + imgGap);
        try {
          const imgData = await loadImageAsBase64(photo.photo_url);
          if (imgData) {
            doc.addImage(imgData, "JPEG", x, yPos, imgSize, imgSize);
          }
        } catch {
          doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
          doc.rect(x, yPos, imgSize, imgSize);
          doc.setFontSize(7);
          doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
          doc.text("Indisponível", x + imgSize / 2, yPos + imgSize / 2, { align: "center" });
        }
      }
      yPos += imgSize + 6;
    }
  }


  ensureSpace(30);
  yPos += 10;
  doc.setDrawColor(textMuted.r, textMuted.g, textMuted.b);
  const sigLineWidth = 70;
  const sigLineY = yPos + 15;
  // Technician signature
  doc.line(margin + 10, sigLineY, margin + 10 + sigLineWidth, sigLineY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  const techLabel = report.technician_profile?.full_name || report.responsible_technician_name || "Técnico Responsável";
  doc.text(techLabel, margin + 10 + sigLineWidth / 2, sigLineY + 5, { align: "center" });

  // Client signature
  const rightSigX = pageWidth - margin - 10 - sigLineWidth;
  doc.line(rightSigX, sigLineY, rightSigX + sigLineWidth, sigLineY);
  doc.text(report.client?.name || "Cliente", rightSigX + sigLineWidth / 2, sigLineY + 5, { align: "center" });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(
      `${organizationName} • Laudo Técnico #${report.report_number.toString().padStart(4, "0")}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  doc.save(`Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}.pdf`);
}
