import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Service } from "@/hooks/useServices";
import type { ServiceItem } from "@/hooks/useServiceItems";
import { SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { renderHtmlToPdf, loadImageAsBase64, fmtCurrency, esc, PDF_CSS } from "@/lib/pdf/renderHtmlToPdf";

interface QuotePDFData {
  service: Service;
  items: ServiceItem[];
  organizationName: string;
  organizationCnpj?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  organizationLogo?: string;
  organizationWebsite?: string;
  organizationZipCode?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationSignature?: string;
  autoSignatureOS?: boolean;
  isFreePlan?: boolean;
}

async function loadImageAsBase64Local(url: string): Promise<string | null> {
  return loadImageAsBase64(url);
}

function secTitle(t: string) {
  return `<div class="sec-title"><div class="bar"></div><div class="bg"><span>${esc(t)}</span></div></div>`;
}

export async function generateQuotePDF({
  service, items, organizationName, organizationCnpj, organizationPhone,
  organizationEmail, organizationAddress, organizationLogo, organizationWebsite,
  organizationZipCode, organizationCity, organizationState, organizationSignature,
  autoSignatureOS = false, isFreePlan = false,
}: QuotePDFData) {
  const logoB64 = organizationLogo ? await loadImageAsBase64Local(organizationLogo) : null;
  const orgSigB64 = organizationSignature && autoSignatureOS ? await loadImageAsBase64Local(organizationSignature) : null;

  const quoteNum = service.quote_number?.toString().padStart(4, "0") || "0001";
  const todayStr = format(new Date(), "dd/MM/yyyy");

  const line1: string[] = [];
  if (organizationCnpj) line1.push(`CNPJ: ${organizationCnpj}`);
  if (organizationPhone) line1.push(organizationPhone);
  if (organizationEmail) line1.push(organizationEmail);

  const line2: string[] = [];
  if (organizationAddress) line2.push(organizationAddress);
  if (organizationCity) line2.push(organizationCity);
  if (organizationState) line2.push(organizationState);
  if (organizationZipCode) line2.push(`CEP ${organizationZipCode}`);

  const clientAddress = service.client?.address ||
    [service.client?.street, service.client?.number, service.client?.neighborhood].filter(Boolean).join(", ");
  const cityState = [service.client?.city, service.client?.state].filter(Boolean).join(" - ");

  let grandTotal = 0;
  let totalDiscount = 0;
  items.forEach((item) => {
    const disc = item.discount || 0;
    const discAmt = item.discount_type === "percentage" ? (item.quantity * item.unit_price * disc / 100) : disc;
    grandTotal += item.quantity * item.unit_price - discAmt;
    totalDiscount += discAmt;
  });
  if (items.length === 0) grandTotal = service.value || 0;

  const validityDays = service.quote_validity_days || 30;
  const validUntil = format(addDays(new Date(), validityDays), "dd/MM/yyyy");
  const scheduledDate = service.scheduled_date ? format(new Date(service.scheduled_date), "dd/MM/yyyy", { locale: ptBR }) : "";

  const html = `<style>${PDF_CSS}</style>
<div>
  <div data-pdf-section>
    <div class="accent-bar"></div>
    <div class="header-box">
      ${logoB64 ? `<img class="logo" src="${logoB64}" />` : ""}
      <div class="info">
        <div class="company-name">${esc(organizationName)}</div>
        ${line1.length ? `<div class="detail">${esc(line1.join("  ·  "))}</div>` : ""}
        ${line2.length ? `<div class="detail">${esc(line2.join(" - "))}</div>` : ""}
        ${organizationWebsite ? `<div class="website">${esc(organizationWebsite)}</div>` : ""}
      </div>
    </div>
  </div>

  <div data-pdf-section>
    <div class="title-bar">
      <h2>ORÇAMENTO Nº ${quoteNum}</h2>
      <span class="date">${todayStr}</span>
    </div>
  </div>

  <div data-pdf-section>
    ${secTitle("DADOS DO CLIENTE")}
    <table class="grid">
      <tr><td><span class="lbl">Cliente: </span><span class="val">${esc(service.client?.name)}</span></td><td><span class="lbl">Telefone: </span><span class="val">${esc(service.client?.phone)}</span></td></tr>
      <tr><td><span class="lbl">Endereço: </span><span class="val">${esc(clientAddress)}</span></td><td><span class="lbl">E-mail: </span><span class="val">${esc(service.client?.email)}</span></td></tr>
      <tr><td><span class="lbl">Cidade: </span><span class="val">${esc(cityState)}</span></td><td><span class="lbl">CEP: </span><span class="val">${esc(service.client?.zip_code)}</span></td></tr>
    </table>
  </div>

  <div data-pdf-section>
    ${secTitle("INFORMAÇÕES DO SERVIÇO")}
    <table class="grid"><tr>
      <td><span class="lbl">Tipo: </span><span class="val">${esc(SERVICE_TYPE_LABELS[service.service_type])}</span></td>
      ${scheduledDate ? `<td><span class="lbl">Data Prevista: </span><span class="val">${scheduledDate}</span></td>` : "<td></td>"}
    </tr></table>
  </div>

  <div data-pdf-section>
    ${secTitle("ITENS DO ORÇAMENTO")}
    <table class="tbl">
      <thead><tr>
        <th style="width:30px">#</th><th>DESCRIÇÃO</th>
        <th class="r" style="width:50px">QTD</th><th class="r" style="width:80px">VR. UNIT</th>
        <th class="r" style="width:65px">DESC</th><th class="r" style="width:90px">SUBTOTAL</th>
      </tr></thead>
      <tbody>
      ${items.length > 0 ? items.map((item, i) => {
        const disc = item.discount || 0;
        const discAmt = item.discount_type === "percentage" ? (item.quantity * item.unit_price * disc / 100) : disc;
        const itemTotal = item.quantity * item.unit_price - discAmt;
        const displayName = item.name || item.description;
        const hasDetail = item.name && item.description && item.name !== item.description;
        return `<tr>
          <td>${i + 1}</td>
          <td><div class="desc-main">${esc(displayName)}</div>${hasDetail ? `<div class="desc-detail">${esc(item.description)}</div>` : ""}</td>
          <td class="r">${item.quantity.toFixed(2).replace(".", ",")}</td>
          <td class="r">${fmtCurrency(item.unit_price)}</td>
          <td class="r">${discAmt > 0 ? fmtCurrency(discAmt) : "-"}</td>
          <td class="r b">${fmtCurrency(itemTotal)}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="6" style="font-style:italic;color:#646E78;">Nenhum item cadastrado</td></tr>`}
      </tbody>
    </table>
    <div class="total-wrap"><div class="total-summary">
      ${totalDiscount > 0 ? `
        <div class="row"><span class="lbl">Subtotal:</span><span class="val">${fmtCurrency(grandTotal + totalDiscount)}</span></div>
        <div class="row disc"><span class="lbl">Desconto:</span><span class="val">– ${fmtCurrency(totalDiscount)}</span></div>
      ` : ""}
      <div class="total-box"><span>TOTAL</span><span>${fmtCurrency(grandTotal)}</span></div>
    </div></div>
  </div>

  ${service.payment_conditions ? `
  <div data-pdf-section>
    ${secTitle("CONDIÇÕES DE PAGAMENTO")}
    <div class="desc-box">${esc(service.payment_conditions)}</div>
  </div>` : ""}

  <div data-pdf-section>
    <div style="font-size:11px;font-style:italic;color:#646E78;margin-top:10px;">
      Este orçamento é válido por ${validityDays} dias (até ${validUntil})
    </div>
  </div>

  <div data-pdf-section>
    <div class="sigs">
      <div class="sig">
        <div class="img-area"></div>
        <div class="line"></div>
        <div class="name">Assinatura do cliente</div>
      </div>
      <div class="sig">
        <div class="img-area">${orgSigB64 ? `<img src="${orgSigB64}" />` : ""}</div>
        <div class="line"></div>
        <div class="name">${esc(organizationName || "Assinatura da empresa")}</div>
      </div>
    </div>
    ${orgSigB64 ? `<div class="sig-clause">A assinatura da empresa neste documento representa apenas a emissão formal do Orçamento e não confirma a execução do serviço, que depende da aprovação e aceite final do cliente.</div>` : ""}
  </div>
</div>`;

  const pdf = await renderHtmlToPdf(html, {
    footerLeft: "Orçamento gerado pelo Tecvo",
  });

  const fileName = `orcamento-${quoteNum}-${service.client?.name?.replace(/\s+/g, "_") || "cliente"}.pdf`;
  pdf.save(fileName);
}
