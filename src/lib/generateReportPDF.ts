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
import { renderHtmlToPdf, loadImageAsBase64, esc, PDF_CSS } from "@/lib/pdf/renderHtmlToPdf";

export const OFFICIAL_REPORT_PDF_GENERATOR = "official-technical-report-pdf-html";
export const OFFICIAL_REPORT_PDF_LAYOUT = "tecvo-technical-report-html-v1";

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
  returnBlob?: boolean;
}

function secTitle(t: string) {
  return `<div class="sec-title"><div class="bar"></div><div class="bg"><span>${esc(t)}</span></div></div>`;
}

function infoField(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<div class="fld"><div class="fld-lbl">${esc(label)}</div><div class="fld-val">${esc(value)}</div></div>`;
}

export async function generateReportPDF({
  report, equipment = [], photos = [], organizationName, organizationCnpj,
  organizationPhone, organizationEmail, organizationAddress, organizationLogo,
  organizationCity, organizationState, signature, returnBlob = false,
}: ReportPDFData): Promise<Blob | void> {
  const logoB64 = organizationLogo ? await loadImageAsBase64(organizationLogo) : null;
  let sigB64: string | null = null;
  if (signature?.signature_url) sigB64 = await loadImageAsBase64(signature.signature_url);

  // Pre-load photo images
  const photoB64Map = new Map<string, string>();
  for (const p of photos) {
    const d = await loadImageAsBase64(p.photo_url);
    if (d) photoB64Map.set(p.id, d);
  }

  const reportDate = report.report_date
    ? format(new Date(report.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "---";
  const cityState = [organizationCity, organizationState].filter(Boolean).join(" – ");
  const linkedService = report.service || report.quote_service;
  const technicianName = report.technician_profile?.full_name || report.responsible_technician_name;

  const SERVICE_TYPE_LABELS: Record<string, string> = {
    installation: "Instalação", maintenance: "Manutenção", cleaning: "Limpeza",
    repair: "Reparo", inspection: "Inspeção", preventive: "Preventiva", corrective: "Corretiva",
  };
  const serviceType = linkedService?.service_type ? (SERVICE_TYPE_LABELS[linkedService.service_type] || linkedService.service_type) : "Inspeção técnica";

  let coverStatusLabel = "Operacional";
  let overallStatus: "operational" | "operational_with_caveats" | "non_operational" = "operational";
  if (equipment.length > 0) {
    const statuses = equipment.map(eq => eq.final_status || "operational");
    if (statuses.includes("non_operational")) { overallStatus = "non_operational"; coverStatusLabel = "Não Operacional"; }
    else if (statuses.includes("operational_with_caveats")) { overallStatus = "operational_with_caveats"; coverStatusLabel = "Com Ressalvas"; }
  } else {
    if (report.equipment_working === "no") { overallStatus = "non_operational"; coverStatusLabel = "Não Operacional"; }
    else if (report.equipment_working === "partial") { overallStatus = "operational_with_caveats"; coverStatusLabel = "Com Ressalvas"; }
  }

  const refLabel = linkedService?.quote_number
    ? (report.quote_service_id && !report.service_id
      ? `Referência Orçamento: #${linkedService.quote_number.toString().padStart(4, "0")}`
      : `Referência OS: #${linkedService.quote_number.toString().padStart(4, "0")}`)
    : "";

  const fullAddress = [organizationAddress, organizationCity, organizationState].filter(Boolean).join(", ");
  const clientZip = report.client?.zip_code;
  const clientAddr = [report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", ");
  const clientFullAddr = clientZip ? `${clientAddr} - CEP: ${clientZip}` : clientAddr;

  const WORKING_LABELS: Record<string, string> = { yes: "Sim", no: "Não", partial: "Parcial" };
  const conclusionDescMap: Record<string, string> = {
    operational: "Todos os equipamentos inspecionados apresentam condições operacionais adequadas. O sistema de climatização está apto para funcionamento contínuo dentro dos parâmetros técnicos estabelecidos.",
    operational_with_caveats: "O sistema de climatização apresenta condições parciais de operação. Existem ressalvas técnicas identificadas que devem ser acompanhadas.",
    non_operational: "Foi identificada condição de não operação em um ou mais equipamentos do sistema. É necessária intervenção técnica antes da liberação para uso.",
  };
  const statusLabelMap: Record<string, string> = {
    operational: "SISTEMA OPERACIONAL",
    operational_with_caveats: "SISTEMA OPERACIONAL COM RESSALVAS",
    non_operational: "SISTEMA NÃO OPERACIONAL",
  };
  const statusClass: Record<string, string> = { operational: "op", operational_with_caveats: "cav", non_operational: "nop" };

  // ── Build equipment HTML blocks ──
  const equipHtmlBlocks = equipment.map((eq, idx) => {
    const eqChecklist = (eq.inspection_checklist as any[]) || [];
    const eqMeasurements = (eq.measurements as Record<string, string>) || {};
    const finalLabel = eq.final_status ? (FINAL_STATUS_OPTIONS[eq.final_status] || eq.final_status) : null;
    const badgeClass = eq.final_status === "operational" ? "ok" : eq.final_status === "operational_with_caveats" ? "warn" : "crit";

    const idFields = [
      { label: "Tipo", value: eq.equipment_type },
      { label: "Marca", value: eq.equipment_brand },
      { label: "Modelo", value: eq.equipment_model },
      { label: "Capacidade", value: eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null },
      { label: "Local", value: eq.equipment_location },
      { label: "Nº de Série", value: eq.serial_number },
      { label: "Funcionando", value: eq.equipment_working ? (WORKING_LABELS[eq.equipment_working] || eq.equipment_working) : null },
    ].filter(f => f.value);

    const measKeys = [
      { key: "pressure", label: "Pressão", unit: "PSI" },
      { key: "temperature", label: "Temperatura", unit: "°C" },
      { key: "voltage_measured", label: "Tensão", unit: "V" },
      { key: "current_measured", label: "Corrente", unit: "A" },
    ];
    const activeMeas = measKeys.filter(m => eqMeasurements[m.key]);

    const condLabel = eq.equipment_condition ? (EQUIPMENT_CONDITIONS[eq.equipment_condition] || null) : null;
    const cleanLabel = eq.cleanliness_status ? (CLEANLINESS_STATUS[eq.cleanliness_status] || null) : null;

    return `
    <div data-pdf-section data-pdf-page-break="true">
      <div class="eq-bar">
        <div><span class="et">EQUIPAMENTO ${String(idx + 1).padStart(2, "0")}</span>${eq.equipment_type ? `<span class="etp">— ${esc(eq.equipment_type)}</span>` : ""}</div>
        ${finalLabel ? `<span class="eq-badge ${badgeClass}">${esc(finalLabel)}</span>` : ""}
      </div>

      ${idFields.length > 0 ? `
      <div class="id-grid">
        ${idFields.map(f => `<div class="idf"><div class="il">${esc(f.label)}</div><div class="iv">${esc(f.value!)}</div></div>`).join("")}
      </div>` : ""}

      ${eqChecklist.length > 0 ? `
      <div style="margin-top:8px;font-size:11px;font-weight:bold;color:#0A1932;">CHECKLIST TÉCNICO</div>
      <table class="ck-tbl">
        <thead><tr><th>ITEM DE INSPEÇÃO</th><th style="text-align:right">STATUS</th></tr></thead>
        <tbody>
        ${eqChecklist.map((item: any, i: number) => {
          const label = CHECKLIST_ITEMS.find(c => c.key === item.key)?.label || item.key;
          const statusText = item.status === "ok" ? "OK" : item.status === "attention" ? "ATENÇÃO" : "CRÍTICO";
          const bc = item.status === "ok" ? "ok" : item.status === "attention" ? "att" : "crt";
          return `<tr><td>${esc(label)}</td><td style="text-align:right"><span class="ck-badge ${bc}">${statusText}</span></td></tr>`;
        }).join("")}
        </tbody>
      </table>` : ""}

      ${activeMeas.length > 0 ? `
      <div style="margin-top:8px;font-size:11px;font-weight:bold;color:#0A1932;">MEDIÇÕES TÉCNICAS</div>
      <div class="meas-row">
        ${activeMeas.map(m => `<div class="meas-card"><div class="ml">${esc(m.label)}</div><div class="mv">${esc(eqMeasurements[m.key])} ${m.unit}</div></div>`).join("")}
      </div>` : ""}

      ${(eq.condition_found || eq.procedure_performed || eq.technical_observations) ? `
      <div style="margin-top:8px;font-size:11px;font-weight:bold;color:#0A1932;">DIAGNÓSTICO TÉCNICO</div>
      ${eq.condition_found ? `<div class="diag-lbl">Condição Encontrada</div><div class="diag-txt">${esc(eq.condition_found)}</div>` : ""}
      ${eq.procedure_performed ? `<div class="diag-lbl">Procedimento Realizado</div><div class="diag-txt">${esc(eq.procedure_performed)}</div>` : ""}
      ${eq.technical_observations ? `<div class="diag-lbl">Observações Técnicas</div><div class="diag-txt">${esc(eq.technical_observations)}</div>` : ""}
      ` : ""}

      ${eq.impact_level && IMPACT_LEVELS[eq.impact_level] ? `
      <div class="imp-badge ${eq.impact_level === "low" ? "low" : eq.impact_level === "medium" ? "med" : "hi"}">
        NÍVEL DE IMPACTO: ${esc(IMPACT_LEVELS[eq.impact_level].label.toUpperCase())}
      </div>` : ""}

      ${eq.services_performed ? `<div class="diag-lbl" style="margin-top:8px">Serviços Executados</div><div class="diag-txt">${esc(eq.services_performed)}</div>` : ""}

      ${(condLabel || cleanLabel) ? `
      <div class="cond-badges">
        ${condLabel ? `<span class="cond-badge">Condição: ${esc(condLabel)}</span>` : ""}
        ${cleanLabel ? `<span class="cond-badge">Limpeza: ${esc(cleanLabel)}</span>` : ""}
      </div>` : ""}
    </div>`;
  }).join("");

  // ── Legacy equipment fallback ──
  const legacyEquipHtml = equipment.length === 0 ? `
    ${(report.equipment_type || report.equipment_brand || report.equipment_model) ? `
    <div data-pdf-section>
      ${secTitle("Identificação do Ativo")}
      <div class="id-grid">
        ${report.equipment_type ? `<div class="idf"><div class="il">Tipo</div><div class="iv">${esc(report.equipment_type)}</div></div>` : ""}
        ${report.equipment_brand ? `<div class="idf"><div class="il">Fabricante</div><div class="iv">${esc(report.equipment_brand)}</div></div>` : ""}
        ${report.equipment_model ? `<div class="idf"><div class="il">Modelo</div><div class="iv">${esc(report.equipment_model)}</div></div>` : ""}
        ${report.capacity_btus ? `<div class="idf"><div class="il">Capacidade</div><div class="iv">${report.capacity_btus} BTUs</div></div>` : ""}
        ${report.equipment_location ? `<div class="idf"><div class="il">Local</div><div class="iv">${esc(report.equipment_location)}</div></div>` : ""}
        ${report.serial_number ? `<div class="idf"><div class="il">Nº de Série</div><div class="iv">${esc(report.serial_number)}</div></div>` : ""}
      </div>
    </div>` : ""}
    ${report.diagnosis ? `<div data-pdf-section>${secTitle("Diagnóstico Técnico")}<div class="diag-lbl">Diagnóstico</div><div class="diag-txt">${esc(report.diagnosis)}</div></div>` : ""}
    ${report.interventions_performed ? `<div data-pdf-section>${secTitle("Serviços Executados")}<div class="diag-lbl">Intervenções</div><div class="diag-txt">${esc(report.interventions_performed)}</div></div>` : ""}
  ` : "";

  // ── Photos HTML ──
  const PHOTO_CAT_LABELS: Record<string, string> = {
    before: "REGISTRO INICIAL (CONDIÇÃO DE CHEGADA)",
    problem: "EVIDÊNCIAS DE FALHA / NÃO-CONFORMIDADE",
    after: "REGISTRO FINAL (CONDIÇÃO DE ENTREGA)",
  };
  const categories: Array<"before" | "problem" | "after"> = ["before", "problem", "after"];
  let photosHtml = "";
  if (photos.length > 0) {
    photosHtml = `<div data-pdf-section>${secTitle("Registro Fotográfico")}`;
    for (const cat of categories) {
      const catPhotos = photos.filter(p => p.category === cat).slice(0, 4);
      if (catPhotos.length === 0) continue;
      photosHtml += `<div class="photo-cat">${esc(PHOTO_CAT_LABELS[cat])}</div><div class="photo-grid">`;
      for (const p of catPhotos) {
        const b64 = photoB64Map.get(p.id);
        photosHtml += `<div>${b64 ? `<img src="${b64}" />` : `<div style="height:150px;background:#f5f5f5;border:1px solid #ddd;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">Imagem indisponível</div>`}${p.caption ? `<div class="photo-cap">${esc(p.caption)}</div>` : ""}</div>`;
      }
      photosHtml += `</div>`;
    }
    photosHtml += `</div>`;
  }

  // ── Full HTML ──
  const html = `<style>${PDF_CSS}</style>
<div>
  <!-- COVER PAGE -->
  <div data-pdf-section>
    <div style="height:5px;background:linear-gradient(to right,#0A1932 80%,#005AB4);border-radius:3px;"></div>
    <div style="margin-top:16px;">
      <div class="rpt-hdr">
        ${logoB64 ? `<img src="${logoB64}" />` : ""}
        <div>
          <div class="rpt-title">LAUDO TÉCNICO</div>
          <div class="rpt-sub">SISTEMAS DE CLIMATIZAÇÃO E REFRIGERAÇÃO</div>
          <div class="rpt-meta">Nº ${report.report_number.toString().padStart(4, "0")}  ·  ${cityState ? cityState + "  ·  " : ""}${reportDate}</div>
          ${refLabel ? `<div class="rpt-meta">${esc(refLabel)}</div>` : ""}
        </div>
      </div>
    </div>

    <hr style="border:none;border-top:1px solid #D7DCE4;margin:12px 0;" />

    <div class="info-card">
      <div class="row">${infoField("Empresa Responsável", organizationName)}${infoField("CNPJ", organizationCnpj)}</div>
      <div class="row">${infoField("Endereço", fullAddress)}${infoField("Telefone", organizationPhone)}</div>
      ${organizationEmail ? `<div class="row">${infoField("E-mail", organizationEmail)}</div>` : ""}
    </div>

    <div class="info-card" style="background:#FAFBFD;">
      <div class="row">${infoField("Contratante", report.client?.name)}${infoField("Contato", [report.client?.phone, report.client?.email].filter(Boolean).join(" · "))}</div>
      ${clientFullAddr ? `<div class="row">${infoField("Local da Prestação", clientFullAddr)}${infoField("Técnico Responsável", technicianName)}</div>` : ""}
    </div>

    ${report.visit_reason ? `
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:bold;color:#005AB4;text-transform:uppercase;">MOTIVO DA VISITA</div>
      <div style="font-size:12px;margin-top:4px;">${esc(report.visit_reason)}</div>
    </div>` : ""}

    <div class="sum-bar">
      <div class="st"><div class="st-lbl">EQUIPAMENTOS</div><div class="st-val">${equipment.length > 0 ? equipment.length : 1}</div></div>
      <div class="st"><div class="st-lbl">TIPO DE SERVIÇO</div><div class="st-val">${esc(serviceType)}</div></div>
      <div class="st"><div class="st-lbl">STATUS GERAL</div><div class="st-val">${esc(coverStatusLabel)}</div></div>
    </div>

    <div class="decl-box">
      <div class="dt">DECLARAÇÃO TÉCNICA</div>
      <div class="dp">A empresa responsável declara que todos os serviços descritos neste laudo foram executados conforme os padrões técnicos aplicáveis, e que as informações aqui apresentadas refletem fielmente as condições encontradas no momento da inspeção.</div>
    </div>

    <div class="sigs" style="margin-top:24px;">
      <div class="sig"><div class="line"></div><div class="name" style="font-weight:bold;color:#0A1932;">${esc(technicianName || "Técnico Responsável")}</div><div style="font-size:9px;color:#646E78;">Responsável Técnico</div></div>
      <div class="sig"><div class="line"></div><div class="name" style="font-weight:bold;color:#0A1932;">${esc(report.client?.name || "Representante do Cliente")}</div><div style="font-size:9px;color:#646E78;">Contratante</div></div>
    </div>
  </div>

  <!-- EQUIPMENT PAGES -->
  ${equipHtmlBlocks}
  ${legacyEquipHtml}

  <!-- RECOMMENDATIONS -->
  ${report.recommendation ? `<div data-pdf-section${equipment.length > 0 ? ' data-pdf-page-break="true"' : ""}>
    ${secTitle("Parecer Técnico e Recomendações")}
    <div class="diag-lbl">Recomendação</div><div class="diag-txt">${esc(report.recommendation)}</div>
  </div>` : ""}

  <!-- RISKS -->
  ${report.risks ? `<div data-pdf-section>
    ${secTitle("Análise de Risco")}
    <div class="risk-box">${esc(report.risks)}</div>
  </div>` : ""}

  <!-- CONCLUSION -->
  <div data-pdf-section>
    ${secTitle("Conclusão Técnica")}
    <div class="concl-status ${statusClass[overallStatus]}">${statusLabelMap[overallStatus]}</div>
    ${equipment.length > 0 ? `<div style="font-size:11px;color:#646E78;margin-top:6px;">${equipment.length} equipamento${equipment.length > 1 ? "s" : ""} inspecionado${equipment.length > 1 ? "s" : ""} neste atendimento.</div>` : ""}
    <div style="font-size:12px;margin-top:6px;">${esc(conclusionDescMap[overallStatus])}</div>
    ${report.conclusion ? `<div class="diag-lbl" style="margin-top:8px">Parecer Complementar</div><div class="diag-txt">${esc(report.conclusion)}</div>` : ""}
  </div>

  <!-- OBSERVATIONS -->
  ${report.observations ? `<div data-pdf-section>${secTitle("Observações Finais")}<div class="diag-txt">${esc(report.observations)}</div></div>` : ""}

  <!-- PHOTOS -->
  ${photosHtml}

  <!-- FINAL SIGNATURES -->
  <div data-pdf-section>
    <div class="sigs" style="margin-top:24px;">
      <div class="sig">
        <div class="line"></div>
        <div class="name" style="font-weight:bold;color:#0A1932;">${esc(technicianName || "Técnico Responsável")}</div>
        <div style="font-size:9px;color:#646E78;">Responsável Técnico</div>
      </div>
      <div class="sig">
        <div class="img-area">${sigB64 ? `<img src="${sigB64}" />` : ""}</div>
        <div class="line"></div>
        <div class="name" style="font-weight:bold;color:#0A1932;">${esc(signature?.signer_name || report.client?.name || "Representante do Cliente")}</div>
        ${signature?.signed_at ? `<div style="font-size:9px;color:#646E78;">Assinado digitalmente em ${format(new Date(signature.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>` : `<div style="font-size:9px;color:#646E78;">Assinatura do Cliente</div>`}
        ${signature?.ip_address ? `<div style="font-size:8px;color:#999;">IP: ${signature.ip_address}</div>` : ""}
      </div>
    </div>
  </div>
</div>`;

  // ── Render ──
  const footerParts = [organizationName, organizationCnpj ? `CNPJ: ${organizationCnpj}` : null, organizationPhone ? `Tel: ${organizationPhone}` : null].filter(Boolean).join("  ·  ");
  const pdf = await renderHtmlToPdf(html, { footerLeft: footerParts });

  // ── Upload to storage ──
  try {
    const blob = pdf.output("blob");
    const orgId = report.organization_id;
    if (orgId) {
      const { supabase } = await import("@/integrations/supabase/client");
      const storagePath = `os-pdfs/${orgId}/report_${report.id}.pdf`;
      const markerPath = `os-pdfs/${orgId}/report_${report.id}.official.json`;
      const markerPayload = {
        generator: OFFICIAL_REPORT_PDF_GENERATOR,
        layout: OFFICIAL_REPORT_PDF_LAYOUT,
        version: 1,
        report_id: report.id,
        service_id: report.service_id || report.quote_service_id || null,
        generated_at: new Date().toISOString(),
        sections: {
          header: true,
          client: true,
          conclusion: true,
          equipment: equipment.length > 0 || Boolean(report.equipment_type),
          photos: photos.length > 0,
          signatures: true,
        },
        validation: {
          hasCompanyData: Boolean(organizationName?.trim()),
          hasClientData: Boolean(report.client?.name?.trim()),
          hasConclusion: Boolean(report.conclusion || equipment.length > 0),
          hasSignaturesSection: true,
          photosCount: photos.length,
          equipmentCount: equipment.length,
        },
      };

      await supabase.storage
        .from("whatsapp-media")
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

      await supabase.storage
        .from("whatsapp-media")
        .upload(
          markerPath,
          new Blob([JSON.stringify(markerPayload)], { type: "application/json" }),
          { contentType: "application/json", upsert: true },
        );

      console.log("[PDF] Report PDF uploaded to storage:", storagePath);
    }
  } catch (e) {
    console.warn("[PDF] Failed to upload report PDF to storage:", e);
  }

  if (returnBlob) return pdf.output("blob");

  const fileName = `Laudo_Tecnico_${report.report_number.toString().padStart(4, "0")}_${report.client?.name?.replace(/\s+/g, "_") || ""}.pdf`;
  pdf.save(fileName);
}
