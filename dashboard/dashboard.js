import { StatsStorage } from '../shared/storage.js';
import { PLATFORMS } from '../shared/constants.js';
import { ThemeManager } from '../shared/theme-manager.js';
import {
  calculateTotalCostAndTokens,
  calculateSubscriptionROI,
  formatCost,
  formatTokens
} from '../shared/cost-estimator.js';
import {
  generateBentoSummaryCard,
  downloadSummaryCardPNG,
  copySummaryCardToClipboard
} from './summary-card.js';

let currentStats = null;
let currentPeriod = '7d';
let wrappedCardTheme = 'dark';

document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
  await ThemeManager.init();
  setupNavigation();
  setupFilterControls();
  setupSettingsAndExport();
  setupThemeToggle();
  setupWrappedModal();
  await loadData();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ── Theme ──────────────────────────────────────────────────────
function setupThemeToggle() {
  document.getElementById('theme-btn-auto')?.addEventListener('click', () => ThemeManager.applyTheme('auto'));
  document.getElementById('theme-btn-light')?.addEventListener('click', () => ThemeManager.applyTheme('light'));
  document.getElementById('theme-btn-dark')?.addEventListener('click', () => ThemeManager.applyTheme('dark'));
}

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const heading = document.getElementById('page-heading');
  const subheading = document.getElementById('page-subheading');

  const titles = {
    overview: { title: 'Usage Overview', sub: 'How many messages you have sent to AI assistants.' },
    history:  { title: 'Daily History', sub: 'Message counts broken down by day and platform.' },
    settings: { title: 'Settings & Data Export', sub: 'Configure the extension and export your personal data.' }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-tab');
      navButtons.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${tabKey}`);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      if (titles[tabKey] && heading && subheading) {
        heading.textContent = titles[tabKey].title;
        subheading.textContent = titles[tabKey].sub;
      }

      if (tabKey === 'history') {
        renderHistoryTable();
      }

      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  });
}

function setupFilterControls() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.getAttribute('data-period') || '7d';
      await loadData();
    });
  });

  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh');
    if (btn) btn.classList.add('loading');
    await loadData();
    if (btn) setTimeout(() => btn.classList.remove('loading'), 300);
  });
}

async function loadData() {
  try {
    const daysArg = currentPeriod === '30d' ? 30 : (currentPeriod === 'all' ? 'all' : 7);
    currentStats = await StatsStorage.getSummaryStats(daysArg);
    renderDashboard();
  } catch (err) {
    console.error('[AIStat] Failed to load dashboard data:', err);
  }
}

function renderDashboard() {
  if (!currentStats) return;

  renderKPIs();
  renderActivityChart();
  renderPlatformChart();
  renderHourlyHeatmap();
  renderSettingsForm();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// 1. KPI Cards
function renderKPIs() {
  const { today, week, month, allTime, streak } = currentStats;

  const todayEl = document.getElementById('kpi-today');
  const weekEl = document.getElementById('kpi-week');
  const monthEl = document.getElementById('kpi-month');
  const alltimeEl = document.getElementById('kpi-alltime');
  const streakEl = document.getElementById('kpi-streak-sub');
  const weekSubEl = document.getElementById('kpi-week-sub');
  const topPlatformEl = document.getElementById('kpi-top-platform');

  if (todayEl) todayEl.textContent = today.messagesCount || 0;
  if (weekEl) weekEl.textContent = week.messages || 0;
  if (monthEl) monthEl.textContent = month.messages || 0;
  if (alltimeEl) alltimeEl.textContent = allTime.messages || 0;
  if (streakEl) streakEl.textContent = `${streak || 0} day streak`;

  const dailyAvg = (week.messages || 0) > 0 ? ((week.messages || 0) / 7).toFixed(1) : '0';
  if (weekSubEl) weekSubEl.textContent = `~${dailyAvg}/day avg (last 7d)`;

  // Calculate top platform
  const pTotals = allTime.platformTotals || week.platformTotals || {};
  let topP = '—';
  let topCount = 0;
  Object.entries(pTotals).forEach(([pId, count]) => {
    if (count > topCount) {
      topCount = count;
      topP = PLATFORMS[pId]?.name || pId;
    }
  });
  if (topPlatformEl) {
    topPlatformEl.textContent = topCount > 0 ? `${topP} (${topCount})` : '— most used';
  }
}

// 2. Activity Bar Chart
function renderActivityChart() {
  const container = document.getElementById('activity-chart-container');
  if (!container || !currentStats.period?.timeline) return;

  const days = currentStats.period.timeline;
  const maxMsgs = Math.max(1, ...days.map(d => d.messagesCount));
  const is30 = days.length > 14;

  let barsHtml = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 160px; padding: 0 4px; border-bottom: 1px solid var(--border-soft); overflow-x: auto;">
  `;

  days.forEach((d, idx) => {
    const heightPercent = Math.max(4, Math.round((d.messagesCount / maxMsgs) * 100));
    const showCount = !is30 || d.messagesCount > 0;
    const isToday = idx === days.length - 1;

    barsHtml += `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-width: ${is30 ? '16px' : '28px'};" title="${d.date}: ${d.messagesCount} messages">
        <span style="font-size: 10px; font-weight: 700; color: var(--accent);">${showCount && d.messagesCount > 0 ? d.messagesCount : ''}</span>
        <div style="width: ${is30 ? '12px' : '22px'}; height: 120px; background: var(--bg-subtle); border-radius: 4px; display: flex; align-items: flex-end; overflow: hidden;">
          <div style="width: 100%; height: ${heightPercent}%; background: ${isToday ? '#10a37f' : 'linear-gradient(180deg, var(--gold), var(--accent))'}; border-radius: 4px;"></div>
        </div>
        <span style="font-size: ${is30 ? '9px' : '11px'}; color: var(--text-muted); font-weight: 600; white-space: nowrap;">${d.label || ''}</span>
      </div>
    `;
  });

  barsHtml += `
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted); padding: 0 4px;">
        <span>Period total: <strong style="color: var(--text-heading);">${currentStats.period.messages || 0} messages</strong></span>
        <span>Daily avg: <strong style="color: var(--text-heading);">${((currentStats.period.messages || 0) / Math.max(1, days.length)).toFixed(1)}</strong></span>
      </div>
    </div>
  `;

  container.innerHTML = barsHtml;
}

