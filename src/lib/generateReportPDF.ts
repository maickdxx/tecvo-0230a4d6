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
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;
  const FOOTER_RESERVED = 18;
  const usableHeight = pageHeight - FOOTER_RESERVED;

  const colors = {
    primary: { r: 10, g: 25, b: 50 },
    accent: { r: 0, g: 90, b: 180 },
    success: { r: 22, g: 140, b: 70 },
    warning: { r: 210, g: 135, b: 0 },
    danger: { r: 180, g: 25, b: 40 },
    textMain: { r: 30, g: 35, b: 40 },
    textMuted: { r: 110, g: 115, b: 125 },
    bgLight: { r: 245, g: 247, b: 250 },
    bgCard: { r: 250, g: 251, b: 253 },
    border: { r: 215, g: 220, b: 228 },
    borderLight: { r: 232, g: 236, b: 242 },
  };

  const startNewPage = (topOffset = margin + 8) => {
    doc.addPage();
    yPos = topOffset;
  };

  const ensureSpace = (needed: number) => {
    if (yPos + needed > usableHeight) {
      startNewPage();
    }
  };

  const forceSectionPageBreak = () => {
    startNewPage();
  };

  const addFooter = () => {
    const footerY = pageHeight - 10;
    doc.setDrawColor(colors.borderLight.r, colors.borderLight.g, colors.borderLight.b);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    doc.setFontSize(6.5);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    const parts = [
      organizationName,
      organizationCnpj ? `CNPJ: ${organizationCnpj}` : null,
      organizationPhone ? `Tel: ${organizationPhone}` : null,
    ].filter(Boolean).join("  ·  ");
    doc.text(parts, margin, footerY);
    doc.text(`${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, footerY, { align: "right" });
  };

  // ── Section title with thick accent bar ──
  const drawSectionTitle = (title: string) => {
    ensureSpace(16);
    yPos += 4;
    // Accent bar
    doc.setFillColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.rect(margin, yPos, 3, 10, "F");
    // Title text
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(title.toUpperCase(), margin + 6, yPos + 7);
    yPos += 15;
  };

  // ── Info pair (label + value) ──
  const drawInfoPair = (label: string, value: string | null | undefined, x: number, y: number, maxW: number): number => {
    if (!value) return 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const lines = doc.splitTextToSize(value, maxW);
    doc.text(lines, x, y + 4.5);
    return lines.length * 4.5 + 8;
  };

  // ── Text block (label + paragraph) ──
  const drawLabeledText = (label: string, text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text(label.toUpperCase(), margin + 3, yPos);
    yPos += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const lines = doc.splitTextToSize(text, contentWidth - 6);
    ensureSpace(lines.length * 4.5 + 4);
    doc.text(lines, margin + 3, yPos);
    yPos += lines.length * 4.5 + 5;
  };

  // ════════════════════════════════════════
  //  PAGE 1 — FULL COVER
  // ════════════════════════════════════════
  let logoData: string | null = null;
  if (organizationLogo) {
    logoData = await loadImageAsBase64(organizationLogo);
  }

  // Top accent bar
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(0, 0, pageWidth, 4, "F");
  doc.setFillColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.rect(0, 4, pageWidth, 1.5, "F");

  yPos = 14;

  if (logoData) {
    try {
      doc.addImage(logoData, "AUTO", margin, yPos, 30, 30, undefined, "FAST");
    } catch { /* skip */ }
  }

  const hx = margin + (logoData ? 36 : 0);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.text("LAUDO TÉCNICO", hx, yPos + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
  doc.text("SISTEMAS DE CLIMATIZAÇÃO E REFRIGERAÇÃO", hx, yPos + 16);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);

  const reportDate = report.report_date ? format(new Date(report.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "---";
  const cityState = [organizationCity, organizationState].filter(Boolean).join(" – ");
  doc.text(`Nº ${report.report_number.toString().padStart(4, "0")}  ·  ${cityState ? cityState + "  ·  " : ""}${reportDate}`, hx, yPos + 22);

  if (report.service?.quote_number) {
    doc.text(`Referência OS: #${report.service.quote_number.toString().padStart(4, "0")}`, hx, yPos + 27);
    yPos += 38;
  } else {
    yPos += 34;
  }

  // ── Separator ──
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ── Company card ──
  doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.15);
  const companyCardH = organizationEmail ? 34 : 24;
  doc.roundedRect(margin, yPos, contentWidth, companyCardH, 1.5, 1.5, "FD");

  drawInfoPair("Empresa Responsável", organizationName, margin + 5, yPos + 6, contentWidth / 2 - 10);
  drawInfoPair("CNPJ", organizationCnpj, margin + contentWidth / 2 + 5, yPos + 6, contentWidth / 2 - 10);
  const fullAddress = [organizationAddress, organizationCity, organizationState].filter(Boolean).join(", ");
  if (fullAddress) drawInfoPair("Endereço", fullAddress, margin + 5, yPos + 16, contentWidth / 2 - 10);
  if (organizationPhone) drawInfoPair("Telefone", organizationPhone, margin + contentWidth / 2 + 5, yPos + 16, contentWidth / 2 - 10);
  if (organizationEmail) drawInfoPair("E-mail", organizationEmail, margin + 5, yPos + 26, contentWidth - 10);
  yPos += companyCardH + 4;

  // ── Client card ──
  doc.setFillColor(colors.bgCard.r, colors.bgCard.g, colors.bgCard.b);
  doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
  doc.setLineWidth(0.15);
  const clientZip = report.client?.zip_code;
  const clientAddrParts = [report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", ");
  const clientFullAddr = clientZip ? `${clientAddrParts} - CEP: ${clientZip}` : clientAddrParts;
  const clientCardH = clientFullAddr ? 24 : 14;
  doc.roundedRect(margin, yPos, contentWidth, clientCardH, 1.5, 1.5, "FD");

  drawInfoPair("Contratante", report.client?.name, margin + 5, yPos + 6, contentWidth / 2 - 10);
  drawInfoPair("Contato", [report.client?.phone, report.client?.email].filter(Boolean).join(" · "), margin + contentWidth / 2 + 5, yPos + 6, contentWidth / 2 - 10);
  if (clientFullAddr) drawInfoPair("Local da Prestação", clientFullAddr, margin + 5, yPos + 16, contentWidth / 2 - 10);

  const technicianName = report.technician_profile?.full_name || report.responsible_technician_name;
  if (technicianName) drawInfoPair("Técnico Responsável", technicianName, margin + contentWidth / 2 + 5, yPos + 16, contentWidth / 2 - 10);
  yPos += clientCardH + 6;

  // ── Visit reason ──
  if (report.visit_reason) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text("MOTIVO DA VISITA", margin + 3, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const vrLines = doc.splitTextToSize(report.visit_reason, contentWidth - 6);
    doc.text(vrLines, margin + 3, yPos);
    yPos += vrLines.length * 4.5 + 6;
  }

  // ── Summary stats box ──
  {
    doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.15);
    doc.roundedRect(margin, yPos, contentWidth, 18, 1.5, 1.5, "FD");

    const eqCount = equipment.length > 0 ? equipment.length : 1;
    const serviceType = (report as any).service_type || "Inspeção técnica";

    // Determine overall status label for cover
    let coverStatusLabel = "Operacional";
    if (equipment.length > 0) {
      const statuses = equipment.map((eq) => eq.final_status || "operational");
      if (statuses.includes("non_operational")) coverStatusLabel = "Não Operacional";
      else if (statuses.includes("operational_with_caveats")) coverStatusLabel = "Com Ressalvas";
    }

    const summaryFields = [
      { label: "Equipamentos", value: String(eqCount) },
      { label: "Tipo de Serviço", value: serviceType },
      { label: "Status Geral", value: coverStatusLabel },
    ];
    const sColW = contentWidth / summaryFields.length;
    summaryFields.forEach((sf, i) => {
      const sx = margin + i * sColW + 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
      doc.text(sf.label.toUpperCase(), sx, yPos + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
      doc.text(sf.value, sx, yPos + 12);
    });
    yPos += 24;
  }

  // ── Institutional declaration ──
  {
    doc.setDrawColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.setLineWidth(0.3);
    doc.setFillColor(245, 248, 255);
    const declText = "A empresa responsável declara que todos os serviços descritos neste laudo foram executados conforme os padrões técnicos aplicáveis, e que as informações aqui apresentadas refletem fielmente as condições encontradas no momento da inspeção.";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const declLines = doc.splitTextToSize(declText, contentWidth - 16);
    const declBoxH = declLines.length * 4 + 12;
    doc.roundedRect(margin, yPos, contentWidth, declBoxH, 1.5, 1.5, "FD");
    // Accent bar on left
    doc.setFillColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.rect(margin, yPos, 3, declBoxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text("DECLARAÇÃO TÉCNICA", margin + 8, yPos + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    doc.text(declLines, margin + 8, yPos + 12);
    yPos += declBoxH + 8;
  }

  // ── Cover signatures (if space allows) ──
  {
    const sigSpaceNeeded = 45;
    if (yPos + sigSpaceNeeded < usableHeight) {
      // Push signatures toward bottom of page
      const targetY = Math.max(yPos + 10, usableHeight - 50);
      yPos = targetY;

      const sW2 = 78;

      // Technician
      doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, margin + sW2, yPos);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(technicianName || "Técnico Responsável", margin, yPos + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
      doc.text("Responsável Técnico", margin, yPos + 9);

      // Client
      const cX2 = pageWidth - margin - sW2;
      doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.line(cX2, yPos, cX2 + sW2, yPos);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text(report.client?.name || "Representante do Cliente", cX2, yPos + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
      doc.text("Contratante", cX2, yPos + 9);
    }
  }

  // ════════════════════════════════════════
  //  EQUIPMENT BLOCKS
  // ════════════════════════════════════════
  if (equipment.length > 0) {
    // Página 1 fica reservada para a capa; os equipamentos sempre começam em nova página.
    forceSectionPageBreak();

    for (let idx = 0; idx < equipment.length; idx++) {
      if (idx > 0) {
        forceSectionPageBreak();
      }

      const eq = equipment[idx];
      const eqChecklist = (eq.inspection_checklist as any[]) || [];
      const eqMeasurements = (eq.measurements as Record<string, string>) || {};

      // ── Equipment header bar ──
      ensureSpace(30);
      yPos += 3;
      const finalLabel = eq.final_status ? (FINAL_STATUS_OPTIONS[eq.final_status] || eq.final_status) : null;

      // Dark header
      doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.roundedRect(margin, yPos, contentWidth, 10, 1.2, 1.2, "F");

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      const eqTitle = `EQUIPAMENTO ${String(idx + 1).padStart(2, "0")}`;
      doc.text(eqTitle, margin + 5, yPos + 6.8);

      if (eq.equipment_type) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 210, 225);
        doc.text(`—  ${eq.equipment_type}`, margin + 5 + doc.getTextWidth(eqTitle + "  "), yPos + 6.8);
      }

      if (finalLabel) {
        const statusColor = eq.final_status === "operational" ? colors.success
          : eq.final_status === "operational_with_caveats" ? colors.warning
          : colors.danger;
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const sw = doc.getTextWidth(finalLabel) + 8;
        doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
        doc.roundedRect(pageWidth - margin - sw - 3, yPos + 1.5, sw, 7, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(finalLabel, pageWidth - margin - sw + 1, yPos + 6);
      }

      yPos += 14;

      // ── Equipment identification grid ──
      const idFields: Array<{ label: string; value: string | null | undefined }> = [
        { label: "Tipo", value: eq.equipment_type },
        { label: "Marca", value: eq.equipment_brand },
        { label: "Modelo", value: eq.equipment_model },
        { label: "Capacidade", value: eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null },
        { label: "Local", value: eq.equipment_location },
        { label: "Nº de Série", value: eq.serial_number },
      ].filter(f => f.value);

      if (idFields.length > 0) {
        ensureSpace(16);
        doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
        doc.setDrawColor(colors.borderLight.r, colors.borderLight.g, colors.borderLight.b);
        doc.setLineWidth(0.1);

        const cols = 3;
        const rows = Math.ceil(idFields.length / cols);
        const cardH = rows * 13 + 4;
        doc.roundedRect(margin, yPos, contentWidth, cardH, 1, 1, "FD");

        const colW = contentWidth / cols;
        idFields.forEach((f, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = margin + col * colW + 5;
          const y = yPos + row * 13 + 6;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
          doc.text(f.label.toUpperCase(), x, y);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
          doc.text(doc.splitTextToSize(f.value!, colW - 10)[0] || "", x, y + 4);
        });

        yPos += cardH + 4;
      }

      // ── Checklist table ──
      if (eqChecklist.length > 0) {
        const rowH = 6.5;

        ensureSpace(20); // at least title + header + 1 row

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.text("CHECKLIST TÉCNICO", margin + 3, yPos);
        yPos += 6;

        // Table header
        const drawTableHeader = () => {
          doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
          doc.rect(margin, yPos, contentWidth, 7, "F");
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          doc.text("ITEM DE INSPEÇÃO", margin + 4, yPos + 5);
          doc.text("STATUS", pageWidth - margin - 25, yPos + 5);
          yPos += 7;
        };
        drawTableHeader();

        eqChecklist.forEach((item: any, i: number) => {
          // Check if row fits on current page
          if (yPos + rowH > usableHeight) {
            doc.addPage();
            yPos = margin + 8;
            drawTableHeader(); // redraw header on new page
          }

          // Alternating row bg
          if (i % 2 === 0) {
            doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
            doc.rect(margin, yPos, contentWidth, rowH, "F");
          }

          const label = CHECKLIST_ITEMS.find((c) => c.key === item.key)?.label || item.key;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
          doc.text(label, margin + 4, yPos + 4.5);

          // Status badge
          const statusText = item.status === "ok" ? "OK" : item.status === "attention" ? "ATENÇÃO" : "CRÍTICO";
          const statusColor = item.status === "ok" ? colors.success : item.status === "attention" ? colors.warning : colors.danger;

          doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
          const badgeW = doc.getTextWidth(statusText) + 6;
          const badgeX = pageWidth - margin - badgeW - 4;
          doc.roundedRect(badgeX, yPos + 0.8, badgeW, 5, 0.8, 0.8, "F");
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          doc.text(statusText, badgeX + 3, yPos + 4.3);

          yPos += rowH;
        });

        // Table bottom border
        doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
        doc.setLineWidth(0.15);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
      }

      // ── Measurements ──
      const measKeys = [
        { key: "pressure", label: "Pressão", unit: "PSI" },
        { key: "temperature", label: "Temperatura", unit: "°C" },
        { key: "voltage_measured", label: "Tensão", unit: "V" },
        { key: "current_measured", label: "Corrente", unit: "A" },
      ];
      const activeMeas = measKeys.filter(m => eqMeasurements[m.key]);
      if (activeMeas.length > 0) {
        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.text("MEDIÇÕES TÉCNICAS", margin + 3, yPos);
        yPos += 6;

        const mColW = contentWidth / activeMeas.length;
        activeMeas.forEach((m, i) => {
          const x = margin + i * mColW;
          doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
          doc.roundedRect(x + 1, yPos, mColW - 2, 14, 1, 1, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
          doc.text(m.label.toUpperCase(), x + 4, yPos + 5);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
          doc.text(`${eqMeasurements[m.key]} ${m.unit}`, x + 4, yPos + 11);
        });
        yPos += 20;
      }

      // ── Diagnosis ──
      const hasDiagnosis = eq.condition_found || eq.procedure_performed || eq.technical_observations;
      if (hasDiagnosis) {
        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.text("DIAGNÓSTICO TÉCNICO", margin + 3, yPos);
        yPos += 6;

        if (eq.condition_found) drawLabeledText("Condição Encontrada", eq.condition_found);
        if (eq.procedure_performed) drawLabeledText("Procedimento Realizado", eq.procedure_performed);
        if (eq.technical_observations) drawLabeledText("Observações Técnicas", eq.technical_observations);
      }

      // ── Impact ──
      if (eq.impact_level) {
        const impactInfo = IMPACT_LEVELS[eq.impact_level];
        if (impactInfo) {
          ensureSpace(14);
          const impColor = eq.impact_level === "low" ? colors.success : eq.impact_level === "medium" ? colors.warning : colors.danger;
          doc.setFillColor(impColor.r, impColor.g, impColor.b);
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          const impText = `NÍVEL DE IMPACTO:  ${impactInfo.label.toUpperCase()}`;
          const impW = doc.getTextWidth(impText) + 10;
          doc.roundedRect(margin, yPos, Math.min(impW, contentWidth), 7, 1, 1, "F");
          doc.setTextColor(255, 255, 255);
          doc.text(impText, margin + 5, yPos + 5);
          yPos += 12;
        }
      }

      // ── Services performed ──
      if (eq.services_performed) {
        ensureSpace(15);
        drawLabeledText("Serviços Executados", eq.services_performed);
      }

      // ── Condition badges ──
      const condLabel = eq.equipment_condition ? (EQUIPMENT_CONDITIONS[eq.equipment_condition] || null) : null;
      const cleanLabel = eq.cleanliness_status ? (CLEANLINESS_STATUS[eq.cleanliness_status] || null) : null;
      if (condLabel || cleanLabel) {
        ensureSpace(12);
        let bx = margin;
        const drawBadge = (text: string) => {
          doc.setFillColor(colors.bgLight.r, colors.bgLight.g, colors.bgLight.b);
          doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
          doc.setLineWidth(0.1);
          const w = doc.getTextWidth(text) + 8;
          doc.roundedRect(bx, yPos, w, 6.5, 1, 1, "FD");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
          doc.text(text, bx + 4, yPos + 4.5);
          bx += w + 4;
        };
        if (condLabel) drawBadge(`Condição: ${condLabel}`);
        if (cleanLabel) drawBadge(`Limpeza: ${cleanLabel}`);
        yPos += 12;
      }

      // Próximo equipamento sempre inicia em página própria via forceSectionPageBreak().
    }

    // Página final de consolidação e assinaturas sempre começa em nova página.
    forceSectionPageBreak();
  } else {
    // Fallback: legacy single equipment from technical_reports
    const hasLegacyEquip = report.equipment_type || report.equipment_brand || report.equipment_model;
    if (hasLegacyEquip) {
      drawSectionTitle("Identificação do Ativo");
      ensureSpace(22);
      const colW = contentWidth / 3;
      drawInfoPair("Tipo", report.equipment_type, margin, yPos, colW - 5);
      drawInfoPair("Fabricante / Modelo", [report.equipment_brand, report.equipment_model].filter(Boolean).join(" / ") || null, margin + colW, yPos, colW - 5);
      drawInfoPair("Capacidade", report.capacity_btus ? `${report.capacity_btus} BTUs` : null, margin + colW * 2, yPos, colW - 5);
      yPos += 14;
      drawInfoPair("Local", report.equipment_location, margin, yPos, colW * 2 - 5);
      drawInfoPair("Nº de Série", report.serial_number, margin + colW * 2, yPos, colW - 5);
      yPos += 12;
    }

    if (report.diagnosis) {
      drawSectionTitle("Diagnóstico Técnico");
      drawLabeledText("Diagnóstico", report.diagnosis);
    }

    if (report.interventions_performed) {
      drawSectionTitle("Serviços Executados");
      drawLabeledText("Intervenções", report.interventions_performed);
    }
  }

  // ════════════════════════════════════════
  //  RECOMMENDATIONS
  // ════════════════════════════════════════
  if (report.recommendation) {
    drawSectionTitle("Parecer Técnico e Recomendações");
    ensureSpace(20);
    drawLabeledText("Recomendação", report.recommendation);
  }

  // ════════════════════════════════════════
  //  RISKS
  // ════════════════════════════════════════
  if (report.risks) {
    ensureSpace(30);
    drawSectionTitle("Análise de Risco");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
    const riskLines = doc.splitTextToSize(report.risks, contentWidth - 12);
    const boxH = riskLines.length * 4.5 + 10;
    ensureSpace(boxH + 4);
    doc.setFillColor(255, 243, 243);
    doc.setDrawColor(colors.danger.r, colors.danger.g, colors.danger.b);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos - 2, contentWidth, boxH, 1.5, 1.5, "FD");
    // Danger accent bar
    doc.setFillColor(colors.danger.r, colors.danger.g, colors.danger.b);
    doc.rect(margin, yPos - 2, 3, boxH, "F");
    doc.text(riskLines, margin + 8, yPos + 4);
    yPos += boxH + 8;
  }

  // ════════════════════════════════════════
  //  CONCLUSION
  // ════════════════════════════════════════
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
    operational: "SISTEMA OPERACIONAL",
    operational_with_caveats: "SISTEMA OPERACIONAL COM RESSALVAS",
    non_operational: "SISTEMA NÃO OPERACIONAL",
  };
  const conclusionDescMap = {
    operational: "Todos os equipamentos inspecionados apresentam condições operacionais adequadas. O sistema de climatização está apto para funcionamento contínuo dentro dos parâmetros técnicos estabelecidos.",
    operational_with_caveats: "O sistema de climatização apresenta condições parciais de operação. Existem ressalvas técnicas identificadas que devem ser acompanhadas. Recomenda-se atenção aos itens sinalizados neste laudo.",
    non_operational: "Foi identificada condição de não operação em um ou mais equipamentos do sistema. É necessária intervenção técnica antes da liberação para uso. Consultar os apontamentos deste laudo para detalhamento.",
  };

  drawSectionTitle("Conclusão Técnica");
  ensureSpace(40);

  const conclusionColor = statusColorMap[overallStatus];

  // Full-width status box
  doc.setFillColor(conclusionColor.r, conclusionColor.g, conclusionColor.b);
  doc.roundedRect(margin, yPos, contentWidth, 10, 1.5, 1.5, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabelMap[overallStatus], margin + contentWidth / 2, yPos + 7, { align: "center" });
  yPos += 15;

  // Equipment count summary
  if (equipment.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text(`${equipment.length} equipamento${equipment.length > 1 ? "s" : ""} inspecionado${equipment.length > 1 ? "s" : ""} neste atendimento.`, margin + 3, yPos);
    yPos += 6;
  }

  // Auto conclusion description
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(colors.textMain.r, colors.textMain.g, colors.textMain.b);
  const descLines = doc.splitTextToSize(conclusionDescMap[overallStatus], contentWidth - 6);
  ensureSpace(descLines.length * 4.5 + 4);
  doc.text(descLines, margin + 3, yPos);
  yPos += descLines.length * 4.5 + 6;

  // User-provided conclusion
  if (report.conclusion) {
    drawLabeledText("Parecer Complementar", report.conclusion);
  }

  // ════════════════════════════════════════
  //  OBSERVATIONS
  // ════════════════════════════════════════
  if (report.observations) {
    drawSectionTitle("Observações Finais");
    drawLabeledText("Observações", report.observations);
  }

  // ════════════════════════════════════════
  //  PHOTOS
  // ════════════════════════════════════════
  const PHOTO_CAT_LABELS: Record<string, string> = {
    before: "REGISTRO INICIAL (CONDIÇÃO DE CHEGADA)",
    problem: "EVIDÊNCIAS DE FALHA / NÃO-CONFORMIDADE",
    after: "REGISTRO FINAL (CONDIÇÃO DE ENTREGA)",
  };
  const categories: Array<"before" | "problem" | "after"> = ["before", "problem", "after"];

  if (photos.length > 0) {
    drawSectionTitle("Registro Fotográfico");

    for (const cat of categories) {
      const catPhotos = photos.filter((p) => p.category === cat).slice(0, 4);
      if (catPhotos.length === 0) continue;

      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
      doc.text(PHOTO_CAT_LABELS[cat], margin, yPos);
      yPos += 7;

      const imgSpacing = 6;
      const imgW = (contentWidth - imgSpacing) / 2;
      const imgH = imgW * 0.7;

      for (let i = 0; i < catPhotos.length; i++) {
        if (i > 0 && i % 2 === 0) {
          yPos += imgH + 14;
          ensureSpace(imgH + 14);
        }

        const p = catPhotos[i];
        const x = margin + (i % 2) * (imgW + imgSpacing);

        try {
          const data = await loadImageAsBase64(p.photo_url);
          if (data) {
            doc.addImage(data, "JPEG", x, yPos, imgW, imgH, undefined, "MEDIUM");
            doc.setDrawColor(colors.borderLight.r, colors.borderLight.g, colors.borderLight.b);
            doc.setLineWidth(0.15);
            doc.rect(x, yPos, imgW, imgH);
            if (p.caption) {
              doc.setFontSize(7);
              doc.setFont("helvetica", "italic");
              doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
              doc.text(p.caption, x, yPos + imgH + 4);
            }
          }
        } catch {
          doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
          doc.rect(x, yPos, imgW, imgH);
          doc.setFontSize(7);
          doc.text("Erro ao processar imagem", x + imgW / 2, yPos + imgH / 2, { align: "center" });
        }
      }
      yPos += imgH + 18;
    }
  }

  // ════════════════════════════════════════
  //  SIGNATURES
  // ════════════════════════════════════════
  ensureSpace(55);
  yPos += 15;

  const sW = 78;
  const sTop = yPos + 28;

  // Technician
  doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.setLineWidth(0.3);
  doc.line(margin, sTop, margin + sW, sTop);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
  const tName = report.technician_profile?.full_name || report.responsible_technician_name || "Técnico Responsável";
  doc.text(tName, margin, sTop + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
  doc.text("Responsável Técnico", margin, sTop + 9);

  // Client
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

    doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.setLineWidth(0.3);
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
    if (ipInfo || osRef) doc.text([ipInfo, osRef].filter(Boolean).join("  ·  "), cX, sTop + 13);
  } else {
    doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.setLineWidth(0.3);
    doc.line(cX, sTop, cX + sW, sTop);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(report.client?.name || "Representante do Cliente", cX, sTop + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b);
    doc.text("Assinatura do Cliente", cX, sTop + 9);
  }

  // ── Apply footer to all pages ──
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter();
  }

  doc.save(`Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}_${report.client?.name?.replace(/\s+/g, "_") || ""}.pdf`);
}
