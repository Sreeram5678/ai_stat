/**
 * AIStat - Background Service Worker (Manifest V3)
 */
import { StatsStorage } from '../shared/storage.js';

async function updateBadge() {
  try {
    const stats = await StatsStorage.getSummaryStats();
    const count = stats.today.messagesCount;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  } catch (err) {
    console.debug('[AIStat] Badge update error:', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AIStat] Extension installed successfully.');
  await updateBadge();
});
