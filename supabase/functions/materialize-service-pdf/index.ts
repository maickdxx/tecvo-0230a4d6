import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Color palette (matches frontend) ──
const primary = { r: 25, g: 95, b: 170 };
const primaryDark = { r: 18, g: 70, b: 130 };
const primaryLight = { r: 235, g: 244, b: 255 };
const textDark = { r: 30, g: 34, b: 38 };
const textMuted = { r: 100, g: 110, b: 120 };
const borderLight = { r: 215, g: 220, b: 228 };
const rowEven = { r: 248, g: 249, b: 252 };
const totalBg = { r: 20, g: 80, b: 150 };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { serviceId, organizationId } = await req.json();
    if (!serviceId || !organizationId) {
      return new Response(JSON.stringify({ error: "serviceId and organizationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[MATERIALIZE-PDF] Starting for service=${serviceId} org=${organizationId}`);

    // ── Set pdf_status = generating ──
    await supabase
      .from("services")
      .update({ pdf_status: "generating" })
      .eq("id", serviceId)
      .eq("organization_id", organizationId);

    // ── Fetch all needed data ──
    const [serviceRes, orgRes, itemsRes] = await Promise.all([
      supabase
        .from("services")
        .select("*, client:clients(name, phone, whatsapp, email, document, street, number, complement, neighborhood, city, state, zip_code, person_type, company_name, contact_name)")
        .eq("id", serviceId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("organizations")
        .select("name, phone, email, address, cnpj_cpf, logo_url, website, zip_code, city, state")
        .eq("id", organizationId)
        .single(),
      supabase
        .from("service_items")
        .select("description, quantity, unit_price, total_price")
        .eq("service_id", serviceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

    if (serviceRes.error || !serviceRes.data) {
      console.error("[MATERIALIZE-PDF] Service not found:", serviceRes.error);
      await supabase.from("services").update({ pdf_status: "failed" }).eq("id", serviceId).eq("organization_id", organizationId);
      return new Response(JSON.stringify({ error: "Service not found", status: "failed" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = serviceRes.data;
    const org = orgRes.data || {};
    const items = itemsRes.data || [];
    const client = service.client || {};
    const osNumber = String(service.quote_number || 0).padStart(4, "0");
    const docType = service.document_type === "quote" ? "ORÇAMENTO" : "ORDEM DE SERVIÇO";

    // ── Generate PDF ──
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    const FOOTER_RESERVED = 16;
    const usableHeight = pageHeight - FOOTER_RESERVED;

    const ensureSpace = (needed: number) => {
      if (yPos + needed > usableHeight) {
        doc.addPage();
        yPos = margin;
      }
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(14);
      yPos += 3;
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.rect(margin, yPos, 3, 8, "F");
      doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
      doc.rect(margin + 3, yPos, contentWidth - 3, 8, "F");
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.setLineWidth(0.2);
      doc.rect(margin, yPos, contentWidth, 8, "S");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(title, margin + 7, yPos + 5.5);
      yPos += 10;
    };

    const drawField = (label: string, value: string, x: number, y: number) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(7.5);
      doc.text(label, x, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(8);
      doc.text(value || "—", x + labelW + 2, y);
    };

    // ═══════ HEADER ═══════
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(margin, yPos, contentWidth, 2.5, "F");
    yPos += 2.5;

    const headerH = 28;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, headerH, "FD");

    // Company name
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(org.name || "Empresa", margin + 6, yPos + 9);

    // Company details
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    const line1Parts: string[] = [];
    if (org.cnpj_cpf) line1Parts.push(`CNPJ: ${org.cnpj_cpf}`);
    if (org.phone) line1Parts.push(org.phone);
    if (org.email) line1Parts.push(org.email);
    if (line1Parts.length) doc.text(line1Parts.join("  ·  "), margin + 6, yPos + 15);

    const line2Parts: string[] = [];
    if (org.address) line2Parts.push(org.address);
    if (org.city) line2Parts.push(org.city);
    if (org.state) line2Parts.push(org.state);
    if (org.zip_code) line2Parts.push(`CEP ${org.zip_code}`);
    if (line2Parts.length) doc.text(line2Parts.join(" – ").substring(0, 90), margin + 6, yPos + 20);

    yPos += headerH + 5;

    // ═══════ DOCUMENT TITLE ═══════
    const titleH = 14;
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.roundedRect(margin, yPos, contentWidth, titleH, 1.5, 1.5, "F");
    doc.setFillColor(primaryDark.r, primaryDark.g, primaryDark.b);
    doc.rect(margin, yPos + titleH - 2, contentWidth, 2, "F");

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${docType} Nº ${osNumber}`, pageWidth / 2, yPos + 9, { align: "center" });
    yPos += titleH + 6;

    // ═══════ CLIENT INFO ═══════
    drawSectionTitle("DADOS DO CLIENTE");
    ensureSpace(20);
    const leftX = margin + 4;
    const rightX = margin + contentWidth / 2 + 4;

    drawField("Cliente: ", client.name || "—", leftX, yPos);
    drawField("Telefone: ", client.phone || client.whatsapp || "—", rightX, yPos);
    yPos += 6;
    drawField("Documento: ", client.document || "—", leftX, yPos);
    drawField("E-mail: ", client.email || "—", rightX, yPos);
    yPos += 6;

    const addrParts: string[] = [];
    if (client.street) addrParts.push(client.street);
    if (client.number) addrParts.push(client.number);
    if (client.complement) addrParts.push(client.complement);
    if (client.neighborhood) addrParts.push(client.neighborhood);
    const addr = addrParts.join(", ");
    if (addr) {
      drawField("Endereço: ", addr, leftX, yPos);
      yPos += 6;
    }
    const cityState: string[] = [];
    if (client.city) cityState.push(client.city);
    if (client.state) cityState.push(client.state);
    if (client.zip_code) cityState.push(`CEP ${client.zip_code}`);
    if (cityState.length) {
      drawField("Cidade: ", cityState.join(" – "), leftX, yPos);
      yPos += 6;
    }

    yPos += 2;

    // ═══════ SERVICE INFO ═══════
    drawSectionTitle("DADOS DO SERVIÇO");
    ensureSpace(24);

    drawField("Data agendada: ", formatDateTime(service.scheduled_date), leftX, yPos);
    drawField("Status: ", service.status || "—", rightX, yPos);
    yPos += 6;
    drawField("Tipo de serviço: ", service.service_type || "—", leftX, yPos);
    drawField("Valor: ", formatCurrency(service.value || 0), rightX, yPos);
    yPos += 6;

    if (service.description) {
      drawField("Descrição: ", "", leftX, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(8);
      const descLines = doc.splitTextToSize(service.description, contentWidth - 10);
      for (const line of descLines) {
        ensureSpace(5);
        doc.text(line, leftX, yPos);
        yPos += 4.5;
      }
    }

    yPos += 4;

    // ═══════ ITEMS TABLE ═══════
    if (items.length > 0) {
      drawSectionTitle("ITENS / SERVIÇOS");
      ensureSpace(12);

      // Table header
      const colX = [margin, margin + contentWidth * 0.5, margin + contentWidth * 0.7, margin + contentWidth * 0.85];
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.rect(margin, yPos, contentWidth, 7, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Descrição", colX[0] + 3, yPos + 5);
      doc.text("Qtd", colX[1] + 3, yPos + 5);
      doc.text("Unit.", colX[2] + 3, yPos + 5);
      doc.text("Total", colX[3] + 3, yPos + 5);
      yPos += 8;

      let grandTotal = 0;
      items.forEach((item: any, i: number) => {
        ensureSpace(7);
        if (i % 2 === 0) {
          doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
          doc.rect(margin, yPos - 1, contentWidth, 6, "F");
        }
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.text((item.description || "—").substring(0, 45), colX[0] + 3, yPos + 3);
        doc.text(String(item.quantity || 1), colX[1] + 3, yPos + 3);
        doc.text(formatCurrency(item.unit_price || 0), colX[2] + 3, yPos + 3);
        const rowTotal = item.total_price || (item.quantity || 1) * (item.unit_price || 0);
        doc.text(formatCurrency(rowTotal), colX[3] + 3, yPos + 3);
        grandTotal += rowTotal;
        yPos += 6;
      });

      // Total row
      ensureSpace(9);
      doc.setFillColor(totalBg.r, totalBg.g, totalBg.b);
      doc.rect(margin, yPos, contentWidth, 8, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("TOTAL", colX[0] + 3, yPos + 5.5);
      doc.text(formatCurrency(grandTotal || service.value || 0), colX[3] + 3, yPos + 5.5);
      yPos += 12;
    }

    // ═══════ FOOTER ON ALL PAGES ═══════
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = pageHeight - 8;
      doc.setDrawColor(primary.r, primary.g, primary.b);
      doc.setLineWidth(0.4);
      doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text("Documento gerado pela Tecvo · tecvo.com.br", margin, footerY);
      doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
    }

    // ── Upload to storage ──
    const pdfArrayBuffer = doc.output("arraybuffer");
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);
    const storagePath = `os-pdfs/${organizationId}/${serviceId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, pdfUint8, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("[MATERIALIZE-PDF] Upload failed:", uploadError);
      await supabase.from("services").update({ pdf_status: "failed" }).eq("id", serviceId).eq("organization_id", organizationId);
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message, status: "failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify file exists
    const { data: verifyFile } = await supabase.storage
      .from("whatsapp-media")
      .createSignedUrl(storagePath, 60);

    if (!verifyFile?.signedUrl) {
      console.error("[MATERIALIZE-PDF] Verification failed - file not found after upload");
      await supabase.from("services").update({ pdf_status: "failed" }).eq("id", serviceId).eq("organization_id", organizationId);
      return new Response(JSON.stringify({ error: "Verification failed", status: "failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Set pdf_status = ready ──
    await supabase
      .from("services")
      .update({ pdf_status: "ready", pdf_generated_at: new Date().toISOString() })
      .eq("id", serviceId)
      .eq("organization_id", organizationId);

    console.log(`[MATERIALIZE-PDF] Success: ${storagePath}`);

    return new Response(JSON.stringify({
      status: "ready",
      path: storagePath,
      serviceId,
      osNumber,
      docType,
      clientName: client.name || "Cliente",
      clientPhone: client.phone || client.whatsapp || null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[MATERIALIZE-PDF] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", status: "failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
