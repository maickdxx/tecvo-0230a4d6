import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Premium color palette (matches frontend exactly) ──
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
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return ""; }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
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

    // ── Fetch all needed data in parallel ──
    const [serviceRes, orgRes, itemsRes, equipRes, sigRes] = await Promise.all([
      supabase
        .from("services")
        .select("*, client:clients(name, phone, whatsapp, email, document, street, number, complement, neighborhood, city, state, zip_code, person_type, company_name, contact_name, address)")
        .eq("id", serviceId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("organizations")
        .select("name, phone, email, address, cnpj_cpf, logo_url, website, zip_code, city, state, signature_url, auto_signature_os")
        .eq("id", organizationId)
        .single(),
      supabase
        .from("service_items")
        .select("name, description, quantity, unit_price, discount, discount_type")
        .eq("service_id", serviceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("service_equipment")
        .select("name, brand, model, serial_number, conditions, defects, solution, technical_report, warranty_terms")
        .eq("service_id", serviceId)
        .order("created_at", { ascending: true }),
      supabase
        .from("service_signatures")
        .select("signature_url")
        .eq("service_id", serviceId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (serviceRes.error || !serviceRes.data) {
      console.error("[MATERIALIZE-PDF] Service not found:", serviceRes.error);
      await supabase.from("services").update({ pdf_status: "failed" }).eq("id", serviceId).eq("organization_id", organizationId);
      return new Response(JSON.stringify({ error: "Service not found", status: "failed" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = serviceRes.data as any;
    const org = (orgRes.data || {}) as any;
    const items = (itemsRes.data || []) as any[];
    const equipment = (equipRes.data || []) as any[];
    const clientSigUrl = (sigRes?.data as any)?.signature_url || null;
    const client = service.client || {};
    const osNumber = String(service.quote_number || 0).padStart(4, "0");
    const isQuote = service.document_type === "quote";
    const docTitle = isQuote ? "ORÇAMENTO" : "ORDEM DE SERVIÇO";

    // ── Generate PDF (matching frontend layout exactly) ──
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    const FOOTER_RESERVED = 16;
    const usableHeight = pageHeight - FOOTER_RESERVED;
    const halfWidth = contentWidth / 2;
    const leftX = margin + 4;
    const rightX = margin + halfWidth + 4;

    const ensureSpace = (needed: number) => {
      if (yPos + needed > usableHeight) {
        doc.addPage();
        yPos = margin;
      }
    };

    // ── Helper: draw a field label + value ──
    const drawField = (label: string, value: string | null | undefined, x: number, y: number, maxW?: number) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(7.5);
      doc.text(label, x, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(8);
      const val = value || "—";
      if (maxW) {
        const truncated = doc.getTextWidth(val) > maxW - labelW - 4
          ? val.substring(0, Math.floor((maxW - labelW - 8) / doc.getTextWidth("a"))) + "..."
          : val;
        doc.text(truncated, x + labelW + 2, y);
      } else {
        doc.text(val, x + labelW + 2, y);
      }
    };

    // ── Helper: section title bar ──
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

    // ═══════════════════════════════════════════
    //  HEADER — Logo + Company Info
    // ═══════════════════════════════════════════
    const headerH = 32;
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(margin, yPos, contentWidth, 2.5, "F");
    yPos += 2.5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, headerH, "FD");

    let logoEndX = margin + 6;
    if (org.logo_url) {
      const logoData = await loadImageAsBase64(org.logo_url);
      if (logoData) {
        try {
          doc.addImage(logoData, "AUTO", margin + 5, yPos + 3, 26, 26);
          logoEndX = margin + 34;
        } catch { /* ignore */ }
      }
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(org.name || "Empresa", logoEndX, yPos + 9);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);

    const line1Parts: string[] = [];
    if (org.cnpj_cpf) line1Parts.push(`CNPJ: ${org.cnpj_cpf}`);
    if (org.phone) line1Parts.push(org.phone);
    if (org.email) line1Parts.push(org.email);
    if (line1Parts.length) doc.text(line1Parts.join("  ·  "), logoEndX, yPos + 15);

    const line2Parts: string[] = [];
    if (org.address) line2Parts.push(org.address);
    if (org.city) line2Parts.push(org.city);
    if (org.state) line2Parts.push(org.state);
    if (org.zip_code) line2Parts.push(`CEP ${org.zip_code}`);
    if (line2Parts.length) {
      const addr = line2Parts.join(" – ");
      const maxAddrW = pageWidth - margin - logoEndX - 6;
      const truncAddr = doc.getTextWidth(addr) > maxAddrW ? addr.substring(0, 85) + "..." : addr;
      doc.text(truncAddr, logoEndX, yPos + 20);
    }

    if (org.website) {
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(org.website, logoEndX, yPos + 25);
    }

    yPos += headerH + 5;

    // ═══════════════════════════════════════════
    //  DOCUMENT TITLE
    // ═══════════════════════════════════════════
    const titleH = 16;
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.roundedRect(margin, yPos, contentWidth, titleH, 1.5, 1.5, "F");
    doc.setFillColor(primaryDark.r, primaryDark.g, primaryDark.b);
    doc.rect(margin, yPos + titleH - 2, contentWidth, 2, "F");

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${docTitle}  Nº ${osNumber}`, margin + 8, yPos + 10.5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const todayStr = formatDate(new Date().toISOString());
    doc.text(todayStr, pageWidth - margin - 8, yPos + 10.5, { align: "right" });

    yPos += titleH + 6;

    // ═══════════════════════════════════════════
    //  EXECUTION PERIOD
    // ═══════════════════════════════════════════
    const entryDate = service.entry_date ? formatDate(service.entry_date) : "";
    const entryTime = service.entry_time || "";
    const exitDate = service.exit_date ? formatDate(service.exit_date) : "";
    const exitTime = service.exit_time || "";
    const hasEntry = entryDate && entryTime;
    const hasExit = exitDate && exitTime;

    if (hasEntry || hasExit) {
      drawSectionTitle("PERÍODO DE EXECUÇÃO");
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.setLineWidth(0.2);
      doc.rect(margin, yPos, contentWidth, 9, "S");
      doc.setFontSize(8);
      if (hasEntry) drawField("Entrada:", `${entryDate} às ${entryTime}`, leftX, yPos + 6);
      if (hasExit) drawField("Saída:", `${exitDate} às ${exitTime}`, rightX, yPos + 6);
      yPos += 12;
    }

    // ═══════════════════════════════════════════
    //  CLIENT DATA
    // ═══════════════════════════════════════════
    drawSectionTitle("DADOS DO CLIENTE");

    // Build address (service address takes precedence)
    const hasServiceAddr = service.service_street || service.service_city;
    const clientAddr = hasServiceAddr
      ? [service.service_street, service.service_number, service.service_complement, service.service_neighborhood].filter(Boolean).join(", ")
      : (client.address || [client.street, client.number, client.complement, client.neighborhood].filter(Boolean).join(", "));
    const clientCity = hasServiceAddr ? (service.service_city || "") : (client.city || "");
    const clientState = hasServiceAddr ? (service.service_state || "") : (client.state || "");
    const clientZip = hasServiceAddr ? (service.service_zip_code || "") : (client.zip_code || "");

    // Calculate address multiline height
    doc.setFontSize(8);
    const addrLabelW = doc.getTextWidth("Endereço: ");
    const addrMaxW = halfWidth - 10;
    const addrLines = doc.splitTextToSize(clientAddr || "", addrMaxW - addrLabelW);
    const addrRowH = Math.max(8, 4 + addrLines.length * 3.5);

    const rows = [
      { lLabel: "Cliente:", lVal: client.name || "", rLabel: "CNPJ/CPF:", rVal: client.document || "", h: 8 },
      { lLabel: "Endereço:", lVal: clientAddr || "", rLabel: "CEP:", rVal: clientZip, h: addrRowH, multiline: true },
      { lLabel: "Cidade:", lVal: clientCity, rLabel: "Estado:", rVal: clientState, h: 8 },
      { lLabel: "Telefone:", lVal: client.phone || "", rLabel: "E-mail:", rVal: client.email || "", h: 8 },
    ];

    const boxH = rows.reduce((s: number, r: any) => s + r.h, 0);
    ensureSpace(boxH + 4);

    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.setLineWidth(0.2);
    doc.rect(margin, yPos, contentWidth, boxH, "S");
    doc.line(margin + halfWidth, yPos, margin + halfWidth, yPos + boxH);

    let cellY = yPos;
    rows.forEach((row: any, i: number) => {
      if (i > 0) doc.line(margin, cellY, margin + contentWidth, cellY);
      const ty = cellY + 5.5;
      if (row.multiline) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(row.lLabel, leftX, ty);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.text(addrLines, leftX + addrLabelW + 2, ty);
      } else {
        drawField(row.lLabel, row.lVal, leftX, ty);
      }
      drawField(row.rLabel, row.rVal, rightX, ty);
      cellY += row.h;
    });

    yPos += boxH + 5;

    // ═══════════════════════════════════════════
    //  EQUIPMENT
    // ═══════════════════════════════════════════
    const normalized = (equipment || [])
      .map((e: any) => ({
        name: e.name?.trim() || "", brand: e.brand?.trim() || "", model: e.model?.trim() || "",
        serial_number: e.serial_number?.trim() || "", conditions: e.conditions?.trim() || "",
        defects: e.defects?.trim() || "", solution: e.solution?.trim() || "",
        technical_report: e.technical_report?.trim() || "", warranty_terms: e.warranty_terms?.trim() || "",
      }))
      .filter((e: any) => e.name || e.brand || e.model || e.serial_number || e.conditions || e.defects || e.solution || e.technical_report || e.warranty_terms);

    if (normalized.length > 0) {
      drawSectionTitle("EQUIPAMENTOS");

      normalized.forEach((eq: any, idx: number) => {
        const eqTitle = eq.name || `Equipamento ${String(idx + 1).padStart(2, "0")}`;
        const textAreaW = contentWidth - 8;
        const headerRowH = 13;

        const details: Array<{ label: string; lines: string[] }> = [];
        const fields: [string, string][] = [
          ["Condições", eq.conditions], ["Defeitos", eq.defects],
          ["Solução", eq.solution], ["Laudo técnico", eq.technical_report],
          ["Termos de garantia", eq.warranty_terms],
        ];
        fields.forEach(([label, text]) => {
          if (text) details.push({ label, lines: doc.setFontSize(8).splitTextToSize(text, textAreaW) });
        });

        let blockH = headerRowH;
        details.forEach((s: any) => { blockH += 5 + s.lines.length * 3.5 + 2; });
        blockH += 2;

        if (yPos + blockH > usableHeight) {
          doc.addPage(); yPos = margin;
          drawSectionTitle("EQUIPAMENTOS (CONT.)");
        }

        // Header row
        const col1 = contentWidth * 0.35, col2 = contentWidth * 0.25, col3 = contentWidth * 0.25, col4 = contentWidth * 0.15;
        doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
        doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
        doc.setLineWidth(0.2);
        doc.rect(margin, yPos, contentWidth, headerRowH, "FD");

        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text("EQUIPAMENTO", margin + 3, yPos + 4);
        doc.text("MARCA", margin + col1 + 3, yPos + 4);
        doc.text("MODELO", margin + col1 + col2 + 3, yPos + 4);
        doc.text("SÉRIE", margin + col1 + col2 + col3 + 3, yPos + 4);

        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.text(eqTitle, margin + 3, yPos + 10);
        doc.text(eq.brand || "—", margin + col1 + 3, yPos + 10);
        doc.text(eq.model || "—", margin + col1 + col2 + 3, yPos + 10);
        doc.text(eq.serial_number || "—", margin + col1 + col2 + col3 + 3, yPos + 10);

        [col1, col1 + col2, col1 + col2 + col3].forEach((x: number) => doc.line(margin + x, yPos, margin + x, yPos + headerRowH));

        let sY = yPos + headerRowH;

        details.forEach((section: any) => {
          const sH = 5 + section.lines.length * 3.5 + 2;
          if (sY + sH > usableHeight) { doc.addPage(); sY = margin; }
          doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
          doc.rect(margin, sY, contentWidth, sH, "S");
          doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(primary.r, primary.g, primary.b);
          doc.text(section.label, margin + 4, sY + 4.5);
          doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b); doc.setFontSize(8);
          doc.text(section.lines, margin + 4, sY + 9);
          sY += sH;
        });

        yPos = sY + 3;
      });
      yPos += 2;
    }

    // ═══════════════════════════════════════════
    //  SOLUTION / DESCRIPTION
    // ═══════════════════════════════════════════
    if (service.description) {
      const solLines = doc.setFontSize(8).splitTextToSize(service.description, contentWidth - 10);
      const solH = Math.max(solLines.length * 4 + 8, 14);
      drawSectionTitle("DESCRIÇÃO DO SERVIÇO");
      ensureSpace(solH + 2);
      doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.rect(margin, yPos, contentWidth, solH, "FD");
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(solLines, margin + 5, yPos + 6);
      yPos += solH + 4;
    }

    // ═══════════════════════════════════════════
    //  SERVICES TABLE
    // ═══════════════════════════════════════════
    drawSectionTitle("SERVIÇOS E PEÇAS");

    const colW = [10, 70, 16, 28, 22, 34];

    const drawTableHeader = () => {
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.roundedRect(margin, yPos, contentWidth, 8, 0.5, 0.5, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
      const headers = ["#", "DESCRIÇÃO", "QTD", "VR. UNIT.", "DESC.", "SUBTOTAL"];
      let cx = margin;
      headers.forEach((h, i) => {
        const align = i >= 2 ? "right" : "left";
        const tx = align === "right" ? cx + colW[i] - 3 : cx + 3;
        doc.text(h, tx, yPos + 5.5, { align: align as any });
        cx += colW[i];
      });
      yPos += 8;
    };

    drawTableHeader();

    let grandTotal = 0;
    let totalDiscount = 0;

    if (items.length > 0) {
      items.forEach((item: any, index: number) => {
        const discount = item.discount || 0;
        const qty = item.quantity || 1;
        const unitP = item.unit_price || 0;
        const discAmt = item.discount_type === "percentage"
          ? (qty * unitP * discount / 100)
          : discount;
        const itemTotal = qty * unitP - discAmt;
        grandTotal += itemTotal;
        totalDiscount += discAmt;

        const descMaxW = colW[1] - 6;
        doc.setFontSize(7.5);
        const displayName = item.name || item.description || "—";
        const descLines = doc.splitTextToSize(displayName, descMaxW);

        const hasDetail = item.name && item.description && item.name !== item.description;
        const detailLines = hasDetail ? doc.setFontSize(6.5).splitTextToSize(item.description, descMaxW) : [];

        const rowH = Math.max(8, (descLines.length + detailLines.length) * 3.5 + 4);

        if (yPos + rowH > usableHeight) {
          doc.addPage(); yPos = margin;
          drawTableHeader();
        }

        if (index % 2 === 0) {
          doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
          doc.rect(margin, yPos, contentWidth, rowH, "F");
        }
        doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
        doc.setLineWidth(0.1);
        doc.line(margin, yPos + rowH, margin + contentWidth, yPos + rowH);

        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(textDark.r, textDark.g, textDark.b);
        const midY = yPos + (rowH / 2) + 1;
        let cx = margin;

        doc.text((index + 1).toString(), cx + 3, midY);
        cx += colW[0];

        const descStartY = yPos + 4;
        doc.setFont("helvetica", "bold");
        doc.text(descLines, cx + 3, descStartY);

        if (hasDetail) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(6.5);
          doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
          doc.text(detailLines, cx + 3, descStartY + (descLines.length * 3.5));
        }

        cx += colW[1];

        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(textDark.r, textDark.g, textDark.b);
        doc.text(qty.toFixed(2).replace(".", ","), cx + colW[2] - 3, midY, { align: "right" });
        cx += colW[2];
        doc.text(formatCurrency(unitP), cx + colW[3] - 3, midY, { align: "right" });
        cx += colW[3];
        doc.text(discAmt > 0 ? formatCurrency(discAmt) : "—", cx + colW[4] - 3, midY, { align: "right" });
        cx += colW[4];
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(itemTotal), cx + colW[5] - 3, midY, { align: "right" });

        yPos += rowH;
      });
    } else {
      doc.setFillColor(rowEven.r, rowEven.g, rowEven.b);
      doc.rect(margin, yPos, contentWidth, 8, "F");
      doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text("Nenhum item cadastrado", margin + 5, yPos + 5.5);
      yPos += 8;
      grandTotal = service.value || 0;
    }

    // ── Total summary block ──
    ensureSpace(28);
    yPos += 3;
    const sumW = 80;
    const sumX = margin + contentWidth - sumW;

    if (totalDiscount > 0) {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text("Subtotal:", sumX, yPos + 4);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(formatCurrency(grandTotal + totalDiscount), sumX + sumW, yPos + 4, { align: "right" });
      yPos += 6;
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text("Desconto:", sumX, yPos + 4);
      doc.setTextColor(200, 40, 40);
      doc.text(`– ${formatCurrency(totalDiscount)}`, sumX + sumW, yPos + 4, { align: "right" });
      yPos += 6;
      doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
      doc.line(sumX, yPos, sumX + sumW, yPos);
      yPos += 2;
    }

    // Total box
    const totalBoxH = 14;
    doc.setFillColor(totalBg.r, totalBg.g, totalBg.b);
    doc.roundedRect(sumX - 2, yPos, sumW + 4, totalBoxH, 2, 2, "F");
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("TOTAL", sumX + 4, yPos + 10);
    doc.text(formatCurrency(grandTotal), sumX + sumW - 2, yPos + 10, { align: "right" });

    yPos += totalBoxH + 6;

    // ═══════════════════════════════════════════
    //  PAYMENT DATA
    // ═══════════════════════════════════════════
    const paymentMethod = service.payment_method || "";
    const paymentDueDate = service.payment_due_date ? formatDate(service.payment_due_date) : "";
    const paymentNotes = service.payment_notes || "";
    const hasPayment = paymentMethod || paymentDueDate || paymentNotes;

    if (hasPayment) {
      const payH = paymentNotes ? 18 : 12;
      ensureSpace(payH + 14);
      drawSectionTitle("DADOS DO PAGAMENTO");
      doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
      doc.setDrawColor(primary.r, primary.g, primary.b);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPos, contentWidth, payH, "FD");
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.rect(margin, yPos, 3, payH, "F");
      doc.setFontSize(8);
      drawField("Vencimento:", paymentDueDate || undefined, leftX + 2, yPos + 7);
      drawField("Forma de pagamento:", paymentMethod || undefined, rightX, yPos + 7);
      if (paymentNotes) {
        const pn = paymentNotes.length > 80 ? paymentNotes.substring(0, 80) + "..." : paymentNotes;
        drawField("Obs:", pn, leftX + 2, yPos + 14);
      }
      yPos += payH + 4;
    }

    // ═══════════════════════════════════════════
    //  NOTES / OBSERVAÇÕES
    // ═══════════════════════════════════════════
    const notes = service.notes || "";
    if (notes) {
      doc.setFontSize(8);
      const noteLines = doc.splitTextToSize(notes, contentWidth - 10);
      const noteH = Math.max(noteLines.length * 4 + 8, 14);
      drawSectionTitle("OBSERVAÇÕES");
      ensureSpace(noteH + 2);
      doc.setFillColor(255, 252, 240);
      doc.setDrawColor(230, 200, 100);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPos, contentWidth, noteH, "FD");
      doc.setFillColor(230, 180, 50);
      doc.rect(margin, yPos, 3, noteH, "F");
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(noteLines, margin + 7, yPos + 6);
      yPos += noteH + 4;
    }

    // ═══════════════════════════════════════════
    //  SIGNATURES
    // ═══════════════════════════════════════════
    const needsClause = org.signature_url && org.auto_signature_os;
    const sigBlockH = needsClause ? 48 : 34;
    ensureSpace(sigBlockH);
    yPos += 6;

    const signatureWidth = 68;
    const leftSignX = margin + 18;
    const rightSignX = pageWidth - margin - signatureWidth - 18;

    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text("ASSINATURA DO CLIENTE", leftSignX + signatureWidth / 2, yPos, { align: "center" });
    doc.text("ASSINATURA DA EMPRESA", rightSignX + signatureWidth / 2, yPos, { align: "center" });
    yPos += 3;

    const sigImgY = yPos;
    const sigLineY = yPos + 18;

    // Draw client signature image
    if (clientSigUrl) {
      try {
        const cSigB64 = await loadImageAsBase64(clientSigUrl);
        if (cSigB64) {
          doc.addImage(cSigB64, "PNG", leftSignX + 5, sigImgY + 1, 58, 16);
        }
      } catch { /* ignore */ }
    }

    // Draw org signature image
    if (org.signature_url && org.auto_signature_os) {
      try {
        const oSigB64 = await loadImageAsBase64(org.signature_url);
        if (oSigB64) {
          doc.addImage(oSigB64, "PNG", rightSignX + 5, sigImgY + 1, 58, 16);
        }
      } catch { /* ignore */ }
    }

    // Signature lines
    yPos = sigLineY;
    doc.setDrawColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(leftSignX, yPos, leftSignX + signatureWidth, yPos);
    doc.line(rightSignX, yPos, rightSignX + signatureWidth, yPos);
    doc.setLineDashPattern([], 0);

    // Names below lines
    yPos += 4;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(client.name || "Cliente", leftSignX + signatureWidth / 2, yPos, { align: "center" });
    doc.text(org.name || "Empresa", rightSignX + signatureWidth / 2, yPos, { align: "center" });

    // Disclaimer clause
    if (needsClause) {
      yPos += 8;
      doc.setFontSize(6); doc.setFont("helvetica", "italic"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      const clause = "A assinatura da empresa neste documento representa apenas a emissão formal da Ordem de Serviço e não confirma a execução do serviço, que depende da realização e aceite final do cliente.";
      const clauseLines = doc.splitTextToSize(clause, contentWidth - 20);
      doc.text(clauseLines, pageWidth / 2, yPos, { align: "center" });
    }

    // ═══════════════════════════════════════════
    //  FOOTER (all pages)
    // ═══════════════════════════════════════════
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = pageHeight - 8;
      doc.setDrawColor(primary.r, primary.g, primary.b);
      doc.setLineWidth(0.4);
      doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
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

    console.log(`[MATERIALIZE-PDF] Success: ${storagePath} (${pdfUint8.length} bytes)`);

    return new Response(JSON.stringify({
      status: "ready",
      path: storagePath,
      serviceId,
      osNumber,
      docType: docTitle,
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
