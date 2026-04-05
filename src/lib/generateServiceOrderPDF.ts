import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Service } from "@/hooks/useServices";
import type { ServiceItem } from "@/hooks/useServiceItems";
import { trackFBCustomEvent } from "@/lib/fbPixel";
import { supabase } from "@/integrations/supabase/client";
import { renderHtmlToPdf, loadImageAsBase64, fmtCurrency, esc, PDF_CSS } from "@/lib/pdf/renderHtmlToPdf";

export interface ServiceOrderData {
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  equipmentType: string;
  equipmentBrand: string;
  equipmentModel: string;
  solution: string;
  paymentMethod: string;
  paymentDueDate: string;
  paymentNotes: string;
}

export const OFFICIAL_SERVICE_PDF_GENERATOR = "official-service-pdf-html";
export const OFFICIAL_SERVICE_PDF_LAYOUT = "tecvo-service-order-html-v1";

interface ServiceOrderEquipment {
  id?: string;
  name?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  conditions?: string;
  defects?: string;
  solution?: string;
  technical_report?: string;
  warranty_terms?: string;
}

interface ServiceOrderPDFData {
  service: Service;
  items: ServiceItem[];
  equipmentList?: ServiceOrderEquipment[];
  organizationName: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationCnpj?: string;
  organizationLogo?: string;
  organizationWebsite?: string;
  organizationZipCode?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationSignature?: string;
  autoSignatureOS?: boolean;
  clientSignatureUrl?: string;
  orderData: ServiceOrderData;
  isFreePlan?: boolean;
  returnBlob?: boolean;
}

// ── Helpers ──

function secTitle(title: string) {
  return `<div class="sec-title"><div class="bar"></div><div class="bg"><span>${esc(title)}</span></div></div>`;
}

function fieldCell(label: string, value: string | null | undefined) {
  return `<td><span class="lbl">${esc(label)} </span><span class="val">${esc(value || "—")}</span></td>`;
}

// ── Main ──

