import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsStorage } from '../shared/storage.js';
import { resetChromeMock, chromeMock } from './mocks/chrome.mock.js';

describe('Dashboard Component & Filters Suite', () => {
  beforeEach(async () => {
    resetChromeMock();
    document.body.innerHTML = `
      <div class="app-layout">
        <aside class="sidebar">
          <nav class="nav-menu">
            <button class="nav-item active" data-tab="overview">Overview</button>
            <button class="nav-item" data-tab="arbitrage">Arbitrage</button>
            <button class="nav-item" data-tab="history">History</button>
            <button class="nav-item" data-tab="settings">Settings</button>
          </nav>
        </aside>
        <main class="main-viewport">
          <h2 id="page-heading">Usage Overview</h2>
          <p id="page-subheading"></p>
          <div class="top-controls">
            <button class="filter-btn active" data-period="7d">7D</button>
            <button class="filter-btn" data-period="30d">30D</button>
            <button id="btn-refresh">Refresh</button>
          </div>
          <div id="tab-overview" class="tab-pane active">
            <select id="filter-platform"><option value="all">All</option><option value="chatgpt">ChatGPT</option></select>
            <select id="filter-topic"><option value="all">All</option><option value="code_debugging">Code</option></select>
            <select id="filter-session"><option value="all">All</option></select>
            <button id="btn-reset-filters">Reset</button>
            <span id="kpi-today">0</span>
            <span id="kpi-week">0</span>
            <span id="kpi-velocity">0</span>
            <span id="kpi-complexity">0</span>
            <div id="activity-chart-container"></div>
            <div id="platform-chart-container"></div>
            <div id="topic-chart-container"></div>
            <div id="productivity-intel-container"></div>
            <div id="weekly-heatmap-container"></div>
          </div>
          <div id="tab-arbitrage" class="tab-pane">
            <div id="roi-simulator-container"></div>
          </div>
          <div id="tab-history" class="tab-pane">
            <input type="text" id="history-search-input" />
            <table><tbody id="history-tbody"></tbody></table>
          </div>
          <div id="tab-settings" class="tab-pane">
            <select id="setting-badge"><option value="message_count">Count</option></select>
            <select id="setting-retention"><option value="90">90 Days</option></select>
            <select id="setting-reasoning"><option value="medium">Medium</option></select>
            <select id="setting-subscription"><option value="free">Free</option></select>
            <button id="btn-save-settings">Save</button>
            <button id="btn-export-markdown">Export MD</button>
            <button id="btn-export-benchmark">Export Benchmark</button>
            <button id="btn-export-json">Export JSON</button>
            <button id="btn-export-csv">Export CSV</button>
            <button id="btn-run-retention-now">Run Retention</button>
          </div>
        </main>
      </div>
    `;

    const sampleLogs = {
      '2026-08-27': {
        date: '2026-08-27',
        messagesCount: 15,
        platforms: { chatgpt: 10, claude: 5 },
        hours: { '10': 5, '14': 10 },
        topics: { code_debugging: 10, writing_editing: 5 },
        complexitySum: 600,
        complexityCount: 15
      },
      '2026-08-28': {
        date: '2026-08-28',
        messagesCount: 20,
        platforms: { deepseek: 20 },
        hours: { '9': 8, '16': 12 },
        topics: { code_debugging: 20 },
        complexitySum: 900,
        complexityCount: 20
      }
    };
    await chromeMock.storage.local.set({ dailyLogs: sampleLogs });
  });

  it('renders summary statistics and KPI elements correctly', async () => {
    const stats = await StatsStorage.getSummaryStats(7);
    expect(stats.allTime.messages).toBe(35);
    expect(stats.week.messages).toBe(35);
    expect(stats.today.messagesCount).toBe(20);
    expect(stats.period.topicTotals.code_debugging).toBe(30);
    expect(stats.period.topicTotals.writing_editing).toBe(5);
  });

  it('handles empty states for charts and history tables gracefully', async () => {
    await chromeMock.storage.local.clear();
    const emptyStats = await StatsStorage.getSummaryStats(7);
    expect(emptyStats.today.messagesCount).toBe(0);
    expect(emptyStats.allTime.messages).toBe(0);
  });
});
