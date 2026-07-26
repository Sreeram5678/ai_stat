/**
 * AIStat - Background Service Worker (Manifest V3)
 * Manages event routing, centralized rate-limiting/debouncing, badge telemetry, and alarms.
 */
import { StatsStorage } from '../shared/storage.js';

// Central lock to prevent duplicate increments across multiple triggers/frames
const platformLastRecordTime = {};

// Update action badge with today's message count
async function updateBadge() {
  try {
    const stats = await StatsStorage.getSummaryStats();
    const badgeSetting = stats.settings?.badgeDisplay || 'message_count';

    if (badgeSetting === 'none' || stats.today.messagesCount === 0) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    const count = stats.today.messagesCount;
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // indigo
  } catch (err) {
    console.debug('[AIStat] Badge update error:', err);
  }
}

// Lifecycle Events
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AIStat] Extension installed/updated.');
  await updateBadge();
  chrome.alarms.create('refresh_badge', { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(async () => {
  await updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh_badge') {
    await updateBadge();
  }
});

// Runtime Message Handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'RECORD_PROMPT') {
        const platform = message.data?.platform || 'general';
        const now = Date.now();
        const lastRecord = platformLastRecordTime[platform] || 0;

        // Central authoritative debounce: exactly 1 message count allowed per 4000ms per platform
        if (now - lastRecord < 4000) {
          console.log(`[AIStat] Blocked duplicate prompt event on ${platform} (${now - lastRecord}ms gap)`);
          sendResponse({ success: true, duplicate: true });
          return;
        }

        platformLastRecordTime[platform] = now;
        const result = await StatsStorage.recordPrompt(message.data);
        await updateBadge();
        sendResponse({ success: true, result });
      } else if (message.type === 'GET_STATS') {
        const summary = await StatsStorage.getSummaryStats(message.numDays || 7);
        sendResponse({ success: true, summary });
      } else if (message.type === 'RESET_DATA') {
        // Clear rate-limiting cache as well
        Object.keys(platformLastRecordTime).forEach(k => delete platformLastRecordTime[k]);
        await StatsStorage.clearAllData();
        await updateBadge();
        sendResponse({ success: true });
      } else if (message.type === 'OPEN_DASHBOARD') {
        const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
        await chrome.tabs.create({ url: dashboardUrl });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('[AIStat] Message handling error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
