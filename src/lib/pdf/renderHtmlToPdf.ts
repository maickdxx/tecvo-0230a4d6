import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function loadImageAsBase64(url: string): Promise<string | null> {
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

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RenderOptions {
  margin?: number;
  footerLeft?: string;
  footerDetails?: string;
}

/**
 * Renders an HTML string to a jsPDF document using html2canvas for section-based capture.
 * 
 * Mark sections with data-pdf-section attribute.
 * Use data-pdf-page-break="true" to force a new page before that section.
 */
export async function renderHtmlToPdf(
  html: string,
  options: RenderOptions = {}
): Promise<jsPDF> {
  const {
    margin = 14,
    footerLeft = "Documento gerado pela Tecvo · tecvo.com.br",
  } = options;

  const A4_W = 210;
  const A4_H = 297;
  const CONTENT_W = A4_W - margin * 2;
  const FOOTER_H = 12;
  const MAX_Y = A4_H - FOOTER_H;
  const CONTAINER_PX = 688; // ~182mm at 96dpi

  // Create offscreen container
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${CONTAINER_PX}px`,
    background: "white",
    zIndex: "-9999",
    opacity: "0",
    pointerEvents: "none",
  });
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for images
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
          })
    )
  );

  // Brief render delay
  await new Promise((r) => setTimeout(r, 80));

  const pdf = new jsPDF("portrait", "mm", "a4");

  const sections = Array.from(
    container.querySelectorAll("[data-pdf-section]")
  ) as HTMLElement[];
  if (sections.length === 0) sections.push(container);

  let curY = margin;
  let firstOnPage = true;
  const GAP = 0.5;

  for (const section of sections) {
    const forceBreak = section.getAttribute("data-pdf-page-break") === "true";
    if (forceBreak && !firstOnPage) {
      pdf.addPage();
      curY = margin;
      firstOnPage = true;
    }

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
      });
    } catch (e) {
      console.warn("[PDF] html2canvas failed for section", e);
      continue;
    }

    const sf = CONTENT_W / canvas.width;
    const sH = canvas.height * sf;

    if (sH > MAX_Y - margin) {
      // Canvas taller than page → slice
      const pageHPx = (MAX_Y - margin) / sf;
      let off = 0;
      while (off < canvas.height) {
        if (!firstOnPage || off > 0) {
          pdf.addPage();
          curY = margin;
        }
        const chunkHPx = Math.min(pageHPx, canvas.height - off);
        const chunk = document.createElement("canvas");
        chunk.width = canvas.width;
        chunk.height = chunkHPx;
        const ctx = chunk.getContext("2d")!;
        ctx.drawImage(canvas, 0, off, canvas.width, chunkHPx, 0, 0, canvas.width, chunkHPx);
        const chunkMM = chunkHPx * sf;
        pdf.addImage(chunk.toDataURL("image/png"), "PNG", margin, curY, CONTENT_W, chunkMM);
        curY += chunkMM;
        off += chunkHPx;
        firstOnPage = false;
      }
    } else {
      const remaining = MAX_Y - curY;
      if (sH > remaining && !firstOnPage) {
        pdf.addPage();
        curY = margin;
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, curY, CONTENT_W, sH);
      curY += sH + GAP;
      firstOnPage = false;
    }
  }

  // Footer on all pages
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    const fy = A4_H - 8;
    pdf.setDrawColor(25, 95, 170);
    pdf.setLineWidth(0.4);
    pdf.line(margin, fy - 4, A4_W - margin, fy - 4);
    pdf.setFontSize(6.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 110, 120);
    pdf.text(footerLeft, margin, fy);
    pdf.text(`Página ${p} de ${total}`, A4_W - margin, fy, { align: "right" });
  }

  document.body.removeChild(container);
  return pdf;
}

/* ── Shared CSS for PDF templates ── */
export const PDF_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: Helvetica, Arial, sans-serif; color: #1E2226; font-size: 12px; line-height: 1.35; }

.accent-bar { height: 8px; background: #195FAA; border-radius: 3px 3px 0 0; }

.header-box {
  border: 1px solid #D7DCE4; padding: 10px 12px;
  display: flex; align-items: center; gap: 10px; background: #fff;
}
.header-box img.logo { width: 70px; height: 70px; object-fit: contain; }
.header-box .info { flex: 1; }
.header-box .company-name { font-size: 19px; font-weight: bold; }
.header-box .detail { font-size: 10px; color: #646E78; margin-top: 2px; }
.header-box .website { font-size: 10px; color: #195FAA; margin-top: 2px; }

.title-bar {
  background: linear-gradient(to bottom, #195FAA 85%, #124682 100%);
  padding: 8px 14px; display: flex; justify-content: space-between;
  align-items: center; border-radius: 5px; margin-top: 12px;
}
.title-bar h2 { font-size: 20px; font-weight: bold; color: #fff; }
.title-bar .date { font-size: 12px; color: #fff; }

.sec-title {
  display: flex; align-items: stretch; margin-top: 12px; margin-bottom: 5px;
}
.sec-title .bar { width: 8px; background: #195FAA; border-radius: 2px 0 0 2px; min-height: 22px; }
.sec-title .bg {
  flex: 1; background: #EBF4FF; border: 1px solid #D7DCE4; border-left: none;
  padding: 4px 10px; display: flex; align-items: center; border-radius: 0 2px 2px 0;
}
.sec-title .bg span { font-size: 12px; font-weight: bold; color: #195FAA; }

.grid { border: 1px solid #D7DCE4; width: 100%; border-collapse: collapse; }
.grid td { padding: 4px 8px; border: 1px solid #D7DCE4; vertical-align: top; }
.grid .lbl { font-size: 10px; color: #646E78; font-weight: bold; white-space: nowrap; }
.grid .val { font-size: 11px; color: #1E2226; }

.tbl { width: 100%; border-collapse: collapse; }
.tbl th {
  background: #195FAA; color: #fff; font-size: 9px; font-weight: bold;
  padding: 5px 6px; text-align: left;
}
.tbl th.r { text-align: right; }
.tbl td { font-size: 10px; padding: 5px 6px; border-bottom: 1px solid #E8ECF0; vertical-align: middle; }
.tbl td.r { text-align: right; }
.tbl td.b { font-weight: bold; }
.tbl tr:nth-child(even) { background: #F8F9FC; }
.tbl .desc-main { font-weight: bold; }
.tbl .desc-detail { font-size: 9px; color: #646E78; font-style: italic; margin-top: 1px; }

.total-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
.total-summary { width: 230px; }
.total-summary .row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
.total-summary .row .lbl { color: #646E78; }
.total-summary .row.disc .val { color: #C82828; }
.total-box {
  background: #145096; color: #fff; padding: 8px 12px; border-radius: 6px;
  display: flex; justify-content: space-between; align-items: center; margin-top: 4px;
}
.total-box span { font-size: 17px; font-weight: bold; }

.pay-box {
  background: #EBF4FF; border: 1px solid #195FAA; border-left: 4px solid #195FAA;
  padding: 8px 12px; display: flex; gap: 30px; flex-wrap: wrap;
}
.notes-box {
  background: #FFFCF0; border: 1px solid #E6C864; border-left: 4px solid #E6B432;
  padding: 8px 12px; font-size: 11px; white-space: pre-wrap; word-wrap: break-word;
}

.sigs { display: flex; justify-content: space-between; padding: 12px 30px; margin-top: 18px; }
.sig { text-align: center; width: 190px; }
.sig .top-lbl { font-size: 9px; font-weight: bold; color: #646E78; text-transform: uppercase; margin-bottom: 3px; }
.sig .img-area { height: 46px; display: flex; align-items: flex-end; justify-content: center; }
.sig .img-area img { max-width: 160px; max-height: 42px; }
.sig .line { border-bottom: 1.5px dashed #646E78; margin-bottom: 4px; }
.sig .name { font-size: 11px; color: #646E78; }
.sig-clause {
  font-size: 8px; color: #646E78; font-style: italic; text-align: center;
  margin-top: 10px; max-width: 500px; margin-left: auto; margin-right: auto;
}

.desc-box {
  background: #F8F9FC; border: 1px solid #D7DCE4; padding: 8px 12px;
  font-size: 11px; white-space: pre-wrap; word-wrap: break-word;
}

.eq-hdr-tbl { width: 100%; border-collapse: collapse; border: 1px solid #D7DCE4; }
.eq-hdr-tbl th {
  background: #F8F9FC; font-size: 9px; color: #646E78; font-weight: bold;
  padding: 3px 6px; text-align: left; text-transform: uppercase; border: 1px solid #D7DCE4;
}
.eq-hdr-tbl td { font-size: 11px; padding: 4px 6px; border: 1px solid #D7DCE4; }
.eq-detail-box {
  border: 1px solid #D7DCE4; border-top: none; padding: 6px 10px;
}
.eq-detail-box .dlbl { font-size: 10px; color: #195FAA; font-weight: bold; margin-bottom: 1px; }
.eq-detail-box .dtxt { font-size: 11px; color: #1E2226; white-space: pre-wrap; word-wrap: break-word; }

/* Report-specific */
.rpt-hdr { display: flex; align-items: center; gap: 12px; }
.rpt-hdr img { width: 80px; height: 80px; object-fit: contain; }
.rpt-title { font-size: 32px; font-weight: bold; color: #0A1932; }
.rpt-sub { font-size: 12px; font-weight: bold; color: #005AB4; margin-top: 4px; }
.rpt-meta { font-size: 11px; color: #646E78; margin-top: 4px; }

.info-card {
  background: #F5F7FA; border: 1px solid #D7DCE4; border-radius: 5px;
  padding: 10px 12px; margin-top: 8px;
}
.info-card .row { display: flex; gap: 16px; margin-bottom: 8px; }
.info-card .row:last-child { margin-bottom: 0; }
.info-card .fld { flex: 1; }
.info-card .fld-lbl { font-size: 9px; color: #646E78; text-transform: uppercase; }
.info-card .fld-val { font-size: 12px; font-weight: bold; color: #1E2226; margin-top: 2px; word-wrap: break-word; }

.sum-bar {
  background: #F5F7FA; border: 1px solid #D7DCE4; border-radius: 5px;
  padding: 8px 12px; display: flex; gap: 16px; margin-top: 8px;
}
.sum-bar .st { flex: 1; }
.sum-bar .st-lbl { font-size: 8px; color: #646E78; text-transform: uppercase; }
.sum-bar .st-val { font-size: 13px; font-weight: bold; color: #1E2226; margin-top: 2px; }

.decl-box {
  background: #F5F8FF; border: 1px solid #005AB4; border-left: 4px solid #005AB4;
  border-radius: 5px; padding: 10px 14px; margin-top: 12px;
}
.decl-box .dt { font-size: 9px; font-weight: bold; color: #005AB4; text-transform: uppercase; margin-bottom: 4px; }
.decl-box .dp { font-size: 11px; color: #1E2226; line-height: 1.5; }

.eq-bar {
  background: #0A1932; border-radius: 5px; padding: 6px 14px;
  display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
}
.eq-bar .et { font-size: 13px; font-weight: bold; color: #fff; }
.eq-bar .etp { font-size: 11px; color: #C8D2E1; margin-left: 8px; }
.eq-badge { font-size: 9px; font-weight: bold; color: #fff; padding: 3px 8px; border-radius: 4px; }
.eq-badge.ok { background: #168C46; }
.eq-badge.warn { background: #D28700; }
.eq-badge.crit { background: #B41928; }

.id-grid {
  background: #F5F7FA; border: 1px solid #E8ECF2; border-radius: 5px;
  padding: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px;
}
.id-grid .idf .il { font-size: 8px; color: #646E78; text-transform: uppercase; }
.id-grid .idf .iv { font-size: 11px; font-weight: bold; color: #1E2226; margin-top: 1px; }

.ck-tbl { width: 100%; border-collapse: collapse; margin-top: 8px; }
.ck-tbl th { background: #0A1932; color: #fff; font-size: 9px; font-weight: bold; padding: 4px 10px; text-align: left; }
.ck-tbl td { font-size: 11px; padding: 4px 10px; border-bottom: 1px solid #E8ECF2; }
.ck-tbl tr:nth-child(even) { background: #F5F7FA; }
.ck-badge { font-size: 9px; font-weight: bold; color: #fff; padding: 2px 6px; border-radius: 3px; display: inline-block; }
.ck-badge.ok { background: #168C46; }
.ck-badge.att { background: #D28700; }
.ck-badge.crt { background: #B41928; }

.meas-row { display: flex; gap: 8px; margin-top: 8px; }
.meas-card { flex: 1; background: #F5F7FA; border-radius: 5px; padding: 6px 10px; }
.meas-card .ml { font-size: 8px; color: #646E78; text-transform: uppercase; }
.meas-card .mv { font-size: 14px; font-weight: bold; color: #1E2226; margin-top: 2px; }

.diag-lbl { font-size: 10px; font-weight: bold; color: #005AB4; text-transform: uppercase; margin-bottom: 2px; margin-top: 8px; }
.diag-txt { font-size: 12px; color: #1E2226; margin-bottom: 8px; white-space: pre-wrap; word-wrap: break-word; }

.imp-badge { display: inline-block; font-size: 9px; font-weight: bold; color: #fff; padding: 4px 10px; border-radius: 5px; margin-top: 6px; }
.imp-badge.low { background: #168C46; }
.imp-badge.med { background: #D28700; }
.imp-badge.hi { background: #B41928; }

.concl-status {
  text-align: center; padding: 8px 14px; border-radius: 5px;
  font-size: 14px; font-weight: bold; color: #fff; margin-top: 6px;
}
.concl-status.op { background: #168C46; }
.concl-status.cav { background: #D28700; }
.concl-status.nop { background: #B41928; }

.risk-box {
  background: #FFF3F3; border: 1px solid #B41928; border-left: 4px solid #B41928;
  border-radius: 5px; padding: 8px 12px; font-size: 12px;
  white-space: pre-wrap; word-wrap: break-word;
}

.photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
.photo-grid img { width: 100%; height: auto; border: 1px solid #E8ECF2; border-radius: 4px; }
.photo-cap { font-size: 9px; color: #646E78; font-style: italic; margin-top: 2px; }
.photo-cat { font-size: 11px; font-weight: bold; color: #005AB4; margin-top: 10px; margin-bottom: 4px; }

.cond-badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.cond-badge {
  background: #F5F7FA; border: 1px solid #D7DCE4; border-radius: 4px;
  padding: 3px 8px; font-size: 9px; color: #646E78;
}
`;
