/**
 * AIStat - Storage & Analytics Data Layer
 * Persists all metrics locally in chrome.storage.local.
 */

export class StatsStorage {
  static getTodayKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static sanitizeCount(val) {
    if (typeof val === 'number') {
      return isNaN(val) ? 0 : Math.max(0, Math.floor(val));
    }
    if (!val) return 0;
    if (typeof val === 'object') {
      return this.sanitizeCount(val.messages || val.messagesCount || val.count || 0);
    }
    if (typeof val === 'string') {
      const cleaned = val.replace(/\[object\s*Object\]/gi, '').trim();
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return 0;
  }

  static async getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    return { badgeDisplay: 'message_count', theme: 'light', ...(settings || {}) };
  }

  static async updateSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    await chrome.storage.local.set({ settings: updated });
    return updated;
  }

  static async getDailyLogs() {
    const { dailyLogs } = await chrome.storage.local.get('dailyLogs');
    if (!dailyLogs || typeof dailyLogs !== 'object') return {};

    // Validate and sanitize records
    Object.keys(dailyLogs).forEach(dateKey => {
      const day = dailyLogs[dateKey];
      if (day && typeof day === 'object') {
        day.messagesCount = this.sanitizeCount(day.messagesCount);
        if (day.platforms && typeof day.platforms === 'object') {
          Object.keys(day.platforms).forEach(p => {
            day.platforms[p] = this.sanitizeCount(day.platforms[p]);
          });
        }
      }
    });

    return dailyLogs;
  }

  /**
   * Record a single prompt sent on an AI platform
   */
  static async recordPrompt({ platform, timestamp }) {
    const todayKey = this.getTodayKey();
    const now = timestamp || Date.now();
    const hour = String(new Date(now).getHours());

    const dailyLogs = await this.getDailyLogs();

    if (!dailyLogs[todayKey]) {
      dailyLogs[todayKey] = {
        date: todayKey,
        messagesCount: 0,
        platforms: {},
        hours: {}
      };
    }

    const day = dailyLogs[todayKey];
    day.messagesCount = this.sanitizeCount(day.messagesCount) + 1;

    if (!day.platforms) day.platforms = {};
    day.platforms[platform] = this.sanitizeCount(day.platforms[platform]) + 1;

    if (!day.hours) day.hours = {};
    day.hours[hour] = this.sanitizeCount(day.hours[hour]) + 1;

    await chrome.storage.local.set({ dailyLogs });

    return { day };
  }

  /**
   * Get comprehensive summary stats for popup & dashboard
   */
  static async getSummaryStats(numDays = 7) {
    const todayKey = this.getTodayKey();
    const dailyLogs = await this.getDailyLogs();
    const settings = await this.getSettings();

    const today = dailyLogs[todayKey] || {
      date: todayKey,
      messagesCount: 0,
      platforms: {},
      hours: {}
    };

    // Calculate requested period timeline
    const daysToIterate = numDays === 'all' ? 30 : (parseInt(numDays, 10) || 7);
    const timeline = [];
    let periodMessages = 0;
    const periodPlatformTotals = {};

    for (let i = daysToIterate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayData = dailyLogs[key] || { date: key, messagesCount: 0, platforms: {} };
      const count = this.sanitizeCount(dayData.messagesCount);

      timeline.push({
        date: key,
        label: d.toLocaleDateString(undefined, {
          weekday: daysToIterate <= 7 ? 'short' : undefined,
          month: daysToIterate > 7 ? 'numeric' : undefined,
          day: daysToIterate > 7 ? 'numeric' : undefined
        }),
        messagesCount: count
      });

      periodMessages += count;

      if (dayData.platforms) {
        Object.entries(dayData.platforms).forEach(([p, pCount]) => {
          periodPlatformTotals[p] = (periodPlatformTotals[p] || 0) + this.sanitizeCount(pCount);
        });
      }
    }

    // Past 7 Days (fixed for week overview)
    let weekMessages = 0;
    const weekPlatformTotals = {};
    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayData = dailyLogs[key] || { date: key, messagesCount: 0, platforms: {} };
      const count = this.sanitizeCount(dayData.messagesCount);

      last7Days.push({
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        messagesCount: count
      });

      weekMessages += count;

      if (dayData.platforms) {
        Object.entries(dayData.platforms).forEach(([p, pCount]) => {
          weekPlatformTotals[p] = (weekPlatformTotals[p] || 0) + this.sanitizeCount(pCount);
        });
      }
    }

    // All-time totals
    let allTimeMessages = 0;
    const allTimePlatformTotals = {};
    Object.values(dailyLogs).forEach(day => {
      allTimeMessages += this.sanitizeCount(day.messagesCount);
      if (day.platforms) {
        Object.entries(day.platforms).forEach(([p, pCount]) => {
          allTimePlatformTotals[p] = (allTimePlatformTotals[p] || 0) + this.sanitizeCount(pCount);
        });
      }
    });

    // This month total
    const currentMonthPrefix = todayKey.substring(0, 7);
    let monthMessages = 0;
    Object.entries(dailyLogs).forEach(([date, day]) => {
      if (date.startsWith(currentMonthPrefix)) {
        monthMessages += this.sanitizeCount(day.messagesCount);
      }
    });

    // Active Streak (consecutive active days)
    let streak = 0;
    const checkDate = new Date();
    while (true) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (dailyLogs[key] && this.sanitizeCount(dailyLogs[key].messagesCount) > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (key === todayKey && streak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
          if (dailyLogs[yesterdayKey] && this.sanitizeCount(dailyLogs[yesterdayKey].messagesCount) > 0) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }

    return {
      today: {
        messagesCount: this.sanitizeCount(today.messagesCount),
        platforms: today.platforms || {},
        hours: today.hours || {}
      },
      week: {
        messages: weekMessages,
        last7Days,
        platformTotals: weekPlatformTotals
      },
      period: {
        numDays,
        messages: periodMessages,
        timeline,
        platformTotals: periodPlatformTotals
      },
      month: {
        messages: monthMessages
      },
      allTime: {
        messages: allTimeMessages,
        platformTotals: allTimePlatformTotals
      },
      streak,
      settings
    };
  }

  /**
   * Export all data to JSON string
   */
  static async exportJSON() {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export daily logs to CSV format
   */
  static async exportCSV() {
    const dailyLogs = await this.getDailyLogs();
    const headers = ['Date', 'Total Messages', 'ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Perplexity'];
    const rows = Object.values(dailyLogs)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => [
        day.date,
        this.sanitizeCount(day.messagesCount),
        this.sanitizeCount(day.platforms?.chatgpt),
        this.sanitizeCount(day.platforms?.claude),
        this.sanitizeCount(day.platforms?.gemini),
        this.sanitizeCount(day.platforms?.deepseek),
        this.sanitizeCount(day.platforms?.perplexity)
      ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Clear all usage stats and reset
   */
  static async clearAllData() {
    const settings = await this.getSettings();
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings });
  }
}

// Storage quota safety margin
