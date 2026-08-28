/**
 * AIStat - Background Service Worker (Manifest V3)
 * Manages event routing, centralized rate-limiting/debouncing, badge telemetry, goals, and alarms.
 */
import { StatsStorage } from '../shared/storage.js';
import { exportMarkdownReport, exportPrometheusMetrics, exportJSONLD, exportFilteredDataset } from '../shared/telemetry-exporter.js';
import { calculateGoalProgress, checkGoalAlert } from '../shared/goal-manager.js';

// Central locks to prevent duplicate increments across multiple triggers/frames/page navigations
const platformLastRecordTime = {};
const platformLastQuery = {};

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
    await updateBadge();
    if (chrome.alarms?.create) {
      chrome.alarms.create('refresh_badge', { periodInMinutes: 15 });
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    await updateBadge();
  });
}

if (typeof chrome !== 'undefined' && chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'refresh_badge') {
      await updateBadge();
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
    const queryText = (message.data?.queryText || '').trim().toLowerCase();
    const lastRecord = platformLastRecordTime[platform] || 0;
    const lastQuery = platformLastQuery[platform] || '';

    // 1. Same query text deduplication within 15 seconds (prevents UI submit + async fetch + reload duplicates)
    if (queryText && lastQuery && queryText === lastQuery && (now - lastRecord < 15000)) {
      console.log(`[AIStat] Blocked duplicate prompt by query match on ${platform}: "${queryText.slice(0, 30)}..."`);
      return { success: true, duplicate: true };
    }

    // 2. Central authoritative debounce: exactly 1 message count allowed per 4000ms per platform
    if (now - lastRecord < 4000) {
      console.log(`[AIStat] Blocked duplicate prompt event on ${platform} (${now - lastRecord}ms gap)`);
      return { success: true, duplicate: true };
    }

    platformLastRecordTime[platform] = now;
    if (queryText) {
      platformLastQuery[platform] = queryText;
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
    } else {
      data = await StatsStorage.exportJSON();
    }

    return { success: true, format, data };
  }

  if (message.type === 'GET_STORAGE_USAGE') {
    const usage = await StatsStorage.getStorageUsage();
    return { success: true, usage };
  }

  if (message.type === 'ARCHIVE_LOGS') {
    const retentionDays = message.retentionDays || 90;
    const archiveResult = await StatsStorage.archiveOldLogs(retentionDays);
    await updateBadge();
    return { success: true, archiveResult };
  }

  if (message.type === 'RESET_DATA') {
    // Clear rate-limiting and query caches as well
    Object.keys(platformLastRecordTime).forEach(k => delete platformLastRecordTime[k]);
    Object.keys(platformLastQuery).forEach(k => delete platformLastQuery[k]);
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