// 3. Platform Breakdown
function renderPlatformChart() {
  const container = document.getElementById('platform-chart-container');
  if (!container) return;

  const totals = currentStats.period?.platformTotals || currentStats.week?.platformTotals || {};
  const totalMsgs = Object.values(totals).reduce((a, b) => a + b, 0);

  let html = `<div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">`;

  if (totalMsgs === 0) {
    html += `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
        <p style="font-size: 13px; font-weight: 500;">No prompt activity logged yet.</p>
        <p style="font-size: 11.5px; margin-top: 4px;">Start prompting on ChatGPT, Claude, Gemini, Perplexity, or DeepSeek to see your breakdown.</p>
      </div>
    `;
  } else {
    const sorted = Object.entries(PLATFORMS)
      .map(([id, p]) => {
        const count = totals[id] || 0;
        const pct = totalMsgs > 0 ? Math.round((count / totalMsgs) * 100) : 0;
        return { id, p, count, pct };
      })
      .sort((a, b) => b.count - a.count);

    sorted.forEach(({ p, count, pct }) => {
      html += `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
            <span style="color: var(--text-primary);">${p.name}</span>
            <span style="color: var(--text-muted);">${count} msgs (${pct}%)</span>
          </div>
          <div style="height: 8px; background: var(--bg-subtle); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background: ${p.color}; border-radius: 4px; transition: width 0.4s ease;"></div>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;
  container.innerHTML = html;
}

// 4. Hourly Heatmap
function renderHourlyHeatmap() {
  const container = document.getElementById('hourly-heatmap-container');
  if (!container) return;

  const hourCounts = new Array(24).fill(0);
  const todayHours = currentStats.today.hours || {};
  Object.entries(todayHours).forEach(([h, count]) => {
    hourCounts[parseInt(h, 10)] = count;
  });

  const maxHour = Math.max(1, ...hourCounts);

  let html = `<div class="heatmap-grid">`;

  for (let i = 0; i < 24; i++) {
    const count = hourCounts[i];
    const intensity = count > 0 ? Math.max(0.15, count / maxHour) : 0;
    const bg = count > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--bg-subtle))` : 'var(--bg-subtle)';
    const textColor = count > 0 ? 'var(--text-heading)' : 'var(--text-muted)';

    html += `
      <div class="heat-cell" style="background: ${bg}; color: ${textColor};" title="${i}:00–${i}:59 (${count} messages)">
        ${count > 0 ? count : ''}
      </div>
    `;
  }

  html += `
    </div>
    <div class="heat-labels">
      <span>12 AM</span>
      <span>6 AM</span>
      <span>12 PM</span>
      <span>6 PM</span>
      <span>11 PM</span>
    </div>
  `;

  container.innerHTML = html;
}

// 5. Daily History Table
async function renderHistoryTable() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  const dailyLogs = await StatsStorage.getDailyLogs();
  const sorted = Object.values(dailyLogs).sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No usage history logged yet. Start prompting on any AI platform to see records here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sorted.map(day => `
    <tr>
      <td><strong>${day.date}</strong></td>
      <td><span style="color: var(--accent); font-weight: 700;">${day.messagesCount || 0}</span></td>
      <td>${day.platforms?.chatgpt || 0}</td>
      <td>${day.platforms?.claude || 0}</td>
      <td>${day.platforms?.gemini || 0}</td>
      <td>${day.platforms?.deepseek || 0}</td>
      <td>${day.platforms?.perplexity || 0}</td>
      <td>${day.platforms?.aisearch || 0}</td>
    </tr>
  `).join('');
}

// ── 5.5 AIStat Wrapped (Bento Summary Card) ──────────────────────
async function renderWrappedCard() {
  const canvas = document.getElementById('bento-summary-canvas');
  if (!canvas) return;

  try {
    const dailyLogs = await StatsStorage.getDailyLogs();
    generateBentoSummaryCard(dailyLogs, {
      theme: wrappedCardTheme,
      targetCanvas: canvas
    });
  } catch (err) {
    console.error('[AIStat] Error generating bento summary card:', err);
  }
}

function setupWrappedModal() {
  const modal = document.getElementById('modal-wrapped');
  const openBtn = document.getElementById('btn-open-wrapped');
  const closeBtn = document.getElementById('btn-close-wrapped-modal');
  const darkBtn = document.getElementById('card-theme-dark');
  const lightBtn = document.getElementById('card-theme-light');
  const copyBtn = document.getElementById('btn-copy-card');
  const copyBtnText = document.getElementById('copy-btn-text');
  const downloadBtn = document.getElementById('btn-download-card');
  const canvas = document.getElementById('bento-summary-canvas');

  const openModal = async () => {
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      await renderWrappedCard();
      if (window.lucide) window.lucide.createIcons();
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeModal();
    }
  });

  darkBtn?.addEventListener('click', async () => {
    wrappedCardTheme = 'dark';
    darkBtn.classList.add('active');
    lightBtn?.classList.remove('active');
    await renderWrappedCard();
  });

  lightBtn?.addEventListener('click', async () => {
    wrappedCardTheme = 'light';
    lightBtn.classList.add('active');
    darkBtn?.classList.remove('active');
    await renderWrappedCard();
  });

  downloadBtn?.addEventListener('click', () => {
    if (canvas) {
      const today = new Date().toISOString().slice(0, 10);
      downloadSummaryCardPNG(canvas, `aistat-wrapped-${today}.png`);
    }
  });

  copyBtn?.addEventListener('click', async () => {
    if (!canvas) return;
    try {
      if (copyBtnText) copyBtnText.textContent = 'Copying...';
      const ok = await copySummaryCardToClipboard(canvas);
      if (ok) {
        if (copyBtnText) copyBtnText.textContent = 'Copied to Clipboard!';
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy Image';
        }, 2000);
      } else {
        // If navigator.clipboard.write([ClipboardItem]) not available
        downloadSummaryCardPNG(canvas, `aistat-wrapped.png`);
        if (copyBtnText) copyBtnText.textContent = 'Downloaded PNG!';
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy Image';
        }, 2000);
      }
    } catch (err) {
      console.warn('[AIStat] Clipboard copy fallback to download:', err);
      downloadSummaryCardPNG(canvas, `aistat-wrapped.png`);
      if (copyBtnText) copyBtnText.textContent = 'Downloaded PNG!';
      setTimeout(() => {
        if (copyBtnText) copyBtnText.textContent = 'Copy Image';
      }, 2000);
    }
  });
}

