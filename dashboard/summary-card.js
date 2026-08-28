/**
 * AIStat - Human-Crafted Swiss Bento Summary Card ("AIStat Wrapped")
 * High-DPI Canvas Renderer for Weekly Insights & Sharing.
 */
import { analyzeWeeklyTrends } from '../shared/trend-analyzer.js';

/**
 * Helper to draw rounded rectangle on Canvas
 */
function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Generate high-DPI Swiss Bento Summary Card
 * @param {Object} stats - Summary stats or dailyLogs object
 * @param {Object} [options]
 * @param {'dark'|'light'} [options.theme='dark']
 * @param {'canvas'|'dataURL'|'blob'} [options.format='canvas']
 * @param {HTMLCanvasElement} [options.targetCanvas] - Existing canvas element to render onto
 * @returns {HTMLCanvasElement|Promise<string|Blob>}
 */
export function generateBentoSummaryCard(stats, options = {}) {
  const theme = options.theme || 'dark';
  const format = options.format || 'canvas';

  // Extract or compute weekly trend analytics
  let trends;
  if (stats && stats.dailyLogs) {
    trends = analyzeWeeklyTrends(stats.dailyLogs, options);
  } else if (stats && stats.totalThisWeek !== undefined) {
    trends = stats;
  } else if (stats && typeof stats === 'object') {
    trends = analyzeWeeklyTrends(stats, options);
  } else {
    trends = analyzeWeeklyTrends({}, options);
  }

  // Target logical dimensions: 800 x 480
  const width = 800;
  const height = 480;
  const scale = 2; // 2x high-DPI retina

  let canvas = options.targetCanvas;
  if (!canvas) {
    canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  }

  if (canvas) {
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  if (!canvas || !canvas.getContext) {
    return canvas;
  }

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);

  // ── Palette Configuration ──
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0b0f19' : '#f8fafc',
    cardBg: isDark ? '#131b2e' : '#ffffff',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    accent: '#6366f1', // Indigo
    accentGradientStart: '#6366f1',
    accentGradientEnd: '#8b5cf6',
    pillPositiveBg: isDark ? 'rgba(16, 185, 129, 0.18)' : '#dcfce7',
    pillPositiveText: isDark ? '#34d399' : '#15803d',
    pillNegativeBg: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
    pillNegativeText: isDark ? '#f87171' : '#b91c1c',
    pillNeutralBg: isDark ? 'rgba(148, 163, 184, 0.18)' : '#f1f5f9',
    pillNeutralText: isDark ? '#cbd5e1' : '#475569',
    trackBg: isDark ? '#1e293b' : '#e2e8f0',
    brandGold: '#f59e0b'
  };

  const fontSans = '-apple-system, BlinkMacSystemFont, "DM Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // ── 1. Card Background ──
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle background glow / gradient in dark mode
  if (isDark) {
    const radialGlow = ctx.createRadialGradient(width * 0.8, 40, 10, width * 0.8, 40, 300);
    radialGlow.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    radialGlow.addColorStop(1, 'rgba(11, 15, 25, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, width, height);
  }

  // ── 2. Top Header ──
  // Brand Logo Mark
  const logoX = 28;
  const logoY = 24;

  // Draw Logo Icon Circle
  const logoGrad = ctx.createLinearGradient(logoX, logoY, logoX + 28, logoY + 28);
  logoGrad.addColorStop(0, '#6366f1');
  logoGrad.addColorStop(1, '#a855f7');
  ctx.fillStyle = logoGrad;
  drawRoundRect(ctx, logoX, logoY, 28, 28, 8);
  ctx.fill();

  // Draw Lightning / Bar inside Logo
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(logoX + 15, logoY + 6);
  ctx.lineTo(logoX + 9, logoY + 16);
  ctx.lineTo(logoX + 14, logoY + 16);
  ctx.lineTo(logoX + 13, logoY + 22);
  ctx.lineTo(logoX + 19, logoY + 12);
  ctx.lineTo(logoX + 14, logoY + 12);
  ctx.closePath();
  ctx.fill();

  // Brand Name
  ctx.fillStyle = colors.textPrimary;
  ctx.font = `700 18px ${fontSans}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('AIStat', logoX + 36, logoY + 14);

  // "WRAPPED" badge
  const wrappedBadgeX = logoX + 104;
  const wrappedBadgeY = logoY + 3;
  ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.25)' : '#e0e7ff';
  drawRoundRect(ctx, wrappedBadgeX, wrappedBadgeY, 82, 22, 6);
  ctx.fill();

  ctx.fillStyle = isDark ? '#a5b4fc' : '#4338ca';
  ctx.font = `800 10.5px ${fontSans}`;
  ctx.fillText('WRAPPED', wrappedBadgeX + 13, wrappedBadgeY + 11);

  // Period Badge (Right Side)
  const periodText = trends.periodLabel || 'Weekly Summary';
  ctx.font = `600 12px ${fontSans}`;
  const periodTextWidth = ctx.measureText(periodText).width;
  const periodBoxWidth = periodTextWidth + 24;
  const periodBoxX = width - 28 - periodBoxWidth;
  const periodBoxY = logoY + 2;

  ctx.fillStyle = isDark ? '#1e293b' : '#f1f5f9';
  drawRoundRect(ctx, periodBoxX, periodBoxY, periodBoxWidth, 24, 12);
  ctx.fill();
  ctx.strokeStyle = colors.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = colors.textSecondary;
  ctx.textAlign = 'center';
  ctx.fillText(periodText, periodBoxX + periodBoxWidth / 2, periodBoxY + 12);

  // ── Helper to render standard Bento Box ──
  function renderBentoBox(bx, by, bw, bh) {
    ctx.fillStyle = colors.cardBg;
    drawRoundRect(ctx, bx, by, bw, bh, 14);
    ctx.fill();

    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ── 3. Bento Grid Boxes Layout ──
  const gap = 16;
  const margin = 28;
  const boxWidth = (width - margin * 2 - gap) / 2; // 356px each
  const row1Y = 66;
  const row1H = 168;
  const row2Y = row1Y + row1H + gap; // 250
  const row2H = 170;

  // ── BOX 1: Weekly Total & WoW Trend (Top Left) ──
  renderBentoBox(margin, row1Y, boxWidth, row1H);

  // Section Label
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.textSecondary;
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText('WEEKLY MESSAGES', margin + 18, row1Y + 22);

  // Big Metric
  const totalCount = trends.totalThisWeek !== undefined ? trends.totalThisWeek : 0;
  ctx.fillStyle = colors.textPrimary;
  ctx.font = `800 46px ${fontSans}`;
  ctx.fillText(String(totalCount), margin + 18, row1Y + 68);

  ctx.font = `600 14px ${fontSans}`;
  ctx.fillStyle = colors.textSecondary;
  const countWidth = ctx.measureText(String(totalCount)).width;
  ctx.fillText('prompts sent', margin + 24 + countWidth, row1Y + 70);

  // Week-over-Week Trend Pill
  const wowDirection = trends.wowDirection || (trends.wowDeltaPct > 0 ? 'up' : (trends.wowDeltaPct < 0 ? 'down' : 'neutral'));
  const wowText = `${wowDirection === 'up' ? '▲ ' : (wowDirection === 'down' ? '▼ ' : '')}${trends.wowDeltaFormatted || '0%'} vs last week`;

  ctx.font = `700 11px ${fontSans}`;
  const pillW = ctx.measureText(wowText).width + 18;
  const pillH = 22;
  const pillX = margin + 18;
  const pillY = row1Y + 98;

  let pillBg = colors.pillNeutralBg;
  let pillColor = colors.pillNeutralText;
  if (wowDirection === 'up') {
    pillBg = colors.pillPositiveBg;
    pillColor = colors.pillPositiveText;
  } else if (wowDirection === 'down') {
    pillBg = colors.pillNegativeBg;
    pillColor = colors.pillNegativeText;
  }

  ctx.fillStyle = pillBg;
  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 6);
  ctx.fill();

  ctx.fillStyle = pillColor;
  ctx.fillText(wowText, pillX + 9, pillY + 11);

  // Sub-detail
  ctx.fillStyle = colors.textMuted;
  ctx.font = `500 11.5px ${fontSans}`;
  const daysActive = trends.daysActiveThisWeek || (totalCount > 0 ? 1 : 0);
  ctx.fillText(`~${trends.dailyAverageFormatted || '0.0'}/day avg · ${daysActive} active days`, margin + 18, row1Y + 144);

  // ── BOX 2: Platform Distribution (Top Right) ──
  const b2X = margin + boxWidth + gap;
  renderBentoBox(b2X, row1Y, boxWidth, row1H);

  ctx.fillStyle = colors.textSecondary;
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText('PLATFORM BREAKDOWN', b2X + 18, row1Y + 22);

  // Multi-color segmented distribution bar
  const barX = b2X + 18;
  const barY = row1Y + 42;
  const barW = boxWidth - 36;
  const barH = 14;

  ctx.fillStyle = colors.trackBg;
  drawRoundRect(ctx, barX, barY, barW, barH, 7);
  ctx.fill();

  const ranked = trends.platformsRanked || [];
  const activePlatforms = ranked.filter(p => p.count > 0);

  if (activePlatforms.length === 0) {
    // Empty state placeholder
    ctx.fillStyle = isDark ? '#1e293b' : '#cbd5e1';
    drawRoundRect(ctx, barX, barY, barW, barH, 7);
    ctx.fill();

    ctx.fillStyle = colors.textMuted;
    ctx.font = `500 12px ${fontSans}`;
    ctx.fillText('No prompts recorded yet', b2X + 18, row1Y + 86);
  } else {
    let currentX = barX;
    activePlatforms.forEach((p, idx) => {
      const segW = Math.max(idx === activePlatforms.length - 1 ? (barX + barW - currentX) : 0, Math.round((p.percentage / 100) * barW));
      if (segW > 0 && currentX < barX + barW) {
        ctx.save();
        drawRoundRect(ctx, barX, barY, barW, barH, 7);
        ctx.clip();
        ctx.fillStyle = p.color || '#6366f1';
        ctx.fillRect(currentX, barY, segW, barH);
        ctx.restore();
        currentX += segW;
      }
    });

    // Platform tags legend (Top 4)
    const top4 = activePlatforms.slice(0, 4);
    const legendY = row1Y + 76;
    const itemH = 20;

    top4.forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const itemX = b2X + 18 + col * (boxWidth / 2 - 10);
      const curY = legendY + row * (itemH + 8);

      // Color Dot
      ctx.fillStyle = p.color || '#6366f1';
      ctx.beginPath();
      ctx.arc(itemX + 5, curY + 6, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Platform name & percent
      ctx.fillStyle = colors.textPrimary;
      ctx.font = `600 11.5px ${fontSans}`;
      ctx.fillText(p.name, itemX + 15, curY + 6);

      ctx.fillStyle = colors.textSecondary;
      ctx.font = `700 11px ${fontSans}`;
      ctx.fillText(`${p.percentage}%`, itemX + 115, curY + 6);
    });
  }

  // ── BOX 3: Productivity Pulse (Bottom Left) ──
  renderBentoBox(margin, row2Y, boxWidth, row2H);

  ctx.fillStyle = colors.textSecondary;
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText('PRODUCTIVITY PULSE', margin + 18, row2Y + 22);

  // Peak Hour Column
  const halfW = (boxWidth - 36) / 2;
  const col1X = margin + 18;
  const col2X = margin + 18 + halfW;

  // Peak Hour Sub-card
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc';
  drawRoundRect(ctx, col1X, row2Y + 38, halfW - 6, 114, 10);
  ctx.fill();
  ctx.strokeStyle = colors.cardBorder;
  ctx.stroke();

  ctx.fillStyle = colors.brandGold;
  ctx.font = `600 11px ${fontSans}`;
  ctx.fillText('⚡ Peak Hour', col1X + 12, row2Y + 58);

  ctx.fillStyle = colors.textPrimary;
  ctx.font = `800 24px ${fontSans}`;
  ctx.fillText(trends.peakHour || '14:00', col1X + 12, row2Y + 92);

  ctx.fillStyle = colors.textMuted;
  ctx.font = `500 10.5px ${fontSans}`;
  ctx.fillText('Highest AI activity', col1X + 12, row2Y + 124);

  // Active Streak Sub-card
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc';
  drawRoundRect(ctx, col2X + 6, row2Y + 38, halfW - 6, 114, 10);
  ctx.fill();
  ctx.strokeStyle = colors.cardBorder;
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = `600 11px ${fontSans}`;
  ctx.fillText('🔥 Active Streak', col2X + 18, row2Y + 58);

  const streakDays = trends.activeStreak || 0;
  ctx.fillStyle = colors.textPrimary;
  ctx.font = `800 24px ${fontSans}`;
  ctx.fillText(`${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}`, col2X + 18, row2Y + 92);

  ctx.fillStyle = colors.textMuted;
  ctx.font = `500 10.5px ${fontSans}`;
  ctx.fillText(streakDays > 0 ? 'Consecutive active' : 'Start your streak', col2X + 18, row2Y + 124);

  // ── BOX 4: Compute & Token Valuation (Bottom Right) ──
  renderBentoBox(b2X, row2Y, boxWidth, row2H);

  ctx.fillStyle = colors.textSecondary;
  ctx.font = `700 11px ${fontSans}`;
  ctx.fillText('TOKENS & COMPUTE VALUE', b2X + 18, row2Y + 22);

  // Token Stat
  ctx.fillStyle = colors.textPrimary;
  ctx.font = `800 36px ${fontSans}`;
  ctx.fillText(trends.estimatedTokensFormatted || '0', b2X + 18, row2Y + 68);

  ctx.font = `600 13px ${fontSans}`;
  ctx.fillStyle = colors.textSecondary;
  const tokenStrW = ctx.measureText(trends.estimatedTokensFormatted || '0').width;
  ctx.fillText('est. tokens', b2X + 26 + tokenStrW, row2Y + 68);

  // Compute Value Pill
  const computeValX = b2X + 18;
  const computeValY = row2Y + 92;
  const computeValText = `~${trends.estimatedComputeValueFormatted || '$0.00'} API Value`;

  ctx.font = `700 11.5px ${fontSans}`;
  const compPillW = ctx.measureText(computeValText).width + 20;

  ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe';
  drawRoundRect(ctx, computeValX, computeValY, compPillW, 24, 6);
  ctx.fill();

  ctx.fillStyle = isDark ? '#c4b5fd' : '#6d28d9';
  ctx.fillText(computeValText, computeValX + 10, computeValY + 12);

  ctx.fillStyle = colors.textMuted;
  ctx.font = `500 11px ${fontSans}`;
  ctx.fillText('Based on frontier model inference equivalents', b2X + 18, row2Y + 138);

  // ── 4. Footer ──
  const footerY = height - 16;

  // Local-first Privacy Badge (Left)
  ctx.textAlign = 'left';
  ctx.font = `500 10.5px ${fontSans}`;
  ctx.fillStyle = colors.textMuted;
  ctx.fillText('🔒 100% Local-First Privacy · Stored exclusively on your computer', margin, footerY);

  // Watermark (Right)
  ctx.textAlign = 'right';
  ctx.fillText('AIStat v2.0 · Open Source', width - margin, footerY);

  ctx.restore();

  if (format === 'dataURL') {
    return canvas.toDataURL('image/png');
  }

  if (format === 'blob') {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  return canvas;
}

/**
 * Trigger browser download of summary card as PNG
 * @param {HTMLCanvasElement} canvas
 * @param {string} [filename='aistat-weekly-wrapped.png']
 */
export function downloadSummaryCardPNG(canvas, filename = 'aistat-weekly-wrapped.png') {
  if (!canvas || !canvas.toDataURL) return;
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Copy summary card image to system clipboard
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<boolean>}
 */
export async function copySummaryCardToClipboard(canvas) {
  if (!canvas || !canvas.toBlob) {
    throw new Error('Valid canvas element required');
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) {
        reject(new Error('Failed to create image blob'));
        return;
      }

      try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          resolve(true);
        } else {
          // Fallback or unsupported clipboard image API
          resolve(false);
        }
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}
