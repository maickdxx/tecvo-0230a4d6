import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface TimeClockDayRecord {
  date: string;
  clockIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  clockOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
  isLate: boolean;
  isIncomplete: boolean;
  isNonWorkDay: boolean;
  observation?: string;
}

export interface TimeClockPDFData {
  employeeName: string;
  employeeRole: string;
  periodLabel: string;
  records: TimeClockDayRecord[];
  summary: {
    totalDaysWorked: number;
    totalExpectedDays: number;
    totalWorkedMinutes: number;
    totalExpectedMinutes: number;
    totalOvertimeMinutes: number;
    bankBalanceMinutes: number;
    totalLates: number;
    totalIncompletes: number;
    totalAbsences: number;
  };
  overtimeMode: "pay" | "bank";
  organizationName: string;
  organizationLogo?: string | null;
  organizationCnpj?: string | null;
  organizationPhone?: string | null;
  organizationEmail?: string | null;
  organizationAddress?: string | null;
  organizationCity?: string | null;
  organizationState?: string | null;
  timezone?: string;
}

const COLORS = {
  primary: [30, 95, 160] as [number, number, number],
  dark: [30, 30, 40] as [number, number, number],
  muted: [100, 110, 120] as [number, number, number],
  light: [240, 242, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
  green: [30, 140, 70] as [number, number, number],
  blue: [30, 100, 180] as [number, number, number],
  amber: [200, 140, 20] as [number, number, number],
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fmtTime(iso: string | null, tz: string = "America/Sao_Paulo"): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch {
    return "—";
  }
}

function fmtHours(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${min < 0 ? "-" : ""}${h}h${m.toString().padStart(2, "0")}`;
}

const DAY_NAMES: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_NAMES[d.getDay()] || "";
}

export async function generateTimeClockPDF(data: TimeClockPDFData): Promise<jsPDF> {
  const tz = data.timezone || "America/Sao_Paulo";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;

  // ── Load logo ──
  let logoImg: HTMLImageElement | null = null;
  if (data.organizationLogo) {
    try {
      logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = data.organizationLogo!;
      });
    } catch { /* ignore */ }
  }

  // ── Helper: new page check ──
  function checkPageBreak(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN - 10) {
      doc.addPage();
      y = MARGIN;
      return true;
    }
    return false;
  }

  // ══════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 36, "F");

  let headerX = MARGIN;
  if (logoImg) {
    const aspect = logoImg.width / logoImg.height;
    const logoH = 16;
    const logoW = logoH * aspect;
    doc.addImage(logoImg, "AUTO", MARGIN, 10, Math.min(logoW, 30), logoH);
    headerX = MARGIN + Math.min(logoW, 30) + 4;
  }

  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.organizationName, headerX, 19);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const headerDetails: string[] = [];
  if (data.organizationCnpj) headerDetails.push(data.organizationCnpj);
  if (data.organizationPhone) headerDetails.push(data.organizationPhone);
  if (data.organizationEmail) headerDetails.push(data.organizationEmail);
  if (headerDetails.length) doc.text(headerDetails.join("  •  "), headerX, 25);
  if (data.organizationCity || data.organizationState) {
    doc.text([data.organizationCity, data.organizationState].filter(Boolean).join(" — "), headerX, 30);
  }

  y = 44;

  // ── Title ──
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Espelho de Ponto", MARGIN, y);
  y += 7;

  // ── Employee info ──
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);

  const ROLE_LABELS: Record<string, string> = { tecnico: "Técnico", ajudante: "Ajudante", atendente: "Atendente" };
  const roleLabel = ROLE_LABELS[data.employeeRole] || data.employeeRole;

  doc.text(`Funcionário: `, MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(data.employeeName, MARGIN + 22, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(`Cargo: ${roleLabel}`, MARGIN + 100, y);
  y += 5;

  doc.text(`Período: `, MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(data.periodLabel, MARGIN + 16, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  const modeLabel = data.overtimeMode === "pay" ? "Hora Extra" : "Banco de Horas";
  doc.text(`Saldo: ${modeLabel}`, MARGIN + 100, y);
  y += 5;

  doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN, y);
  y += 8;

  // ── Separator ──
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  y += 6;

  // ══════════════════════════════════════════════
  // TABLE HEADER
  // ══════════════════════════════════════════════
  const COL = {
    date: MARGIN,
    day: MARGIN + 20,
    entry: MARGIN + 33,
    brkStart: MARGIN + 50,
    brkEnd: MARGIN + 67,
    exit: MARGIN + 84,
    total: MARGIN + 101,
    extra: MARGIN + 120,
    obs: MARGIN + 140,
  };

  function drawTableHeader() {
    doc.setFillColor(...COLORS.primary);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Data", COL.date + 1, y + 5);
    doc.text("Dia", COL.day + 1, y + 5);
    doc.text("Entrada", COL.entry + 1, y + 5);
    doc.text("Ini. Pausa", COL.brkStart + 1, y + 5);
    doc.text("Ret. Pausa", COL.brkEnd + 1, y + 5);
    doc.text("Saída", COL.exit + 1, y + 5);
    doc.text("Total", COL.total + 1, y + 5);
    doc.text("Extra/Déb", COL.extra + 1, y + 5);
    doc.text("Obs", COL.obs + 1, y + 5);
    y += 8;
  }

  drawTableHeader();

  // ══════════════════════════════════════════════
  // TABLE ROWS
  // ══════════════════════════════════════════════
  const sortedRecords = [...data.records].sort((a, b) => a.date.localeCompare(b.date));
  const ROW_H = 5.5;

  for (let i = 0; i < sortedRecords.length; i++) {
    const r = sortedRecords[i];

    if (checkPageBreak(ROW_H + 10)) {
      drawTableHeader();
    }

    // Alternating row bg
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.light);
      doc.rect(MARGIN, y - 0.5, CONTENT_WIDTH, ROW_H, "F");
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");

    const dateFormatted = format(new Date(r.date + "T12:00:00"), "dd/MM/yyyy");
    const dayName = getDayOfWeek(r.date);
    const wH = Math.floor(r.workedMinutes / 60);
    const wM = r.workedMinutes % 60;
    const totalStr = `${wH}h${wM.toString().padStart(2, "0")}`;

    // Date & day
    doc.setTextColor(...COLORS.dark);
    doc.text(dateFormatted, COL.date + 1, y + 3.5);
    const dayColor = r.isNonWorkDay ? COLORS.amber : COLORS.muted;
    doc.setTextColor(...dayColor);
    doc.text(dayName, COL.day + 1, y + 3.5);

    // Times
    doc.setTextColor(...COLORS.dark);
    doc.setFont("helvetica", "normal");
    doc.text(fmtTime(r.clockIn, tz), COL.entry + 1, y + 3.5);
    doc.text(fmtTime(r.breakStart, tz), COL.brkStart + 1, y + 3.5);
    doc.text(fmtTime(r.breakEnd, tz), COL.brkEnd + 1, y + 3.5);
    doc.text(fmtTime(r.clockOut, tz), COL.exit + 1, y + 3.5);

    // Total
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text(totalStr, COL.total + 1, y + 3.5);

    // Overtime/deficit
    if (r.overtimeMinutes > 0) {
      doc.setTextColor(...COLORS.green);
      doc.text(`+${fmtHours(r.overtimeMinutes)}`, COL.extra + 1, y + 3.5);
    } else if (r.overtimeMinutes < 0) {
      doc.setTextColor(...COLORS.red);
      doc.text(fmtHours(r.overtimeMinutes), COL.extra + 1, y + 3.5);
    } else {
      doc.setTextColor(...COLORS.muted);
      doc.text("—", COL.extra + 1, y + 3.5);
    }

    // Obs column
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const obs: string[] = [];
    if (r.isLate) obs.push("Atraso");
    if (r.isIncomplete) obs.push("Incompleto");
    if (r.isNonWorkDay) obs.push("Dia não útil");
    if (r.observation) obs.push(r.observation);
    if (obs.length) {
      doc.setTextColor(...COLORS.red);
      doc.text(obs.join(", "), COL.obs + 1, y + 3.5, { maxWidth: CONTENT_WIDTH - (COL.obs - MARGIN) - 2 });
    }

    y += ROW_H;
  }

  // ══════════════════════════════════════════════
  // SUMMARY BLOCK
  // ══════════════════════════════════════════════
  y += 6;
  checkPageBreak(60);

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.dark);
  doc.text("Resumo do Período", MARGIN, y);
  y += 7;

  // Summary grid
  const summaryItems = [
    { label: "Dias Trabalhados", value: `${data.summary.totalDaysWorked} / ${data.summary.totalExpectedDays}` },
    { label: "Horas Trabalhadas", value: fmtHours(data.summary.totalWorkedMinutes) },
    { label: "Horas Previstas", value: fmtHours(data.summary.totalExpectedMinutes) },
    { label: data.overtimeMode === "pay" ? "Horas Extras a Pagar" : "Saldo Banco de Horas", value: data.overtimeMode === "pay" ? fmtHours(data.summary.totalOvertimeMinutes) : fmtHours(data.summary.bankBalanceMinutes), highlight: true },
    { label: "Atrasos", value: String(data.summary.totalLates) },
    { label: "Jornadas Incompletas", value: String(data.summary.totalIncompletes) },
    { label: "Faltas", value: String(data.summary.totalAbsences) },
  ];

  const colW = CONTENT_WIDTH / 2;
  for (let i = 0; i < summaryItems.length; i++) {
    const item = summaryItems[i];
    const col = i % 2;
    const xPos = MARGIN + col * colW;

    if (col === 0 && i > 0) y += 7;
    checkPageBreak(10);

    doc.setFillColor(...COLORS.light);
    doc.roundedRect(xPos, y - 1, colW - 3, 6.5, 1, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(item.label, xPos + 2, y + 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    if (item.highlight) {
      const val = data.overtimeMode === "pay" ? data.summary.totalOvertimeMinutes : data.summary.bankBalanceMinutes;
      const highlightColor = val >= 0 ? COLORS.green : COLORS.red;
      doc.setTextColor(...highlightColor);
    } else {
      doc.setTextColor(...COLORS.dark);
    }
    doc.text(item.value, xPos + colW - 5, y + 3, { align: "right" });
  }

  y += 14;
  checkPageBreak(30);

  // ── Signature line ──
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.3);
  const sigWidth = 70;
  const sigX1 = MARGIN;
  const sigX2 = MARGIN + CONTENT_WIDTH - sigWidth;

  doc.line(sigX1, y, sigX1 + sigWidth, y);
  doc.line(sigX2, y, sigX2 + sigWidth, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text("Assinatura do Funcionário", sigX1 + sigWidth / 2, y + 4, { align: "center" });
  doc.text("Assinatura do Responsável", sigX2 + sigWidth / 2, y + 4, { align: "center" });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${data.organizationName} — Espelho de Ponto — ${data.periodLabel}`, MARGIN, PAGE_HEIGHT - 8);
    doc.text(`Página ${p}/${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
  }

  return doc;
}
