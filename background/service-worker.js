/**
 * AIStat - Background Service Worker (Manifest V3)
 * Manages event routing, centralized rate-limiting/debouncing, badge telemetry, goals,
 * schema migrations, automated retention, and advanced analytics APIs.
 */
import { StatsStorage } from '../shared/storage.js';
import {
  exportMarkdownReport,
  exportPrometheusMetrics,
  exportJSONLD,
  exportFilteredDataset,
  exportAnonymousBenchmark
} from '../shared/telemetry-exporter.js';
import { calculateGoalProgress, checkGoalAlert } from '../shared/goal-manager.js';
import {
  calculatePromptVelocity,
  calculateTurnaroundTimes,
  calculateContextSwitching,
  calculateWorkstyleRatios,
  buildWeeklyHeatmapMatrix
} from '../shared/velocity-analyzer.js';
import { calculateArbitrageSavings } from '../shared/cost-estimator.js';

// Central lock to prevent duplicate increments across multiple triggers/frames
const platformLastRecordTime = {};

// In-memory buffer for recent prompt timestamps (for turnaround calculation in active sessions)
const recentSessionEvents = [];

// Update action badge with today's message count and goal status color
export async function updateBadge() {
  try {
    const stats = await StatsStorage.getSummaryStats();
    const settings = stats.settings || {};
    const badgeSetting = settings.badgeDisplay || 'message_count';

    if (badgeSetting === 'none' || stats.today.messagesCount === 0) {
      if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
        await chrome.action.setBadgeText({ text: '' });
      }
      return;
    }

    const count = stats.today.messagesCount;
    let badgeColor = '#6366f1'; // default indigo

    if (settings.goals && settings.goals.enabled) {
      const dailyLogs = await StatsStorage.getDailyLogs();
      const progress = calculateGoalProgress(dailyLogs, settings.goals);
      if (progress.today.status === 'cap_exceeded') {
        badgeColor = '#ef4444'; // red
      } else if (progress.today.status === 'near_cap') {
        badgeColor = '#f59e0b'; // amber
      } else if (progress.today.status === 'target_reached') {
        badgeColor = '#10a37f'; // emerald
      }
    }

    if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
      await chrome.action.setBadgeText({ text: String(count) });
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    }
  } catch (err) {
    console.debug('[AIStat] Badge update error:', err);
  }
}

// Lifecycle Events
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async () => {
    console.log('[AIStat] Extension installed/updated.');
    await StatsStorage.migrateSchema();
    await StatsStorage.runRetentionPolicy();
    await updateBadge();
    if (chrome.alarms?.create) {
      chrome.alarms.create('refresh_badge', { periodInMinutes: 15 });
      chrome.alarms.create('daily_retention_check', { periodInMinutes: 720 }); // Every 12h
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    await StatsStorage.migrateSchema();
    await StatsStorage.runRetentionPolicy();
    await updateBadge();
  });
}

if (typeof chrome !== 'undefined' && chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'refresh_badge') {
      await updateBadge();
    } else if (alarm.name === 'daily_retention_check') {
      await StatsStorage.runRetentionPolicy();
    }
  });
}

/**
 * Dispatches runtime messages to appropriate handlers.
 */
export async function handleRuntimeMessage(message, sender = {}) {
  if (!message || typeof message !== 'object') {
    return { success: false, error: 'Invalid message payload' };
  }

  if (message.type === 'RECORD_PROMPT') {
    const platform = message.data?.platform || 'general';
    const now = message.data?.timestamp || Date.now();
    const lastRecord = platformLastRecordTime[platform] || 0;

    // Central authoritative debounce: exactly 1 message count allowed per 4000ms per platform
    if (now - lastRecord < 4000) {
      console.log(`[AIStat] Blocked duplicate prompt event on ${platform} (${now - lastRecord}ms gap)`);
      return { success: true, duplicate: true };
    }

    platformLastRecordTime[platform] = now;

    // Maintain recent events buffer for velocity / turnaround analysis (capped at 500)
    recentSessionEvents.push({
      timestamp: now,
      platform,
      model: message.data?.model,
      category: message.data?.category
    });
    if (recentSessionEvents.length > 500) {
      recentSessionEvents.shift();
    }

    const result = await StatsStorage.recordPrompt(message.data);
    await updateBadge();

    // Check goal alert
    const settings = await StatsStorage.getSettings();
    let alert = null;
    if (settings.goals && settings.goals.enabled) {
      const count = result?.day?.messagesCount || 0;
      alert = checkGoalAlert(count, settings.goals);
    }

    return { success: true, result, alert };
  }

  if (message.type === 'GET_STATS') {
    const summary = await StatsStorage.getSummaryStats(message.numDays || 7);
    return { success: true, summary };
  }

  if (message.type === 'GET_ADVANCED_METRICS') {
    const dailyLogs = await StatsStorage.getDailyLogs();
    const heatmap = buildWeeklyHeatmapMatrix(dailyLogs);
    const velocity = calculatePromptVelocity(recentSessionEvents);
    const turnaround = calculateTurnaroundTimes(recentSessionEvents);
    const contextSwitching = calculateContextSwitching(recentSessionEvents);
    const workstyle = calculateWorkstyleRatios([]);

    return {
      success: true,
      metrics: {
        heatmap,
        velocity,
        turnaround,
        contextSwitching,
        workstyle
      }
    };
  }

  if (message.type === 'GET_EXPORT') {
    const dailyLogs = await StatsStorage.getDailyLogs();
    const format = message.format || 'markdown';
    let data;

    if (format === 'markdown') {
      data = exportMarkdownReport(dailyLogs, message.options);
    } else if (format === 'prometheus') {
      data = exportPrometheusMetrics(dailyLogs, message.options);
    } else if (format === 'json-ld') {
      data = exportJSONLD(dailyLogs, message.options);
    } else if (format === 'filtered') {
      data = exportFilteredDataset(dailyLogs, message.options);
    } else if (format === 'anonymous_benchmark') {
      data = exportAnonymousBenchmark(dailyLogs, message.options);
    } else {
      data = await StatsStorage.exportJSON();
    }

    return { success: true, format, data };
  }

  if (message.type === 'SIMULATE_ARBITRAGE') {
    const arb = calculateArbitrageSavings(message.params || {});
    return { success: true, arbitrage: arb };
  }

  if (message.type === 'GET_STORAGE_USAGE') {
    const usage = await StatsStorage.getStorageUsage();
    return { success: true, usage };
  }

  if (message.type === 'ARCHIVE_LOGS' || message.type === 'RUN_RETENTION') {
    const retentionDays = message.retentionDays || 90;
    const archiveResult = await StatsStorage.archiveOldLogs(retentionDays);
    await updateBadge();
    return { success: true, archiveResult };
  }

  if (message.type === 'RESET_DATA') {
    Object.keys(platformLastRecordTime).forEach(k => delete platformLastRecordTime[k]);
    recentSessionEvents.length = 0;
    await StatsStorage.clearAllData();
    await updateBadge();
    return { success: true };
  }

  if (message.type === 'OPEN_DASHBOARD') {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
      await chrome.tabs.create({ url: dashboardUrl });
    }
    return { success: true };
  }

  return { success: false, error: 'Unknown message type' };
}

// Runtime Message Listener Registration
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleRuntimeMessage(message, sender).then(sendResponse);
    return true; // Keep message channel open for async response
  });
}
