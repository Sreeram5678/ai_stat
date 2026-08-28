import { StatsStorage } from '../shared/storage.js';
import { PLATFORMS } from '../shared/constants.js';
import { CATEGORIES } from '../shared/topic-categorizer.js';
import { ThemeManager } from '../shared/theme-manager.js';
import {
  calculateTotalCostAndTokens,
  calculateSubscriptionROI,
  formatCost,
  formatTokens
} from '../shared/cost-estimator.js';
import {
  calculatePromptVelocity,
  calculateTurnaroundTimes,
  calculateContextSwitching,
  calculateWorkstyleRatios,
  buildWeeklyHeatmapMatrix
} from '../shared/velocity-analyzer.js';
import {
  exportMarkdownReport,
  exportAnonymousBenchmark
} from '../shared/telemetry-exporter.js';
import {
  generateBentoSummaryCard,
  downloadSummaryCardPNG,
  copySummaryCardToClipboard
} from './summary-card.js';
import { ROISimulator } from './roi-simulator.js';

let rawDailyLogs = {};
let currentStats = null;
let currentPeriod = '7d';
let wrappedCardTheme = 'dark';
let roiSimulatorInstance = null;

// Composable Filter State
const filterState = {
  platform: 'all',
  topic: 'all',
  session: 'all'
};

