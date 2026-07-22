/**
 * AIStat - Storage Data Layer
 */
export class StatsStorage {
  static getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  static async getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    return { badgeDisplay: 'message_count', ...(settings || {}) };
  }

  static async getDailyLogs() {
    const { dailyLogs } = await chrome.storage.local.get('dailyLogs');
    return dailyLogs || {};
  }
}