// 6. Settings
function renderSettingsForm() {
  if (!currentStats?.settings) return;
  const s = currentStats.settings;
  const badgeSelect = document.getElementById('setting-badge');
  if (badgeSelect) badgeSelect.value = s.badgeDisplay || 'message_count';

  const reasoningSelect = document.getElementById('setting-reasoning');
  if (reasoningSelect && s.reasoningEffort) reasoningSelect.value = s.reasoningEffort;

  const subSelect = document.getElementById('setting-subscription');
  if (subSelect && s.subscription) subSelect.value = s.subscription;
}

function setupSettingsAndExport() {
  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const badgeSelect = document.getElementById('setting-badge');
    const badgeDisplay = badgeSelect ? badgeSelect.value : 'message_count';

    const reasoningSelect = document.getElementById('setting-reasoning');
    const reasoningEffort = reasoningSelect ? reasoningSelect.value : 'medium';

    const subSelect = document.getElementById('setting-subscription');
    const subscription = subSelect ? subSelect.value : 'free';

    await StatsStorage.updateSettings({ badgeDisplay, reasoningEffort, subscription });
    alert('Preferences saved successfully!');
    await loadData();
  });

  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    const json = await StatsStorage.exportJSON();
    downloadFile(json, `aistat-data-${Date.now()}.json`, 'application/json');
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    const csv = await StatsStorage.exportCSV();
    downloadFile(csv, `aistat-usage-${Date.now()}.csv`, 'text/csv');
  });

  document.getElementById('btn-import-json')?.addEventListener('click', () => {
    document.getElementById('file-import-json')?.click();
  });

  document.getElementById('file-import-json')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const validation = StatsStorage.validateBackup(text);
      if (!validation.valid) {
        alert(`Failed to import backup:\n• ${validation.errors.join('\n• ')}`);
        return;
      }

      const shouldMerge = confirm('Do you want to MERGE this backup with your existing logs?\n\n• Click "OK" to MERGE (retains higher counts for duplicate days)\n• Click "Cancel" to OVERWRITE all existing logs with this backup');
      const mode = shouldMerge ? 'merge' : 'overwrite';

      await StatsStorage.importBackup(text, { mode });
      alert(`Backup successfully imported (${mode} mode)!`);
      await loadData();
      renderHistoryTable();
    } catch (err) {
      alert(`Import error: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  });

  document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
    if (confirm('Permanently clear all local usage stats? This cannot be undone.')) {
      await chrome.runtime.sendMessage({ type: 'RESET_DATA' });
      alert('All local stats have been cleared.');
      await loadData();
      renderHistoryTable();
    }
  });
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