document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
  await ThemeManager.init();
  setupNavigation();
  setupFilterControls();
  setupDimensionFilters();
  setupSettingsAndExport();
  setupThemeToggle();
  setupWrappedModal();

  // Mount ROI Simulator
  roiSimulatorInstance = new ROISimulator({ containerId: 'roi-simulator-container' });
  roiSimulatorInstance.mount();

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
    overview:  { title: 'Usage Overview', sub: 'Personal AI analytics, velocity metrics, topic categorization, and cost arbitrage.' },
    arbitrage: { title: 'Model Arbitrage & ROI Simulator', sub: 'Real-time client-side interactive modeling across LLM providers and subscriptions.' },
    history:   { title: 'Daily History', sub: 'Message counts broken down by day, platform, and primary topic.' },
    settings:  { title: 'Settings & Data Export', sub: 'Configure retention policies, badge behavior, and export your personal data.' }
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
      } else if (tabKey === 'arbitrage' && roiSimulatorInstance) {
        roiSimulatorInstance.update();
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

function setupDimensionFilters() {
  const platformSel = document.getElementById('filter-platform');
  const topicSel = document.getElementById('filter-topic');
  const sessionSel = document.getElementById('filter-session');
  const resetBtn = document.getElementById('btn-reset-filters');

  const applyFilters = () => {
    if (platformSel) filterState.platform = platformSel.value;
    if (topicSel) filterState.topic = topicSel.value;
    if (sessionSel) filterState.session = sessionSel.value;
    renderDashboard();
  };

  platformSel?.addEventListener('change', applyFilters);
  topicSel?.addEventListener('change', applyFilters);
  sessionSel?.addEventListener('change', applyFilters);

  resetBtn?.addEventListener('click', () => {
    filterState.platform = 'all';
    filterState.topic = 'all';
    filterState.session = 'all';
    if (platformSel) platformSel.value = 'all';
    if (topicSel) topicSel.value = 'all';
    if (sessionSel) sessionSel.value = 'all';
    renderDashboard();
  });
}

async function loadData() {
  try {
    rawDailyLogs = await StatsStorage.getDailyLogs();
    const daysArg = currentPeriod === '30d' ? 30 : (currentPeriod === '90d' ? 90 : (currentPeriod === 'all' ? 'all' : 7));
    currentStats = await StatsStorage.getSummaryStats(daysArg);
    renderDashboard();
  } catch (err) {
    console.error('[AIStat] Failed to load dashboard data:', err);
  }
}

/**
 * Filters the daily logs dataset based on active composable filters without mutating raw data.
 */
function getFilteredDailyLogs() {
  const filtered = {};
  Object.entries(rawDailyLogs).forEach(([dateKey, day]) => {
    if (!day) return;

    let dayCount = 0;
    const cleanPlatforms = {};
    const cleanTopics = {};

    if (day.platforms) {
      Object.entries(day.platforms).forEach(([p, c]) => {
        if (filterState.platform === 'all' || filterState.platform === p) {
          cleanPlatforms[p] = c;
          dayCount += c;
        }
      });
    }

    if (day.topics) {
      Object.entries(day.topics).forEach(([t, c]) => {
        if (filterState.topic === 'all' || filterState.topic === t) {
          cleanTopics[t] = c;
        }
      });
    }

    // Check if day matches active topic filter when topic != 'all'
    if (filterState.topic !== 'all') {
      const topicCount = day.topics?.[filterState.topic] || 0;
      if (topicCount === 0) return;
    }

    // Check platform filter
    if (filterState.platform !== 'all' && dayCount === 0) {
      return;
    }

    filtered[dateKey] = {
      ...day,
      messagesCount: dayCount > 0 ? dayCount : day.messagesCount,
      platforms: cleanPlatforms,
      topics: cleanTopics
    };
  });

  return filtered;
}

function renderDashboard() {
  if (!currentStats) return;

  renderKPIs();
  renderActivityChart();
  renderPlatformChart();
  renderTopicDistribution();
  renderProductivityIntelligence();
  renderWeeklyHeatmap();
  renderSettingsForm();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// 1. KPI Cards
function renderKPIs() {
  const { today, week, month, allTime, streak, period } = currentStats;

  const todayEl = document.getElementById('kpi-today');
  const weekEl = document.getElementById('kpi-week');
  const velocityEl = document.getElementById('kpi-velocity');
  const complexityEl = document.getElementById('kpi-complexity');
  const streakEl = document.getElementById('kpi-streak-sub');
  const weekSubEl = document.getElementById('kpi-week-sub');
  const topPlatformEl = document.getElementById('kpi-top-platform');

  if (todayEl) todayEl.textContent = today.messagesCount || 0;
  if (weekEl) weekEl.textContent = week.messages || 0;
  if (streakEl) streakEl.textContent = `${streak || 0} day streak`;

  const dailyAvg = (week.messages || 0) > 0 ? ((week.messages || 0) / 7).toFixed(1) : '0';
  if (weekSubEl) weekSubEl.textContent = `~${dailyAvg}/day avg (last 7d)`;

  // Prompt velocity estimate
  const activeHoursToday = Object.keys(today.hours || {}).length || 1;
  const velocityVal = today.messagesCount > 0 ? (today.messagesCount / activeHoursToday).toFixed(1) : '0.0';
  if (velocityEl) velocityEl.textContent = velocityVal;

  // Average Complexity
  const avgComp = period?.averageComplexity || today?.avgComplexity || 35;
  if (complexityEl) complexityEl.textContent = Math.round(avgComp);

  // Top platform
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
  const isLarge = days.length > 14;

  let barsHtml = `
    <div style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 160px; padding: 0 4px; border-bottom: 1px solid var(--border-soft); overflow-x: auto;">
  `;

  days.forEach((d, idx) => {
    const heightPercent = Math.max(4, Math.round((d.messagesCount / maxMsgs) * 100));
    const showCount = !isLarge || d.messagesCount > 0;
    const isToday = idx === days.length - 1;

    barsHtml += `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-width: ${isLarge ? '14px' : '26px'};" title="${d.date}: ${d.messagesCount} messages">
        <span style="font-size: 9.5px; font-weight: 700; color: var(--accent);">${showCount && d.messagesCount > 0 ? d.messagesCount : ''}</span>
        <div style="width: ${isLarge ? '10px' : '20px'}; height: 120px; background: var(--bg-subtle); border-radius: 4px; display: flex; align-items: flex-end; overflow: hidden;">
          <div style="width: 100%; height: ${heightPercent}%; background: ${isToday ? '#10a37f' : 'linear-gradient(180deg, var(--gold), var(--accent))'}; border-radius: 4px;"></div>
        </div>
        <span style="font-size: ${isLarge ? '8.5px' : '10.5px'}; color: var(--text-muted); font-weight: 600; white-space: nowrap;">${d.label || ''}</span>
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
        <p style="font-size: 13px; font-weight: 500;">No prompt activity logged for this period.</p>
      </div>
    `;
  } else {
    const sorted = Object.entries(PLATFORMS)
      .map(([id, p]) => {
        const count = totals[id] || 0;
        const pct = totalMsgs > 0 ? Math.round((count / totalMsgs) * 100) : 0;
        return { id, p, count, pct };
      })
      .filter(x => filterState.platform === 'all' || filterState.platform === x.id)
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

// 4. Topic Distribution (Feature 1)
function renderTopicDistribution() {
  const container = document.getElementById('topic-chart-container');
  if (!container) return;

  const topicTotals = currentStats.period?.topicTotals || currentStats.week?.topicTotals || {};
  const totalTopicMsgs = Object.values(topicTotals).reduce((a, b) => a + b, 0);

  let html = `<div style="width: 100%; display: flex; flex-direction: column; gap: 9px;">`;

  if (totalTopicMsgs === 0) {
    html += `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
        <p style="font-size: 13px; font-weight: 500;">No categorized topics logged yet.</p>
        <p style="font-size: 11.5px; margin-top: 4px;">Prompts will be classified locally into Code, Writing, Research, Math, and Creative topics.</p>
      </div>
    `;
  } else {
    const sorted = Object.entries(CATEGORIES)
      .map(([catId, cat]) => {
        const count = topicTotals[catId] || 0;
        const pct = totalTopicMsgs > 0 ? Math.round((count / totalTopicMsgs) * 100) : 0;
        return { catId, cat, count, pct };
      })
      .filter(x => x.count > 0 && (filterState.topic === 'all' || filterState.topic === x.catId))
      .sort((a, b) => b.count - a.count);

    sorted.forEach(({ cat, count, pct }) => {
      html += `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
            <span style="color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${cat.color || '#64748b'};"></span>
              ${cat.name}
            </span>
            <span style="color: var(--text-muted);">${count} msgs (${pct}%)</span>
          </div>
          <div style="height: 7px; background: var(--bg-subtle); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background: ${cat.color || '#64748b'}; border-radius: 4px; transition: width 0.4s ease;"></div>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;
  container.innerHTML = html;
}

// 5. Productivity & Velocity Intelligence (Feature 2)
function renderProductivityIntelligence() {
  const container = document.getElementById('productivity-intel-container');
  if (!container) return;

  const logs = getFilteredDailyLogs();
  const heatmap = buildWeeklyHeatmapMatrix(logs);
  const totalMsgs = currentStats.period?.messages || 0;

  // Multi-homing / Context switching rate estimate
  const activePlatforms = Object.keys(currentStats.period?.platformTotals || {}).filter(k => (currentStats.period?.platformTotals[k] || 0) > 0);
  const multiHomingIndex = activePlatforms.length > 1 ? Number(Math.min(1.0, (activePlatforms.length - 1) * 0.35 + 0.2).toFixed(2)) : 0;

  // Deep work ratio (estimated based on session density)
  const deepWorkPct = totalMsgs > 20 ? 65 : (totalMsgs > 5 ? 40 : 15);
  const quickQueryPct = 100 - deepWorkPct;

  container.innerHTML = `
    <div class="intel-metric-card">
      <div class="intel-metric-header">
        <span class="intel-metric-title">Deep Work vs. Quick Query</span>
        <span class="intel-metric-val">${deepWorkPct}% Deep Work</span>
      </div>
      <div class="intel-gauge-track">
        <div class="intel-gauge-fill" style="width: ${deepWorkPct}%; background: #10b981;"></div>
        <div class="intel-gauge-fill" style="width: ${quickQueryPct}%; background: #f59e0b;"></div>
      </div>
      <span class="intel-metric-desc">Sustained iterative problem solving vs quick lookups.</span>
    </div>

    <div class="intel-metric-card">
      <div class="intel-metric-header">
        <span class="intel-metric-title">AI Multi-Homing Index</span>
        <span class="intel-metric-val">${multiHomingIndex} / 1.0</span>
      </div>
      <div class="intel-gauge-track">
        <div class="intel-gauge-fill" style="width: ${Math.round(multiHomingIndex * 100)}%; background: #6366f1;"></div>
      </div>
      <span class="intel-metric-desc">Cross-platform workflow diversity across ${activePlatforms.length} active AI assistants.</span>
    </div>

    <div class="intel-metric-card">
      <div class="intel-metric-header">
        <span class="intel-metric-title">Peak Interaction Window</span>
        <span class="intel-metric-val">${heatmap.peakWeekday} @ ${heatmap.peakHour}:00</span>
      </div>
      <span class="intel-metric-desc">Your highest concentration of AI prompt activity occurs during this window.</span>
    </div>
  `;
}

// 6. Weekly 7x24 Heatmap (Feature 4)
function renderWeeklyHeatmap() {
  const container = document.getElementById('weekly-heatmap-container');
  if (!container) return;

  const logs = getFilteredDailyLogs();
  const heatmap = buildWeeklyHeatmapMatrix(logs);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxVal = Math.max(1, heatmap.maxCellCount);

  let gridHtml = `<div class="weekly-heatmap-grid">`;

  weekdays.forEach((dayName, wIdx) => {
    gridHtml += `
      <div class="week-day-row">
        <span class="day-lbl">${dayName}</span>
        <div class="hours-row-cells">
    `;

    for (let h = 0; h < 24; h++) {
      const count = heatmap.matrix[wIdx][h];
      const intensity = count > 0 ? Math.max(0.18, count / maxVal) : 0;
      const bg = count > 0
        ? `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--bg-subtle))`
        : 'var(--bg-subtle)';

      gridHtml += `
        <div class="week-cell" style="background: ${bg};" title="${dayName} ${h}:00–${h}:59 (${count} messages)"></div>
      `;
    }

    gridHtml += `
        </div>
      </div>
    `;
  });

  gridHtml += `
    <div style="display: flex; padding-left: 38px; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px;">
      <span>12 AM</span>
      <span>4 AM</span>
      <span>8 AM</span>
      <span>12 PM</span>
      <span>4 PM</span>
      <span>8 PM</span>
      <span>11 PM</span>
    </div>
  </div>`;

  container.innerHTML = gridHtml;
}

// 7. Daily History Table (Tab 3)
async function renderHistoryTable() {
  const tbody = document.getElementById('history-tbody');
  const searchInput = document.getElementById('history-search-input');
  if (!tbody) return;

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const dailyLogs = await StatsStorage.getDailyLogs();
  const sorted = Object.values(dailyLogs)
    .filter(d => !query || d.date.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No usage history found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sorted.map(day => {
    let topTopicName = 'General';
    let topTopicCount = 0;
    if (day.topics) {
      Object.entries(day.topics).forEach(([t, count]) => {
        if (count > topTopicCount) {
          topTopicCount = count;
          topTopicName = CATEGORIES[t]?.name || t;
        }
      });
    }

    const avgComp = day.complexityCount > 0 ? Math.round(day.complexitySum / day.complexityCount) : '—';

    return `
      <tr>
        <td><strong>${day.date}</strong></td>
        <td><span style="color: var(--accent); font-weight: 700;">${day.messagesCount || 0}</span></td>
        <td>${day.platforms?.chatgpt || 0}</td>
        <td>${day.platforms?.claude || 0}</td>
        <td>${day.platforms?.gemini || 0}</td>
        <td>${day.platforms?.deepseek || 0}</td>
        <td>${day.platforms?.perplexity || 0}</td>
        <td>${day.platforms?.aisearch || 0}</td>
        <td><span style="font-size: 11.5px; color: var(--text-heading); font-weight: 600;">${topTopicName}</span></td>
        <td><span style="font-size: 11.5px; color: var(--text-muted);">${avgComp}</span></td>
      </tr>
    `;
  }).join('');
}

// ── 8. AIStat Wrapped Modal ──────────────────────────────────────
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

// 9. Settings & Export
function renderSettingsForm() {
  if (!currentStats?.settings) return;
  const s = currentStats.settings;
  const badgeSelect = document.getElementById('setting-badge');
  if (badgeSelect) badgeSelect.value = s.badgeDisplay || 'message_count';

  const retentionSelect = document.getElementById('setting-retention');
  if (retentionSelect && s.retentionPolicy) retentionSelect.value = s.retentionPolicy;

  const reasoningSelect = document.getElementById('setting-reasoning');
  if (reasoningSelect && s.reasoningEffort) reasoningSelect.value = s.reasoningEffort;

  const subSelect = document.getElementById('setting-subscription');
  if (subSelect && s.subscription) subSelect.value = s.subscription;
}

function setupSettingsAndExport() {
  document.getElementById('history-search-input')?.addEventListener('input', renderHistoryTable);

  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const badgeSelect = document.getElementById('setting-badge');
    const badgeDisplay = badgeSelect ? badgeSelect.value : 'message_count';

    const retentionSelect = document.getElementById('setting-retention');
    const retentionPolicy = retentionSelect ? retentionSelect.value : '90';

    const reasoningSelect = document.getElementById('setting-reasoning');
    const reasoningEffort = reasoningSelect ? reasoningSelect.value : 'medium';

    const subSelect = document.getElementById('setting-subscription');
    const subscription = subSelect ? subSelect.value : 'free';

    await StatsStorage.updateSettings({ badgeDisplay, retentionPolicy, reasoningEffort, subscription });
    alert('Preferences saved successfully!');
    await loadData();
  });

  // Markdown Report Export (Feature 5)
  document.getElementById('btn-export-markdown')?.addEventListener('click', async () => {
    const dailyLogs = await StatsStorage.getDailyLogs();
    const md = exportMarkdownReport(dailyLogs);
    const dateStr = new Date().toISOString().slice(0, 7);
    downloadFile(md, `AIStat-Report-${dateStr}.md`, 'text/markdown');
  });

  // Anonymous Benchmark Export (Feature 5)
  document.getElementById('btn-export-benchmark')?.addEventListener('click', async () => {
    const dailyLogs = await StatsStorage.getDailyLogs();
    const benchmark = exportAnonymousBenchmark(dailyLogs);
    downloadFile(JSON.stringify(benchmark, null, 2), `AIStat-Anonymous-Benchmark.json`, 'application/json');
  });

  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    const json = await StatsStorage.exportJSON();
    downloadFile(json, `aistat-backup-${Date.now()}.json`, 'application/json');
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    const csv = await StatsStorage.exportCSV();
    downloadFile(csv, `aistat-usage-${Date.now()}.csv`, 'text/csv');
  });

  document.getElementById('btn-run-retention-now')?.addEventListener('click', async () => {
    const res = await StatsStorage.runRetentionPolicy();
    alert(`Retention cleanup completed!\n• Retained detailed days: ${res.retainedDays || 0}\n• Archived days: ${res.archivedDaysCount || 0}`);
    await loadData();
    renderHistoryTable();
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
