/**
 * Premium vector weather icons drawn via Canvas API
 * High-impact, realistic visuals with depth, volume, and emotion
 */

// ── Helper: draw a volumetric cloud with multiple overlapping bumps ─────
function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  fillTop: string, fillBot: string,
  opts?: { shadow?: string; shadowBlur?: number; bottomShadow?: boolean; highlight?: boolean }
) {
  ctx.save();

  // Drop shadow underneath for grounding
  if (opts?.bottomShadow) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.42, w * 0.48, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (opts?.shadow) {
    ctx.shadowColor = opts.shadow;
    ctx.shadowBlur = opts?.shadowBlur ?? 22;
    ctx.shadowOffsetY = 4;
  }

  const grad = ctx.createLinearGradient(cx - w * 0.3, cy - h * 0.6, cx + w * 0.2, cy + h * 0.5);
  grad.addColorStop(0, fillTop);
  grad.addColorStop(1, fillBot);
  ctx.fillStyle = grad;

  ctx.beginPath();
  // Build cloud from 5 overlapping circles for realistic volume
  const bumps = [
    { ox: 0,          oy: -0.08,  r: 0.42 },  // main top dome
    { ox: -0.28,      oy: 0.04,   r: 0.30 },  // left bump
    { ox: 0.30,       oy: 0.02,   r: 0.32 },  // right bump
    { ox: -0.15,      oy: -0.18,  r: 0.24 },  // top-left detail
    { ox: 0.16,       oy: -0.14,  r: 0.22 },  // top-right detail
  ];
  for (const b of bumps) {
    ctx.arc(cx + w * b.ox, cy + h * b.oy, w * b.r, 0, Math.PI * 2);
  }
  // Flat bottom fill
  ctx.rect(cx - w * 0.52, cy + h * 0.12, w * 1.04, h * 0.22);
  ctx.fill();

  // Inner highlight for 3D volume
  if (opts?.highlight) {
    ctx.save();
    const hl = ctx.createRadialGradient(
      cx - w * 0.12, cy - h * 0.2, 0,
      cx - w * 0.12, cy - h * 0.2, w * 0.35
    );
    hl.addColorStop(0, "rgba(255,255,255,0.18)");
    hl.addColorStop(1, "transparent");
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(cx - w * 0.12, cy - h * 0.2, w * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ── Helper: draw realistic rain drops with teardrop shape ───────────────
function drawRainDrops(
  ctx: CanvasRenderingContext2D,
  cx: number, startY: number, count: number, size: number,
  heavy: boolean
) {
  ctx.save();
  const spacing = size * 0.16;
  const startX = cx - (count - 1) * spacing * 0.5;
  const dropLen = heavy ? size * 0.22 : size * 0.14;
  const lineW = heavy ? size * 0.045 : size * 0.028;

  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing + (i % 2 === 0 ? 0 : spacing * 0.3);
    const y = startY + (i % 2 === 0 ? 0 : size * 0.07) + (i % 3) * size * 0.03;

    ctx.save();
    // Glow behind each drop
    if (heavy) {
      ctx.shadowColor = "rgba(96,165,250,0.4)";
      ctx.shadowBlur = 6;
    }

    // Teardrop gradient
    const dg = ctx.createLinearGradient(x, y, x, y + dropLen);
    dg.addColorStop(0, heavy ? "rgba(59,130,246,0.95)" : "rgba(147,197,253,0.85)");
    dg.addColorStop(1, heavy ? "rgba(37,99,235,0.6)" : "rgba(96,165,250,0.4)");
    ctx.strokeStyle = dg;
    ctx.lineCap = "round";
    ctx.lineWidth = lineW;

    // Slightly curved drop
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - size * 0.02, y + dropLen * 0.6, x - size * 0.035, y + dropLen);
    ctx.stroke();

    // Small splash at bottom for heavy rain
    if (heavy && i % 2 === 0) {
      ctx.strokeStyle = "rgba(147,197,253,0.4)";
      ctx.lineWidth = lineW * 0.5;
      const bx = x - size * 0.035;
      const by = y + dropLen;
      ctx.beginPath();
      ctx.moveTo(bx - size * 0.025, by + size * 0.01);
      ctx.lineTo(bx - size * 0.04, by - size * 0.015);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + size * 0.02, by + size * 0.01);
      ctx.lineTo(bx + size * 0.035, by - size * 0.01);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ── Helper: draw sun with prominent rays and corona ─────────────────────
function drawSun(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number, glowRadius: number
) {
  ctx.save();

  // Multi-layer corona glow
  for (let layer = 0; layer < 3; layer++) {
    const lr = glowRadius * (1.0 - layer * 0.2);
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, lr);
    const alpha = 0.22 - layer * 0.06;
    glow.addColorStop(0, `rgba(251,191,36,${alpha})`);
    glow.addColorStop(0.6, `rgba(251,191,36,${alpha * 0.3})`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }

  // 12 rays — alternating long/short for realism
  ctx.save();
  ctx.translate(cx, cy);
  const rayCount = 12;
  for (let i = 0; i < rayCount; i++) {
    ctx.rotate((Math.PI * 2) / rayCount);
    const isLong = i % 2 === 0;
    const innerR = radius * 1.08;
    const outerR = isLong ? radius * 1.7 : radius * 1.35;
    const halfW = isLong ? radius * 0.1 : radius * 0.06;

    ctx.beginPath();
    ctx.moveTo(-halfW, innerR);
    ctx.lineTo(0, outerR);
    ctx.lineTo(halfW, innerR);
    ctx.closePath();
    const rGrad = ctx.createLinearGradient(0, innerR, 0, outerR);
    rGrad.addColorStop(0, isLong ? "rgba(251,191,36,0.92)" : "rgba(251,191,36,0.7)");
    rGrad.addColorStop(1, "rgba(251,191,36,0.05)");
    ctx.fillStyle = rGrad;
    ctx.fill();
  }
  ctx.restore();

  // Sun disc with specular highlight
  ctx.save();
  ctx.shadowColor = "rgba(251,191,36,0.5)";
  ctx.shadowBlur = 20;
  const disc = ctx.createRadialGradient(
    cx - radius * 0.25, cy - radius * 0.25, radius * 0.05,
    cx, cy, radius
  );
  disc.addColorStop(0, "#fef3c7");
  disc.addColorStop(0.3, "#fde68a");
  disc.addColorStop(0.7, "#fbbf24");
  disc.addColorStop(1, "#f59e0b");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  ctx.beginPath();
  const specGrad = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, 0,
    cx - radius * 0.3, cy - radius * 0.3, radius * 0.4
  );
  specGrad.addColorStop(0, "rgba(255,255,255,0.45)");
  specGrad.addColorStop(1, "transparent");
  ctx.fillStyle = specGrad;
  ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// ── Helper: draw a dramatic lightning bolt ───────────────────────────────
function drawLightning(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  const s = size * 0.09;

  // Outer glow
  ctx.shadowColor = "rgba(251,191,36,0.7)";
  ctx.shadowBlur = 24;

  // Main bolt shape — larger and more angular
  const grad = ctx.createLinearGradient(cx, cy - s, cx, cy + s * 5.5);
  grad.addColorStop(0, "#fef9c3");
  grad.addColorStop(0.4, "#fde68a");
  grad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(cx + s * 1.0, cy);
  ctx.lineTo(cx - s * 0.8, cy + s * 2.2);
  ctx.lineTo(cx + s * 0.3, cy + s * 2.2);
  ctx.lineTo(cx - s * 1.2, cy + s * 5.5);
  ctx.lineTo(cx + s * 0.2, cy + s * 3.0);
  ctx.lineTo(cx - s * 0.6, cy + s * 3.0);
  ctx.lineTo(cx + s * 1.8, cy);
  ctx.closePath();
  ctx.fill();

  // Second pass without shadow for crisp inner shape
  ctx.shadowBlur = 0;
  const innerGrad = ctx.createLinearGradient(cx, cy + s, cx, cy + s * 4);
  innerGrad.addColorStop(0, "rgba(254,249,195,0.5)");
  innerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = innerGrad;
  ctx.fill();

  ctx.restore();
}

// ── Helper: draw snowflakes with branches ───────────────────────────────
function drawSnowflakes(ctx: CanvasRenderingContext2D, cx: number, startY: number, count: number, size: number) {
  ctx.save();
  ctx.lineCap = "round";
  const spacing = size * 0.19;
  const startX = cx - (count - 1) * spacing * 0.5;
  const r = size * 0.055;

  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing + (i % 2 === 0 ? 0 : spacing * 0.25);
    const y = startY + (i % 2 === 0 ? 0 : size * 0.09);
    const flakeSize = r * (0.85 + (i % 3) * 0.15);

    ctx.save();
    ctx.shadowColor = "rgba(191,219,254,0.5)";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "rgba(219,234,254,0.9)";
    ctx.lineWidth = size * 0.02;

    for (let a = 0; a < 6; a++) {
      const angle = (Math.PI / 3) * a;
      const ex = x + Math.cos(angle) * flakeSize;
      const ey = y + Math.sin(angle) * flakeSize;
      // Main branch
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Small side branches
      const mx = x + Math.cos(angle) * flakeSize * 0.6;
      const my = y + Math.sin(angle) * flakeSize * 0.6;
      const branchAngle1 = angle + Math.PI / 6;
      const branchAngle2 = angle - Math.PI / 6;
      const bl = flakeSize * 0.3;
      ctx.lineWidth = size * 0.012;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(branchAngle1) * bl, my + Math.sin(branchAngle1) * bl);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(branchAngle2) * bl, my + Math.sin(branchAngle2) * bl);
      ctx.stroke();
      ctx.lineWidth = size * 0.02;
    }

    // Center dot
    ctx.fillStyle = "rgba(219,234,254,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.012, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.restore();
}

// ── Helper: draw fog lines ──────────────────────────────────────────────
function drawFogLines(ctx: CanvasRenderingContext2D, cx: number, startY: number, size: number) {
  ctx.save();
  ctx.lineCap = "round";
  const widths = [size * 0.50, size * 0.38, size * 0.28, size * 0.42];
  const alphas = [0.35, 0.25, 0.18, 0.12];
  for (let i = 0; i < 4; i++) {
    const y = startY + i * size * 0.075;
    ctx.strokeStyle = `rgba(148,163,184,${alphas[i]})`;
    ctx.lineWidth = size * 0.028;
    ctx.beginPath();
    ctx.moveTo(cx - widths[i] * 0.5, y);
    ctx.lineTo(cx + widths[i] * 0.5, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Helper: wind streaks ────────────────────────────────────────────────
function drawWindStreaks(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.3)";
  ctx.lineWidth = size * 0.015;
  ctx.lineCap = "round";
  const lines = [
    { ox: -0.32, oy: -0.05, len: 0.25 },
    { ox: -0.28, oy: 0.06, len: 0.18 },
    { ox: -0.35, oy: 0.15, len: 0.22 },
  ];
  for (const l of lines) {
    const sx = cx + size * l.ox;
    const sy = cy + size * l.oy;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + size * l.len * 0.5, sy - size * 0.02, sx + size * l.len, sy + size * 0.01);
    ctx.stroke();
  }
  ctx.restore();
}

// ══════════════════════════════════════════════════════════════════════════
// Main entry: draw the weather icon based on WMO weather code
// ══════════════════════════════════════════════════════════════════════════
export function drawWeatherIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number, code: number
) {
  const r = size * 0.5;

  // ── Clear sky (code 0) ────────────────────────────────────────────
  if (code === 0) {
    drawSun(ctx, cx, cy, r * 0.42, r * 0.95);
    return;
  }

  // ── Mainly clear (code 1) ─────────────────────────────────────────
  if (code === 1) {
    drawSun(ctx, cx - r * 0.18, cy - r * 0.12, r * 0.32, r * 0.72);
    drawCloud(ctx, cx + r * 0.22, cy + r * 0.22, r * 0.55, r * 0.32,
      "rgba(226,232,240,0.8)", "rgba(148,163,184,0.55)",
      { highlight: true });
    return;
  }

  // ── Partly cloudy (code 2) ────────────────────────────────────────
  if (code === 2) {
    // Sun visible behind — draw first with clear contrast
    drawSun(ctx, cx - r * 0.28, cy - r * 0.28, r * 0.28, r * 0.6);
    // Cloud in front — substantial but shows sun peeking
    drawCloud(ctx, cx + r * 0.08, cy + r * 0.08, r * 0.78, r * 0.44,
      "#e2e8f0", "#94a3b8",
      { shadow: "rgba(100,116,139,0.25)", shadowBlur: 16, bottomShadow: true, highlight: true });
    return;
  }

  // ── Overcast (code 3) ─────────────────────────────────────────────
  if (code === 3) {
    // Back cloud — darker, offset
    drawCloud(ctx, cx - r * 0.15, cy - r * 0.12, r * 0.72, r * 0.42,
      "#64748b", "#475569",
      { shadow: "rgba(51,65,85,0.35)", shadowBlur: 20 });
    // Front cloud — denser, higher contrast, with bottom shadow
    drawCloud(ctx, cx + r * 0.12, cy + r * 0.12, r * 0.85, r * 0.48,
      "#94a3b8", "#4b5563",
      { shadow: "rgba(51,65,85,0.3)", shadowBlur: 24, bottomShadow: true, highlight: true });
    return;
  }

  // ── Fog (codes 45, 48) ────────────────────────────────────────────
  if (code === 45 || code === 48) {
    drawCloud(ctx, cx, cy - r * 0.18, r * 0.75, r * 0.38,
      "rgba(148,163,184,0.65)", "rgba(100,116,139,0.45)",
      { highlight: true });
    drawFogLines(ctx, cx, cy + r * 0.22, size);
    return;
  }

  // ── Drizzle (codes 51-55, 56-57) ──────────────────────────────────
  if (code >= 51 && code <= 57) {
    drawCloud(ctx, cx, cy - r * 0.15, r * 0.78, r * 0.42,
      "#94a3b8", "#64748b",
      { shadow: "rgba(100,116,139,0.2)", bottomShadow: true, highlight: true });
    // Sparse small drops for drizzle feel
    drawRainDrops(ctx, cx, cy + r * 0.32, 3, size, false);
    return;
  }

  // ── Light/moderate rain (codes 61-63) ─────────────────────────────
  if (code >= 61 && code <= 63) {
    drawCloud(ctx, cx, cy - r * 0.15, r * 0.82, r * 0.44,
      "#6b7280", "#374151",
      { shadow: "rgba(59,130,246,0.2)", shadowBlur: 18, bottomShadow: true, highlight: true });
    drawRainDrops(ctx, cx, cy + r * 0.32, 5, size, false);
    return;
  }

  // ── Heavy rain (codes 65-67) ──────────────────────────────────────
  if (code >= 65 && code <= 67) {
    drawCloud(ctx, cx, cy - r * 0.18, r * 0.88, r * 0.48,
      "#4b5563", "#1f2937",
      { shadow: "rgba(37,99,235,0.25)", shadowBlur: 22, bottomShadow: true });
    drawRainDrops(ctx, cx, cy + r * 0.32, 7, size, true);
    drawWindStreaks(ctx, cx + r * 0.4, cy + r * 0.1, size);
    return;
  }

  // ── Snow (codes 71-77, 85-86) ─────────────────────────────────────
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    drawCloud(ctx, cx, cy - r * 0.15, r * 0.8, r * 0.42,
      "#94a3b8", "#64748b",
      { shadow: "rgba(148,163,184,0.2)", bottomShadow: true, highlight: true });
    drawSnowflakes(ctx, cx, cy + r * 0.32, 5, size);
    return;
  }

  // ── Showers (codes 80-82) ─────────────────────────────────────────
  if (code >= 80 && code <= 82) {
    const heavy = code === 82;
    drawCloud(ctx, cx, cy - r * 0.15, r * 0.85, r * 0.46,
      heavy ? "#374151" : "#6b7280",
      heavy ? "#111827" : "#374151",
      { shadow: heavy ? "rgba(37,99,235,0.3)" : "rgba(59,130,246,0.15)", shadowBlur: 20, bottomShadow: true, highlight: !heavy });
    drawRainDrops(ctx, cx, cy + r * 0.32, heavy ? 7 : 5, size, heavy);
    if (heavy) drawWindStreaks(ctx, cx + r * 0.38, cy + r * 0.08, size);
    return;
  }

  // ── Thunderstorm (codes 95+) ──────────────────────────────────────
  if (code >= 95) {
    // Ambient red/purple glow behind the whole icon for drama
    ctx.save();
    const stormGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.9);
    stormGlow.addColorStop(0, "rgba(239,68,68,0.08)");
    stormGlow.addColorStop(0.5, "rgba(168,85,247,0.04)");
    stormGlow.addColorStop(1, "transparent");
    ctx.fillStyle = stormGlow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // Dark menacing cloud
    drawCloud(ctx, cx, cy - r * 0.22, r * 0.92, r * 0.5,
      "#374151", "#111827",
      { shadow: "rgba(239,68,68,0.2)", shadowBlur: 28, bottomShadow: true });

    // Prominent lightning
    drawLightning(ctx, cx - r * 0.05, cy + r * 0.12, size);

    // Heavy rain behind lightning
    drawRainDrops(ctx, cx, cy + r * 0.38, 6, size, true);
    return;
  }

  // ── Fallback: sun ─────────────────────────────────────────────────
  drawSun(ctx, cx, cy, r * 0.42, r * 0.95);
}
