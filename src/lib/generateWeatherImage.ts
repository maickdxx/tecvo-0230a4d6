import type { DayForecast, WeatherAlert } from "@/hooks/useWeatherForecast";

export type ArtFormat = "story" | "feed" | "whatsapp";
export type ArtPeriod = "day" | "week";

interface WeatherImageParams {
  city: string;
  today: DayForecast;
  days: DayForecast[];
  alert: WeatherAlert;
  logoUrl?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
  format: ArtFormat;
  period: ArtPeriod;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface FormatConfig {
  width: number;
  height: number;
  padding: number;
  titleFont: number;
  subtitleFont: number;
  bodyFont: number;
  smallFont: number;
  tinyFont: number;
  heroTempFont: number;
  iconSize: number;
  logoMaxW: number;
  logoMaxH: number;
}

const FORMAT_CONFIGS: Record<ArtFormat, FormatConfig> = {
  story: {
    width: 1080, height: 1920, padding: 72,
    titleFont: 46, subtitleFont: 30, bodyFont: 26, smallFont: 22, tinyFont: 18,
    heroTempFont: 96, iconSize: 160, logoMaxW: 300, logoMaxH: 90,
  },
  feed: {
    width: 1080, height: 1080, padding: 72,
    titleFont: 38, subtitleFont: 26, bodyFont: 22, smallFont: 19, tinyFont: 16,
    heroTempFont: 80, iconSize: 130, logoMaxW: 260, logoMaxH: 80,
  },
  whatsapp: {
    width: 1080, height: 1350, padding: 72,
    titleFont: 42, subtitleFont: 28, bodyFont: 24, smallFont: 20, tinyFont: 17,
    heroTempFont: 88, iconSize: 140, logoMaxW: 280, logoMaxH: 85,
  },
};

// ── Colors ─────────────────────────────────────────────────────────────
const COLORS = {
  bg: "#F8FAFC",
  bgCard: "#FFFFFF",
  bgCardAlt: "#F1F5F9",
  primary: "#1872C2",
  primaryLight: "#DBEAFE",
  primaryDark: "#1E40AF",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  accent: {
    heat: { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", icon: "#EF4444" },
    warm: { bg: "#FFF7ED", border: "#FED7AA", text: "#EA580C", icon: "#F97316" },
    mild: { bg: "#F0FDF4", border: "#BBF7D0", text: "#16A34A", icon: "#22C55E" },
    cold: { bg: "#EFF6FF", border: "#BFDBFE", text: "#2563EB", icon: "#3B82F6" },
    rain: { bg: "#EFF6FF", border: "#BFDBFE", text: "#2563EB", icon: "#3B82F6" },
  },
  cta: "#25D366",
  ctaText: "#FFFFFF",
};

function getAccentScheme(tempMax: number, precipProb: number, code: number) {
  if (code >= 95 || precipProb >= 80) return COLORS.accent.rain;
  if (tempMax >= 33) return COLORS.accent.heat;
  if (tempMax >= 28) return COLORS.accent.warm;
  if (tempMax < 18) return COLORS.accent.cold;
  return COLORS.accent.mild;
}

// ── Weather labels ─────────────────────────────────────────────────────
function getWeatherLabel(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code === 1) return "Predominantemente limpo";
  if (code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Nevoeiro";
  if (code >= 51 && code <= 55) return "Garoa";
  if (code >= 56 && code <= 57) return "Garoa congelante";
  if (code >= 61 && code <= 63) return "Chuva leve a moderada";
  if (code >= 65 && code <= 67) return "Chuva forte";
  if (code >= 71 && code <= 75) return "Neve";
  if (code === 77) return "Granizo de neve";
  if (code >= 80 && code <= 81) return "Pancadas de chuva";
  if (code === 82) return "Pancadas fortes";
  if (code >= 85 && code <= 86) return "Pancadas de neve";
  if (code === 95) return "Tempestade";
  if (code >= 96) return "Tempestade com granizo";
  return "Céu limpo";
}

function getWeatherEmoji(code: number): string {
  if (code <= 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "☀️";
}

// ── Commercial copy ────────────────────────────────────────────────────
function getDayTitle(tempMax: number, code: number): string {
  if (tempMax >= 35) return "Calor Intenso Hoje";
  if (tempMax >= 30) return "Dia Quente Pela Frente";
  if (code >= 95) return "Alerta de Tempestade";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Previsão de Chuva";
  if (tempMax < 15) return "Dia Frio Chegando";
  if (tempMax < 20) return "Clima Ameno Hoje";
  return "Previsão do Dia";
}

function getWeekTitle(avgMax: number, rainyDays: number): string {
  if (avgMax >= 33) return "Semana de Calor Forte";
  if (avgMax >= 28) return "Semana Quente";
  if (rainyDays >= 3) return "Semana Chuvosa";
  if (avgMax < 18) return "Semana de Frio";
  return "Previsão da Semana";
}

const HEAT_PHRASES = [
  "Tempo quente chegando: agende sua limpeza de ar-condicionado.",
  "Calor em alta: não deixe a manutenção para depois.",
  "Seu ar-condicionado está pronto para os próximos dias?",
  "Evite surpresas com o calor. Agende sua revisão agora.",
  "Manutenção hoje evita dor de cabeça amanhã.",
];

const WARM_PHRASES = [
  "Semana de calor forte: ideal para revisão e manutenção preventiva.",
  "Vai instalar ar-condicionado? Esse é um ótimo momento.",
  "Previna-se contra o calor: cuide do seu equipamento.",
  "Garanta o conforto da sua casa ou empresa. Agende já.",
];

const MILD_PHRASES = [
  "Aproveite a semana para colocar sua manutenção em dia.",
  "Organize agora sua limpeza preventiva e evite dor de cabeça depois.",
  "Faça a revisão do seu equipamento antes dos dias mais quentes.",
  "Seu ambiente merece conforto e eficiência.",
  "Prevenção é mais barato que conserto. Cuide hoje.",
];

const COLD_PHRASES = [
  "Frio intenso: seu sistema de climatização está pronto?",
  "Aproveite o clima ameno para a manutenção preventiva.",
  "Época ideal para revisão geral dos equipamentos.",
];

const RAIN_PHRASES = [
  "Umidade acelera mofo e mau cheiro. Agende a limpeza.",
  "Chuva constante exige drenos limpos. Não espere o problema.",
  "Priorize serviços internos e organize sua agenda.",
];

function getCommercialPhrase(tempMax: number, code: number, precipProb: number): string {
  const seed = new Date().getDate() + new Date().getHours();
  if (code >= 95 || precipProb >= 80) return RAIN_PHRASES[seed % RAIN_PHRASES.length];
  if (tempMax >= 33) return HEAT_PHRASES[seed % HEAT_PHRASES.length];
  if (tempMax >= 28) return WARM_PHRASES[seed % WARM_PHRASES.length];
  if (tempMax < 18) return COLD_PHRASES[seed % COLD_PHRASES.length];
  return MILD_PHRASES[seed % MILD_PHRASES.length];
}

function getContextBadgeText(tempMax: number, code: number, precipProb: number): string {
  if (code >= 95) return "⚠️ Alerta de Tempestade";
  if (precipProb >= 80) return "🌧️ Chuva Prevista";
  if (tempMax >= 35) return "🔥 Calor Extremo";
  if (tempMax >= 30) return "☀️ Dia Quente";
  if (tempMax < 15) return "🧊 Frente Fria";
  if (tempMax < 20) return "🧥 Clima Frio";
  return "✅ Clima Agradável";
}

// ── Canvas helpers ─────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawLightBackground(ctx: CanvasRenderingContext2D, W: number, H: number, accent: typeof COLORS.accent.mild) {
  // Base white
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle top gradient with accent color
  const topGrad = ctx.createLinearGradient(0, 0, W, H * 0.4);
  topGrad.addColorStop(0, accent.bg);
  topGrad.addColorStop(0.6, COLORS.bg);
  topGrad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glow top-right
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, W * 0.6);
  glow.addColorStop(0, accent.bg + "80");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Decorative circle shapes (very subtle)
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = accent.icon;
  ctx.beginPath();
  ctx.arc(W * 0.9, H * 0.08, W * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.92, W * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bottom subtle stripe
  const bottomGrad = ctx.createLinearGradient(0, H - 80, 0, H);
  bottomGrad.addColorStop(0, "transparent");
  bottomGrad.addColorStop(1, COLORS.primary + "0A");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, H - 80, W, 80);
}

function drawMiniWeatherIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, code: number) {
  ctx.save();
  ctx.font = `${size}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(getWeatherEmoji(code), cx, cy);
  ctx.restore();
}

// ── Main export ────────────────────────────────────────────────────────
export async function generateWeatherImage(params: WeatherImageParams): Promise<Blob> {
  const { city, today, days, alert, logoUrl, companyName, companyPhone, format, period } = params;
  const cfg = FORMAT_CONFIGS[format];
  const W = cfg.width;
  const H = cfg.height;
  const P = cfg.padding;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const accent = getAccentScheme(today.tempMax, today.precipProbability, today.weatherCode);
  const isStory = format === "story";
  const isFeed = format === "feed";
  const isWeek = period === "week";

  // Background
  drawLightBackground(ctx, W, H, accent);

  // Calculate vertical centering
  let contentH = isStory ? 1500 : isFeed ? 880 : 1100;
  let y = Math.max(P, Math.floor((H - contentH) / 2));

  // ── Header: logo + company ──────────────────────────────────────
  if (logoUrl) {
    try {
      const logo = await loadImage(logoUrl);
      const scale = Math.min(cfg.logoMaxW / logo.width, cfg.logoMaxH / logo.height, 1);
      const lw = logo.width * scale;
      const lh = logo.height * scale;
      ctx.drawImage(logo, (W - lw) / 2, y, lw, lh);
      y += lh + 16;
    } catch { /* skip */ }
  }

  if (companyName) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 ${cfg.subtitleFont}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(companyName, W / 2, y + cfg.subtitleFont);
    y += cfg.subtitleFont + 12;
  }

  // Subtle divider
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, y + 8);
  ctx.lineTo(W * 0.7, y + 8);
  ctx.stroke();
  y += 28;

  // ── Location + date ──────────────────────────────────────────────
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = `500 ${cfg.smallFont}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`📍 ${city}`, W / 2, y + cfg.smallFont);
  y += cfg.smallFont + 8;

  const now = new Date();
  if (isWeek) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 6);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `400 ${cfg.tinyFont}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(
      `${now.getDate()} a ${endDate.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`,
      W / 2, y + cfg.tinyFont
    );
  } else {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `400 ${cfg.tinyFont}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(
      `${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`,
      W / 2, y + cfg.tinyFont
    );
  }
  y += cfg.tinyFont + (isStory ? 36 : 28);

  // ── Title ────────────────────────────────────────────────────────
  const title = isWeek
    ? getWeekTitle(
        days.reduce((s, d) => s + d.tempMax, 0) / days.length,
        days.filter(d => d.precipProbability > 60).length
      )
    : getDayTitle(today.tempMax, today.weatherCode);

  ctx.fillStyle = COLORS.text;
  ctx.font = `800 ${cfg.titleFont}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(title, W / 2, y + cfg.titleFont);
  y += cfg.titleFont + 16;

  // ── Context badge ────────────────────────────────────────────────
  const badgeText = getContextBadgeText(today.tempMax, today.weatherCode, today.precipProbability);
  ctx.font = `600 ${cfg.smallFont}px system-ui, -apple-system, sans-serif`;
  const badgeW = ctx.measureText(badgeText).width + 40;
  const badgeH = cfg.smallFont + 20;
  const badgeX = (W - badgeW) / 2;
  roundRect(ctx, badgeX, y, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = accent.bg;
  ctx.fill();
  ctx.strokeStyle = accent.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = accent.text;
  ctx.font = `600 ${cfg.smallFont}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(badgeText, W / 2, y + badgeH * 0.7);
  y += badgeH + (isStory ? 32 : 22);

  if (isWeek) {
    // ── Week forecast cards ──────────────────────────────────────
    const displayDays = days.slice(0, 7);
    const cardCount = displayDays.length;
    const totalGap = (cardCount - 1) * 12;
    const availableW = W - P * 2;
    const cardW = Math.floor((availableW - totalGap) / cardCount);
    const cardH = isStory ? 200 : isFeed ? 160 : 180;
    const startX = P;

    for (let i = 0; i < cardCount; i++) {
      const d = displayDays[i];
      const cx = startX + i * (cardW + 12);
      const isToday = i === 0;

      // Card background
      roundRect(ctx, cx, y, cardW, cardH, 16);
      ctx.fillStyle = isToday ? accent.bg : COLORS.bgCard;
      ctx.fill();
      ctx.strokeStyle = isToday ? accent.border : COLORS.border;
      ctx.lineWidth = isToday ? 2 : 1;
      ctx.stroke();

      const centerX = cx + cardW / 2;
      let cy2 = y + 20;

      // Day name
      ctx.fillStyle = isToday ? accent.text : COLORS.textSecondary;
      ctx.font = `700 ${cfg.tinyFont}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(isToday ? "Hoje" : d.dayName, centerX, cy2 + cfg.tinyFont);
      cy2 += cfg.tinyFont + 6;

      // Date
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = `400 ${cfg.tinyFont - 3}px system-ui, sans-serif`;
      ctx.fillText(`${d.date.slice(8)}/${d.date.slice(5, 7)}`, centerX, cy2 + cfg.tinyFont - 3);
      cy2 += cfg.tinyFont + 6;

      // Weather emoji
      drawMiniWeatherIcon(ctx, centerX, cy2 + 18, isStory ? 32 : 26, d.weatherCode);
      cy2 += 42;

      // Temps
      ctx.fillStyle = COLORS.text;
      ctx.font = `700 ${cfg.tinyFont + 2}px system-ui, sans-serif`;
      ctx.fillText(`${d.tempMax}°`, centerX, cy2 + cfg.tinyFont);
      cy2 += cfg.tinyFont + 2;

      ctx.fillStyle = COLORS.textMuted;
      ctx.font = `400 ${cfg.tinyFont - 2}px system-ui, sans-serif`;
      ctx.fillText(`${d.tempMin}°`, centerX, cy2 + cfg.tinyFont - 2);

      // Rain probability indicator
      if (d.precipProbability > 30) {
        cy2 += cfg.tinyFont + 4;
        ctx.fillStyle = COLORS.accent.rain.text;
        ctx.font = `500 ${cfg.tinyFont - 4}px system-ui, sans-serif`;
        ctx.fillText(`💧${d.precipProbability}%`, centerX, cy2 + cfg.tinyFont - 4);
      }
    }
    y += cardH + (isStory ? 32 : 24);

    // Week summary stats
    const avgMax = Math.round(days.reduce((s, d) => s + d.tempMax, 0) / days.length);
    const avgMin = Math.round(days.reduce((s, d) => s + d.tempMin, 0) / days.length);
    const rainyCount = days.filter(d => d.precipProbability > 60).length;

    const statsW = W - P * 2;
    const statsH = isStory ? 70 : 60;
    roundRect(ctx, P, y, statsW, statsH, 14);
    ctx.fillStyle = COLORS.bgCard;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    const statItems = [
      `🌡️ Média: ${avgMin}°–${avgMax}°`,
      `💧 ${rainyCount} dia${rainyCount !== 1 ? "s" : ""} com chuva`,
      `💨 Umid. ${Math.round(days.reduce((s, d) => s + d.humidity, 0) / days.length)}%`,
    ];
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `500 ${cfg.tinyFont}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(statItems.join("   •   "), W / 2, y + statsH * 0.62);
    y += statsH + (isStory ? 28 : 20);
  } else {
    // ── Day detail card ──────────────────────────────────────────
    const cardW = W - P * 2;
    const cardH = isStory ? 280 : isFeed ? 220 : 250;
    roundRect(ctx, P, y, cardW, cardH, 24);
    ctx.fillStyle = COLORS.bgCard;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Subtle accent stripe at top of card
    ctx.save();
    roundRect(ctx, P, y, cardW, 6, 24);
    ctx.clip();
    ctx.fillStyle = accent.icon;
    ctx.fillRect(P, y, cardW, 6);
    ctx.restore();

    const cardCenterX = W / 2;
    let cardY = y + 30;

    // Weather emoji large
    drawMiniWeatherIcon(ctx, cardCenterX, cardY + cfg.iconSize * 0.4, cfg.iconSize * 0.6, today.weatherCode);
    cardY += cfg.iconSize * 0.6 + 8;

    // Temperature
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${cfg.heroTempFont}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${today.tempMin}° / ${today.tempMax}°`, cardCenterX, cardY + cfg.heroTempFont * 0.85);
    cardY += cfg.heroTempFont + 4;

    // Weather label
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `500 ${cfg.bodyFont}px system-ui, sans-serif`;
    ctx.fillText(getWeatherLabel(today.weatherCode), cardCenterX, cardY + cfg.bodyFont);
    cardY += cfg.bodyFont + 14;

    // Detail pills
    const details = [
      `🌡️ Sensação ${today.apparentTempMin}°/${today.apparentTempMax}°`,
      `💧 Chuva ${today.precipProbability}%`,
      `💨 Umidade ${today.humidity}%`,
    ];
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `400 ${cfg.smallFont}px system-ui, sans-serif`;
    ctx.fillText(details.join("   •   "), cardCenterX, cardY + cfg.smallFont);

    y += cardH + (isStory ? 32 : 22);
  }

  // ── Commercial message box ─────────────────────────────────────
  const phrase = getCommercialPhrase(today.tempMax, today.weatherCode, today.precipProbability);
  ctx.font = `600 italic ${cfg.bodyFont + 2}px system-ui, -apple-system, sans-serif`;
  const phraseMaxW = W - P * 2 - 60;
  const phraseLines = wrapText(ctx, `"${phrase}"`, phraseMaxW);
  const lineH = cfg.bodyFont + 14;
  const phraseBoxH = phraseLines.length * lineH + 36;
  const phraseBoxW = W - P * 2;

  roundRect(ctx, P, y, phraseBoxW, phraseBoxH, 16);
  ctx.fillStyle = COLORS.primaryLight + "60";
  ctx.fill();

  // Left accent bar
  roundRect(ctx, P, y, 5, phraseBoxH, 16);
  ctx.fillStyle = COLORS.primary;
  ctx.fill();

  ctx.fillStyle = COLORS.primaryDark;
  ctx.font = `600 italic ${cfg.bodyFont + 2}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  phraseLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, y + 28 + i * lineH);
  });
  y += phraseBoxH + (isStory ? 28 : 18);

  // ── CTA Button ─────────────────────────────────────────────────
  const hasPhone = !!companyPhone;
  const ctaText = hasPhone ? "💬 Chame no WhatsApp" : "📲 Agende sua manutenção";
  ctx.font = `700 ${cfg.bodyFont + 2}px system-ui, -apple-system, sans-serif`;
  const ctaW = Math.max(ctx.measureText(ctaText).width + 80, isStory ? 500 : 380);
  const ctaH = isStory ? 68 : 56;
  const ctaX = (W - ctaW) / 2;

  // Button shadow
  ctx.save();
  ctx.shadowColor = "rgba(37,211,102,0.3)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, ctaX, y, ctaW, ctaH, ctaH / 2);
  ctx.fillStyle = COLORS.cta;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLORS.ctaText;
  ctx.font = `700 ${cfg.bodyFont + 2}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(ctaText, W / 2, y + ctaH * 0.67);
  y += ctaH + 14;

  // Phone
  if (companyPhone) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `500 ${cfg.smallFont}px system-ui, sans-serif`;
    ctx.fillText(companyPhone, W / 2, y + cfg.smallFont);
    y += cfg.smallFont + 8;
  }

  // ── Footer ─────────────────────────────────────────────────────
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `400 ${cfg.tinyFont}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("── tecvo.com.br ──", W / 2, H - (isStory ? 50 : 32));

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png", 1);
  });
}

/** Generate preview as data URL for the modal */
export async function generateWeatherPreview(params: WeatherImageParams): Promise<string> {
  const blob = await generateWeatherImage(params);
  return URL.createObjectURL(blob);
}
