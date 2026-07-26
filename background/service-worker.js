/**
 * AIStat - Background Service Worker (Manifest V3)
 */
import { StatsStorage } from '../shared/storage.js';

async function updateBadge() {
  try {
    const stats = await StatsStorage.getSummaryStats();
    const count = stats.today.messagesCount;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } catch (err) {
    console.debug('[AIStat] Badge update error:', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('refreshBadge', { periodInMinutes: 5 });
  await updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshBadge') {
    await updateBadge();
  }
});