export async function generateServiceOrderPDF({
  service,
  items,
  equipmentList = [],
  organizationName,
  organizationPhone,
  organizationEmail,
  organizationAddress,
  organizationCnpj,
  organizationLogo,
  organizationWebsite,
  organizationZipCode,
  organizationCity,
  organizationState,
  organizationSignature,
  autoSignatureOS = false,
  clientSignatureUrl,
  orderData,
  isFreePlan = false,
  returnBlob = false,
}: ServiceOrderPDFData): Promise<Blob | void> {
  trackFBCustomEvent("GeneratePDF", { os_number: service.quote_number });

  // Pre-load images
  const logoB64 = organizationLogo ? await loadImageAsBase64(organizationLogo) : null;
  const orgSigB64 = organizationSignature && autoSignatureOS ? await loadImageAsBase64(organizationSignature) : null;
  const clientSigB64 = clientSignatureUrl ? await loadImageAsBase64(clientSignatureUrl) : null;

  const osNumber = service.quote_number?.toString().padStart(4, "0") || "0001";
  const todayStr = format(new Date(), "dd/MM/yyyy");

  // ── Build company info lines ──
  const line1Parts: string[] = [];
  if (organizationCnpj) line1Parts.push(`CNPJ: ${organizationCnpj}`);
  if (organizationPhone) line1Parts.push(organizationPhone);
  if (organizationEmail) line1Parts.push(organizationEmail);

  const line2Parts: string[] = [];
  if (organizationAddress) line2Parts.push(organizationAddress);
  if (organizationCity) line2Parts.push(organizationCity);
  if (organizationState) line2Parts.push(organizationState);
  if (organizationZipCode) line2Parts.push(`CEP ${organizationZipCode}`);

  // ── Build address ──
  const hasServiceAddr = service.service_street || service.service_city;
  const clientAddr = hasServiceAddr
    ? [service.service_street, service.service_number, service.service_complement, service.service_neighborhood].filter(Boolean).join(", ")
    : (service.client?.address || [service.client?.street, service.client?.number, service.client?.complement, service.client?.neighborhood].filter(Boolean).join(", "));
  const clientCity = hasServiceAddr ? (service.service_city || "") : (service.client?.city || "");
  const clientState = hasServiceAddr ? (service.service_state || "") : (service.client?.state || "");
  const clientZip = hasServiceAddr ? (service.service_zip_code || "") : (service.client?.zip_code || "");

  // ── Normalize equipment ──
  const normalized = (equipmentList || [])
    .map(e => ({
      name: e.name?.trim() || "", brand: e.brand?.trim() || "", model: e.model?.trim() || "",
      serial_number: e.serial_number?.trim() || "", conditions: e.conditions?.trim() || "",
      defects: e.defects?.trim() || "", solution: e.solution?.trim() || "",
      technical_report: e.technical_report?.trim() || "", warranty_terms: e.warranty_terms?.trim() || "",
    }))
    .filter(e => e.name || e.brand || e.model || e.serial_number || e.conditions || e.defects || e.solution || e.technical_report || e.warranty_terms);

  const legacy: ServiceOrderEquipment[] =
    orderData.equipmentType || orderData.equipmentBrand || orderData.equipmentModel
      ? [{ name: orderData.equipmentType, brand: orderData.equipmentBrand, model: orderData.equipmentModel }]
      : [];

  const equipRender = normalized.length > 0 ? normalized : legacy;

  // ── Compute totals ──
  let grandTotal = 0;
  let totalDiscount = 0;
  items.forEach((item) => {
    const discount = item.discount || 0;
    const discAmt = item.discount_type === "percentage"
      ? (item.quantity * item.unit_price * discount / 100)
      : discount;
    grandTotal += item.quantity * item.unit_price - discAmt;
    totalDiscount += discAmt;
  });
  if (items.length === 0) grandTotal = service.value || 0;

  // ── Build HTML ──
  const html = `<style>${PDF_CSS}</style>
<div>
  <!-- HEADER -->
  <div data-pdf-section>
    <div class="accent-bar"></div>
    <div class="header-box">
      ${logoB64 ? `<img class="logo" src="${logoB64}" />` : ""}
      <div class="info">
        <div class="company-name">${esc(organizationName)}</div>
        ${line1Parts.length ? `<div class="detail">${esc(line1Parts.join("  ·  "))}</div>` : ""}
        ${line2Parts.length ? `<div class="detail">${esc(line2Parts.join(" – "))}</div>` : ""}
        ${organizationWebsite ? `<div class="website">${esc(organizationWebsite)}</div>` : ""}
      </div>
    </div>
  </div>

  <!-- TITLE -->
  <div data-pdf-section>
    <div class="title-bar">
      <h2>ORDEM DE SERVIÇO  Nº ${osNumber}</h2>
      <span class="date">${todayStr}</span>
    </div>
  </div>

  <!-- PERIOD -->
  ${(orderData.entryDate || orderData.exitDate) ? `
  <div data-pdf-section>
    ${secTitle("PERÍODO DE EXECUÇÃO")}
    <table class="grid"><tr>
      ${orderData.entryDate && orderData.entryTime ? fieldCell("Entrada:", `${orderData.entryDate} às ${orderData.entryTime}`) : "<td></td>"}
      ${orderData.exitDate && orderData.exitTime ? fieldCell("Saída:", `${orderData.exitDate} às ${orderData.exitTime}`) : "<td></td>"}
    </tr></table>
  </div>` : ""}

  <!-- CLIENT -->
  <div data-pdf-section>
    ${secTitle("DADOS DO CLIENTE")}
    <table class="grid">
      <tr>${fieldCell("Cliente:", service.client?.name)}${fieldCell("CNPJ/CPF:", service.client?.document)}</tr>
      <tr>${fieldCell("Endereço:", clientAddr)}${fieldCell("CEP:", clientZip)}</tr>
      <tr>${fieldCell("Cidade:", clientCity)}${fieldCell("Estado:", clientState)}</tr>
      <tr>${fieldCell("Telefone:", service.client?.phone)}${fieldCell("E-mail:", service.client?.email)}</tr>
    </table>
  </div>

  <!-- EQUIPMENT -->
  ${equipRender.length > 0 ? `
  <div data-pdf-section>
    ${secTitle("EQUIPAMENTOS")}
    ${equipRender.map((eq, idx) => {
      const eqTitle = eq.name || `Equipamento ${String(idx + 1).padStart(2, "0")}`;
      const details: { label: string; text: string }[] = [];
      if (eq.conditions) details.push({ label: "Condições", text: eq.conditions });
      if (eq.defects) details.push({ label: "Defeitos", text: eq.defects });
      if (eq.solution) details.push({ label: "Solução", text: eq.solution });
      if (eq.technical_report) details.push({ label: "Laudo técnico", text: eq.technical_report });
      if (eq.warranty_terms) details.push({ label: "Termos de garantia", text: eq.warranty_terms });
      return `
        <table class="eq-hdr-tbl">
          <tr><th>EQUIPAMENTO</th><th>MARCA</th><th>MODELO</th><th>SÉRIE</th></tr>
          <tr><td>${esc(eqTitle)}</td><td>${esc(eq.brand || "—")}</td><td>${esc(eq.model || "—")}</td><td>${esc(eq.serial_number || "—")}</td></tr>
        </table>
        ${details.map(d => `
          <div class="eq-detail-box">
            <div class="dlbl">${esc(d.label)}</div>
            <div class="dtxt">${esc(d.text)}</div>
          </div>
        `).join("")}
        <div style="height: 8px;"></div>
      `;
    }).join("")}
  </div>` : ""}

  <!-- DESCRIPTION -->
  ${orderData.solution ? `
  <div data-pdf-section>
    ${secTitle("DESCRIÇÃO DO SERVIÇO")}
    <div class="desc-box">${esc(orderData.solution)}</div>
  </div>` : ""}

  <!-- SERVICES TABLE -->
  <div data-pdf-section>
    ${secTitle("SERVIÇOS E PEÇAS")}
    <table class="tbl">
      <thead><tr>
        <th style="width:30px">#</th>
        <th>DESCRIÇÃO</th>
        <th class="r" style="width:50px">QTD</th>
        <th class="r" style="width:80px">VR. UNIT.</th>
        <th class="r" style="width:65px">DESC.</th>
        <th class="r" style="width:90px">SUBTOTAL</th>
      </tr></thead>
      <tbody>
        ${items.length > 0 ? items.map((item, i) => {
          const discount = item.discount || 0;
          const discAmt = item.discount_type === "percentage"
            ? (item.quantity * item.unit_price * discount / 100)
            : discount;
          const itemTotal = item.quantity * item.unit_price - discAmt;
          const displayName = item.name || item.description;
          const hasDetail = item.name && item.description && item.name !== item.description;
          return `<tr>
            <td>${i + 1}</td>
            <td>
              <div class="desc-main">${esc(displayName)}</div>
              ${hasDetail ? `<div class="desc-detail">${esc(item.description)}</div>` : ""}
            </td>
            <td class="r">${item.quantity.toFixed(2).replace(".", ",")}</td>
            <td class="r">${fmtCurrency(item.unit_price)}</td>
            <td class="r">${discAmt > 0 ? fmtCurrency(discAmt) : "—"}</td>
            <td class="r b">${fmtCurrency(itemTotal)}</td>
          </tr>`;
        }).join("") : `<tr><td colspan="6" style="font-style:italic;color:#646E78;">Nenhum item cadastrado</td></tr>`}
      </tbody>
    </table>

    <div class="total-wrap">
      <div class="total-summary">
        ${totalDiscount > 0 ? `
          <div class="row"><span class="lbl">Subtotal:</span><span class="val">${fmtCurrency(grandTotal + totalDiscount)}</span></div>
          <div class="row disc"><span class="lbl">Desconto:</span><span class="val">– ${fmtCurrency(totalDiscount)}</span></div>
        ` : ""}
        <div class="total-box"><span>TOTAL</span><span>${fmtCurrency(grandTotal)}</span></div>
      </div>
    </div>
  </div>

  <!-- PAYMENT -->
  ${(orderData.paymentMethod || orderData.paymentDueDate || orderData.paymentNotes) ? `
  <div data-pdf-section>
    ${secTitle("DADOS DO PAGAMENTO")}
    <div class="pay-box">
      ${orderData.paymentDueDate ? `<div><span class="lbl">Vencimento: </span><span class="val">${esc(orderData.paymentDueDate)}</span></div>` : ""}
      ${orderData.paymentMethod ? `<div><span class="lbl">Forma de pagamento: </span><span class="val">${esc(orderData.paymentMethod)}</span></div>` : ""}
      ${orderData.paymentNotes ? `<div style="width:100%"><span class="lbl">Obs: </span><span class="val">${esc(orderData.paymentNotes)}</span></div>` : ""}
    </div>
  </div>` : ""}

  <!-- NOTES -->
  ${service.notes ? `
  <div data-pdf-section>
    ${secTitle("OBSERVAÇÕES")}
    <div class="notes-box">${esc(service.notes)}</div>
  </div>` : ""}

  <!-- SIGNATURES -->
  <div data-pdf-section>
    <div class="sigs">
      <div class="sig">
        <div class="top-lbl">Assinatura do Cliente</div>
        <div class="img-area">${clientSigB64 ? `<img src="${clientSigB64}" />` : ""}</div>
        <div class="line"></div>
        <div class="name">${esc(service.client?.name || "Cliente")}</div>
      </div>
      <div class="sig">
        <div class="top-lbl">Assinatura da Empresa</div>
        <div class="img-area">${orgSigB64 ? `<img src="${orgSigB64}" />` : ""}</div>
        <div class="line"></div>
        <div class="name">${esc(organizationName)}</div>
      </div>
    </div>
    ${orgSigB64 ? `<div class="sig-clause">A assinatura da empresa neste documento representa apenas a emissão formal da Ordem de Serviço e não confirma a execução do serviço, que depende da realização e aceite final do cliente.</div>` : ""}
  </div>
</div>`;

  // ── Render ──
  const pdf = await renderHtmlToPdf(html, {
    footerLeft: "Documento gerado pela Tecvo · tecvo.com.br",
  });

  // ── Upload to storage ──
  try {
    const blob = pdf.output("blob");
    const orgId = service.organization_id;
    if (orgId) {
      const storagePath = `os-pdfs/${orgId}/${service.id}.pdf`;
      const markerPath = `os-pdfs/${orgId}/${service.id}.official.json`;
      const markerPayload = {
        generator: OFFICIAL_SERVICE_PDF_GENERATOR,
        layout: OFFICIAL_SERVICE_PDF_LAYOUT,
        version: 2,
        source: "panel_official",
        document_type: service.document_type || "service_order",
        service_id: service.id,
        quote_number: service.quote_number || null,
        generated_at: new Date().toISOString(),
        sections: {
          header: true,
          company: true,
          client: true,
          items_table: true,
          total: true,
          signatures: true,
          equipment: equipRender.length > 0,
          description: Boolean(orderData.solution),
          payment: Boolean(orderData.paymentMethod || orderData.paymentDueDate || orderData.paymentNotes),
          notes: Boolean(service.notes),
        },
        validation: {
          hasOfficialHeader: true,
          hasCompanyData: Boolean(organizationName?.trim()),
          hasClientData: Boolean(service.client?.name?.trim()),
          hasItemsTable: true,
          hasTotal: Number.isFinite(grandTotal),
          hasSignaturesSection: true,
          hasCommercialValue: grandTotal > 0 || Number(service.value || 0) > 0,
          itemsCount: items.length,
        },
      };

      await supabase.storage
        .from("whatsapp-media")
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

      await supabase.storage
        .from("whatsapp-media")
        .upload(
          markerPath,
          new Blob([
            JSON.stringify(markerPayload),
          ], { type: "application/json" }),
          { contentType: "application/json", upsert: true }
        );
    }
  } catch (e) {
    console.warn("[PDF] Failed to upload PDF to storage:", e);
  }

  if (returnBlob) {
    return pdf.output("blob");
  }

  const fileName = `OS-${osNumber}-${(service.client?.name || "cliente").replace(/\s+/g, "_")}.pdf`;
  pdf.save(fileName);
}
