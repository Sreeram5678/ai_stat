/**
 * AIStat - Popup Controller
 */
import { StatsStorage } from '../shared/storage.js';
import { PLATFORMS } from '../shared/constants.js';

async function initPopup() {
  try {
    const stats = await StatsStorage.getSummaryStats(7);
    renderPopup(stats);
  } catch (err) {
    console.error('[AIStat] Failed to load stats in popup:', err);
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  document.getElementById('btn-open-dashboard')?.addEventListener('click', openDashboard);
  document.getElementById('btn-open-dashboard-icon')?.addEventListener('click', openDashboard);
}

function openDashboard() {
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
}

function renderPopup(stats) {
  const { today, week, allTime, streak } = stats;

  // 1. Streak
  const streakEl = document.getElementById('streak-count');
  if (streakEl) streakEl.textContent = streak || 0;

  // 2. Today's count & status
  const todayValEl = document.getElementById('today-count-val');
  const statusPillEl = document.getElementById('today-status-pill');
  const summaryTextEl = document.getElementById('stats-summary-text');

  const todayCount = today.messagesCount || 0;
  if (todayValEl) todayValEl.textContent = todayCount;

  if (statusPillEl) {
    if (todayCount === 0) {
      statusPillEl.innerHTML = '<i data-lucide="moon" class="icon-xs"></i> No messages yet';
      statusPillEl.className = 'tier-pill tier-medium';
    } else if (todayCount >= 20) {
      statusPillEl.innerHTML = '<i data-lucide="flame" class="icon-xs"></i> Very active';
      statusPillEl.className = 'tier-pill tier-high';
    } else if (todayCount >= 5) {
      statusPillEl.innerHTML = '<i data-lucide="zap" class="icon-xs"></i> Active today';
      statusPillEl.className = 'tier-pill tier-medium';
    } else {
      statusPillEl.innerHTML = '<i data-lucide="circle-dot" class="icon-xs"></i> Getting started';
      statusPillEl.className = 'tier-pill tier-low';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  if (summaryTextEl) {
    if (todayCount === 0) {
      summaryTextEl.textContent = 'Start prompting on ChatGPT, Claude, Gemini, or Perplexity to track your usage.';
    } else {
      const todayPlatforms = today.platforms || {};
      const topEntry = Object.entries(todayPlatforms).sort((a, b) => b[1] - a[1])[0];
      const topPlatformName = topEntry ? (PLATFORMS[topEntry[0]]?.name || topEntry[0]) : null;

      if (topPlatformName) {
        summaryTextEl.textContent = `${todayCount} message${todayCount !== 1 ? 's' : ''} today, mostly on ${topPlatformName}. This week: ${week.messages} total.`;
      } else {
        summaryTextEl.textContent = `${todayCount} message${todayCount !== 1 ? 's' : ''} sent today. This week: ${week.messages} total.`;
      }
    }
  }

  // 3. Week & All-time
  const weekValEl = document.getElementById('week-count-val');
  const alltimeValEl = document.getElementById('alltime-count-val');

  if (weekValEl) weekValEl.textContent = week.messages || 0;
  if (alltimeValEl) alltimeValEl.textContent = allTime.messages || 0;

  // 4. Past 7 Days Mini Chart
  const weekSubEl = document.getElementById('week-total-sub');
  if (weekSubEl) weekSubEl.textContent = `${week.messages} total`;

  const miniBarsContainer = document.getElementById('mini-bars-container');
  if (miniBarsContainer && week.last7Days) {
    miniBarsContainer.innerHTML = '';
    const maxCount = Math.max(1, ...week.last7Days.map(d => d.messagesCount));

    week.last7Days.forEach((d, idx) => {
      const isToday = idx === week.last7Days.length - 1;
      const heightPercent = Math.max(8, Math.round((d.messagesCount / maxCount) * 100));

      const col = document.createElement('div');
      col.className = 'bar-col';
      col.title = `${d.date}: ${d.messagesCount} messages`;

      col.innerHTML = `
        <div class="bar-track">
          <div class="bar-fill ${isToday ? 'today' : ''}" style="height: ${heightPercent}%"></div>
        </div>
        <span class="bar-day-lbl">${d.label}</span>
      `;
      miniBarsContainer.appendChild(col);
    });
  }

  // 5. Platform Breakdown
  const platformList = document.getElementById('platform-bars-list');
  const platformTotal = document.getElementById('platform-total-count');
  const totals = week.platformTotals || {};
  const totalMsgs = Object.values(totals).reduce((a, b) => a + b, 0);

  if (platformTotal) platformTotal.textContent = `${totalMsgs} total`;

  if (platformList) {
    if (totalMsgs === 0) {
      platformList.innerHTML = `<div style="text-align:center; color: #A07A5E; font-size:12px; padding: 8px 0;">No messages yet this week</div>`;
    } else {
      const sorted = Object.entries(PLATFORMS)
        .map(([id, p]) => ({ id, p, count: totals[id] || 0 }))
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count);

      platformList.innerHTML = sorted.map(({ p, count }) => {
        const pct = Math.round((count / totalMsgs) * 100);
        return `
          <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600;">
              <span style="color:#3D2415;">${p.name}</span>
              <span style="color:#A07A5E;">${count} (${pct}%)</span>
            </div>
            <div style="height:6px; background:#EDE1CC; border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:${p.color}; border-radius:4px; transition:width 0.4s ease;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

document.addEventListener('DOMContentLoaded', initPopup);
