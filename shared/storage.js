/**
 * AIStat - Storage & Analytics Data Layer
 * Persists all metrics locally in chrome.storage.local.
 */

import { globalCache, retryWithBackoff, estimateObjectSize } from './cache-manager.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
let _writeQueue = Promise.resolve();

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
      const cleaned = val.replace(/\[object\s*Object\]/gi, '').replace(/<[^>]*>/g, '').trim();
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return 0;
  }

  static isValidDateKey(dateStr) {
    if (typeof dateStr !== 'string') return false;
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) return false;

    const testDate = new Date(Date.UTC(year, month - 1, day));
    return (
      testDate.getUTCFullYear() === year &&
      testDate.getUTCMonth() === month - 1 &&
      testDate.getUTCDate() === day
    );
  }

  static async getSettings() {
    let settings = null;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get('settings');
      settings = result.settings;
    }
    return { badgeDisplay: 'message_count', theme: 'auto', ...(settings || {}) };
  }

  static async updateSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ settings: updated });
    }
    return updated;
  }

  static async getDailyLogs() {
    let dailyLogs = {};
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get('dailyLogs');
      dailyLogs = result.dailyLogs;
    }
    if (!dailyLogs || typeof dailyLogs !== 'object' || Array.isArray(dailyLogs)) return {};

    // Validate and sanitize records
    const cleanLogs = {};
    Object.keys(dailyLogs).forEach(dateKey => {
      if (FORBIDDEN_KEYS.has(dateKey)) return;
      const day = dailyLogs[dateKey];
      if (day && typeof day === 'object' && !Array.isArray(day)) {
        const cleanDay = {
          date: dateKey,
          messagesCount: this.sanitizeCount(day.messagesCount),
          platforms: {},
          hours: {}
        };
        if (day.platforms && typeof day.platforms === 'object') {
          Object.keys(day.platforms).forEach(p => {
            if (!FORBIDDEN_KEYS.has(p)) {
              cleanDay.platforms[p] = this.sanitizeCount(day.platforms[p]);
            }
          });
        }
        if (day.hours && typeof day.hours === 'object') {
          Object.keys(day.hours).forEach(h => {
            if (!FORBIDDEN_KEYS.has(h)) {
              cleanDay.hours[h] = this.sanitizeCount(day.hours[h]);
            }
          });
        }
        cleanLogs[dateKey] = cleanDay;
      }
    });

    return cleanLogs;
  }

  /**
   * Alias/helper for recordPrompt supporting string platform or options object
   */
  static async incrementMessageCount(platformOrObj = 'chatgpt', timestamp) {
    if (typeof platformOrObj === 'object' && platformOrObj !== null) {
      return this.recordPrompt(platformOrObj);
    }
    return this.recordPrompt({ platform: platformOrObj || 'chatgpt', timestamp });
  }

  /**
   * Record a single prompt sent on an AI platform
   */
  static async recordPrompt({ platform = 'chatgpt', timestamp } = {}) {
    const execute = async () => {
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

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ dailyLogs });
      }

      return { day };
    };

    _writeQueue = _writeQueue.then(execute, execute);
    return _writeQueue;
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
   * Generates a timestamped JSON backup object containing version, exportDate, dailyLogs, and settings.
   */
  static async exportBackup() {
    const dailyLogs = await this.getDailyLogs();
    const settings = await this.getSettings();
    return {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      dailyLogs,
      settings
    };
  }

  /**
   * Validates schema, checks structure, validates dates (YYYY-MM-DD), ensures all numeric counts are sanitized non-negative integers.
   * Returns { valid: boolean, errors: string[], data?: object }
   */
  static validateBackup(jsonStringOrObject) {
    const errors = [];
    let parsed = jsonStringOrObject;

    if (typeof jsonStringOrObject === 'string') {
      try {
        parsed = JSON.parse(jsonStringOrObject);
      } catch (err) {
        return { valid: false, errors: [`Invalid JSON format: ${err.message}`] };
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, errors: ['Backup payload must be a non-null object'] };
    }

    // Check for root prototype injection keys
    for (const key of Object.getOwnPropertyNames(parsed)) {
      if (FORBIDDEN_KEYS.has(key)) {
        errors.push(`Prototype pollution / injection detected with forbidden root key "${key}"`);
      }
    }

    // Check version
    if (!parsed.version || typeof parsed.version !== 'string') {
      errors.push('Missing or invalid "version" string field');
    }

    // Check exportDate (if provided, must be valid date)
    if (parsed.exportDate !== undefined) {
      if (typeof parsed.exportDate !== 'string' || isNaN(Date.parse(parsed.exportDate))) {
        errors.push('Invalid "exportDate" timestamp');
      }
    }

    // Check dailyLogs
    if (!parsed.dailyLogs || typeof parsed.dailyLogs !== 'object' || Array.isArray(parsed.dailyLogs)) {
      errors.push('Missing or invalid "dailyLogs" object');
    }

    const sanitizedLogs = {};
    if (parsed.dailyLogs && typeof parsed.dailyLogs === 'object' && !Array.isArray(parsed.dailyLogs)) {
      for (const key of Object.getOwnPropertyNames(parsed.dailyLogs)) {
        if (FORBIDDEN_KEYS.has(key)) {
          errors.push(`Prototype injection detected in dailyLogs key: "${key}"`);
          continue;
        }

        if (!this.isValidDateKey(key)) {
          errors.push(`Invalid date format for key "${key}", expected valid YYYY-MM-DD`);
          continue;
        }

        const day = parsed.dailyLogs[key];
        if (!day || typeof day !== 'object' || Array.isArray(day)) {
          errors.push(`Invalid day entry for date "${key}", expected an object`);
          continue;
        }

        for (const dayProp of Object.getOwnPropertyNames(day)) {
          if (FORBIDDEN_KEYS.has(dayProp)) {
            errors.push(`Prototype injection detected in day property: "${dayProp}" on date "${key}"`);
          }
        }

        // Validate messagesCount
        if (typeof day.messagesCount === 'number') {
          if (day.messagesCount < 0 || isNaN(day.messagesCount)) {
            errors.push(`Negative or NaN messagesCount on date "${key}"`);
          }
        } else if (typeof day.messagesCount === 'string') {
          const parsedNum = parseInt(day.messagesCount, 10);
          if (isNaN(parsedNum) || parsedNum < 0) {
            errors.push(`Invalid messagesCount string "${day.messagesCount}" on date "${key}"`);
          }
        } else if (day.messagesCount !== undefined && day.messagesCount !== null) {
          errors.push(`Invalid messagesCount type on date "${key}"`);
        }

        const cleanDay = {
          date: key,
          messagesCount: this.sanitizeCount(day.messagesCount),
          platforms: {},
          hours: {}
        };

        // Validate platforms
        if (day.platforms !== undefined) {
          if (typeof day.platforms !== 'object' || day.platforms === null || Array.isArray(day.platforms)) {
            errors.push(`Invalid "platforms" object on date "${key}"`);
          } else {
            for (const p of Object.getOwnPropertyNames(day.platforms)) {
              if (FORBIDDEN_KEYS.has(p)) {
                errors.push(`Prototype injection detected in platform key: "${p}" on date "${key}"`);
                continue;
              }
              const pVal = day.platforms[p];
              if (typeof pVal === 'number' && (pVal < 0 || isNaN(pVal))) {
                errors.push(`Negative or NaN platform count for "${p}" on date "${key}"`);
              } else if (typeof pVal === 'string') {
                const parsedP = parseInt(pVal, 10);
                if (isNaN(parsedP) || parsedP < 0) {
                  errors.push(`Invalid platform count string "${pVal}" for "${p}" on date "${key}"`);
                }
              }
              cleanDay.platforms[p] = this.sanitizeCount(pVal);
            }
          }
        }

        // Validate hours
        if (day.hours !== undefined) {
          if (typeof day.hours !== 'object' || day.hours === null || Array.isArray(day.hours)) {
            errors.push(`Invalid "hours" object on date "${key}"`);
          } else {
            for (const h of Object.getOwnPropertyNames(day.hours)) {
              if (FORBIDDEN_KEYS.has(h)) {
                errors.push(`Prototype injection detected in hour key: "${h}" on date "${key}"`);
                continue;
              }
              const hNum = parseInt(h, 10);
              if (isNaN(hNum) || hNum < 0 || hNum > 23) {
                errors.push(`Invalid hour key "${h}" on date "${key}", expected 0-23`);
              }
              const hVal = day.hours[h];
              if (typeof hVal === 'number' && (hVal < 0 || isNaN(hVal))) {
                errors.push(`Negative or NaN hour count for hour "${h}" on date "${key}"`);
              } else if (typeof hVal === 'string') {
                const parsedH = parseInt(hVal, 10);
                if (isNaN(parsedH) || parsedH < 0) {
                  errors.push(`Invalid hour count string "${hVal}" for hour "${h}" on date "${key}"`);
                }
              }
              cleanDay.hours[h] = this.sanitizeCount(hVal);
            }
          }
        }

        sanitizedLogs[key] = cleanDay;
      }
    }

    // Validate settings (optional)
    let sanitizedSettings = undefined;
    if (parsed.settings !== undefined) {
      if (typeof parsed.settings !== 'object' || parsed.settings === null || Array.isArray(parsed.settings)) {
        errors.push('Invalid "settings" object in backup');
      } else {
        sanitizedSettings = {};
        for (const sKey of Object.getOwnPropertyNames(parsed.settings)) {
          if (!FORBIDDEN_KEYS.has(sKey)) {
            sanitizedSettings[sKey] = parsed.settings[sKey];
          }
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: [],
      data: {
        version: String(parsed.version),
        exportDate: parsed.exportDate || new Date().toISOString(),
        dailyLogs: sanitizedLogs,
        ...(sanitizedSettings ? { settings: sanitizedSettings } : {})
      }
    };
  }

  /**
   * Imports backup data with merge or overwrite mode.
   */
  static async importBackup(backupData, { mode = 'merge' } = {}) {
    const validation = this.validateBackup(backupData);
    if (!validation.valid) {
      throw new Error(`Backup validation failed: ${validation.errors.join('; ')}`);
    }

    const { data } = validation;
    const importedLogs = data.dailyLogs || {};
    let finalLogs = {};

    if (mode === 'overwrite') {
      finalLogs = { ...importedLogs };
    } else {
      // Merge mode
      const existingLogs = await this.getDailyLogs();
      finalLogs = { ...existingLogs };

      for (const [dateKey, importedDay] of Object.entries(importedLogs)) {
        if (!finalLogs[dateKey]) {
          finalLogs[dateKey] = {
            date: dateKey,
            messagesCount: this.sanitizeCount(importedDay.messagesCount),
            platforms: { ...(importedDay.platforms || {}) },
            hours: { ...(importedDay.hours || {}) }
          };
        } else {
          const existingDay = finalLogs[dateKey];
          const existingCount = this.sanitizeCount(existingDay.messagesCount);
          const importedCount = this.sanitizeCount(importedDay.messagesCount);

          // For duplicate dates, sets messagesCount = Math.max(existing, imported)
          existingDay.messagesCount = Math.max(existingCount, importedCount);

          // Platform counts: Math.max(...)
          const mergedPlatforms = { ...(existingDay.platforms || {}) };
          if (importedDay.platforms) {
            for (const [p, pCount] of Object.entries(importedDay.platforms)) {
              const eCount = this.sanitizeCount(mergedPlatforms[p]);
              const iCount = this.sanitizeCount(pCount);
              mergedPlatforms[p] = Math.max(eCount, iCount);
            }
          }
          existingDay.platforms = mergedPlatforms;

          // Hours: Math.max(...)
          const mergedHours = { ...(existingDay.hours || {}) };
          if (importedDay.hours) {
            for (const [h, hCount] of Object.entries(importedDay.hours)) {
              const eCount = this.sanitizeCount(mergedHours[h]);
              const iCount = this.sanitizeCount(hCount);
              mergedHours[h] = Math.max(eCount, iCount);
            }
          }
          existingDay.hours = mergedHours;
        }
      }
    }

    // Persist to chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ dailyLogs: finalLogs });
      if (data.settings && mode === 'overwrite') {
        await this.updateSettings(data.settings);
      }
    }

    return finalLogs;
  }

  /**
   * Export all data to JSON string
   */
  static async exportJSON() {
    const backup = await this.exportBackup();
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Export daily logs to CSV format
   */
  static async exportCSV() {
    const dailyLogs = await this.getDailyLogs();
    const headers = ['Date', 'Total Messages', 'ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Perplexity', 'Google AI Search'];
    const rows = Object.values(dailyLogs)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => [
        day.date,
        this.sanitizeCount(day.messagesCount),
        this.sanitizeCount(day.platforms?.chatgpt),
        this.sanitizeCount(day.platforms?.claude),
        this.sanitizeCount(day.platforms?.gemini),
        this.sanitizeCount(day.platforms?.deepseek),
        this.sanitizeCount(day.platforms?.perplexity),
        this.sanitizeCount(day.platforms?.aisearch)
      ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Clear all usage stats and reset
   */
  static async clearAllData() {
    const settings = await this.getSettings();
    globalCache.clear();
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ settings });
    }
  }

  /**
   * Retrieves estimated or actual storage quota usage.
   */
  static async getStorageUsage() {
    let bytesInUse = 0;
    const quotaBytes = 5242880; // 5 MB standard chrome.storage.local limit

    if (typeof chrome !== 'undefined' && chrome.storage?.local?.getBytesInUse) {
      try {
        bytesInUse = await chrome.storage.local.getBytesInUse(null);
      } catch (err) {
        // Fallback estimation
        const dailyLogs = await this.getDailyLogs();
        const settings = await this.getSettings();
        bytesInUse = estimateObjectSize({ dailyLogs, settings });
      }
    } else {
      const dailyLogs = await this.getDailyLogs();
      const settings = await this.getSettings();
      bytesInUse = estimateObjectSize({ dailyLogs, settings });
    }

    const percentUsed = Number(((bytesInUse / quotaBytes) * 100).toFixed(2));
    const formattedUsage = bytesInUse < 1024
      ? `${bytesInUse} B`
      : bytesInUse < 1048576
        ? `${(bytesInUse / 1024).toFixed(1)} KB`
        : `${(bytesInUse / 1048576).toFixed(2)} MB`;

    return {
      bytesInUse,
      quotaBytes,
      percentUsed,
      formattedUsage,
      isNearQuota: percentUsed >= 80
    };
  }

  /**
   * Archives daily log records older than retentionDays into aggregated historical summaries.
   */
  static async archiveOldLogs(retentionDays = 90) {
    const dailyLogs = await this.getDailyLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

    const retainedLogs = {};
    let archivedMessagesCount = 0;
    const archivedPlatforms = {};

    Object.entries(dailyLogs).forEach(([dateKey, day]) => {
      if (dateKey >= cutoffKey) {
        retainedLogs[dateKey] = day;
      } else {
        archivedMessagesCount += this.sanitizeCount(day.messagesCount);
        if (day.platforms) {
          Object.entries(day.platforms).forEach(([p, count]) => {
            archivedPlatforms[p] = (archivedPlatforms[p] || 0) + this.sanitizeCount(count);
          });
        }
      }
    });

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ dailyLogs: retainedLogs });
    }
    globalCache.clear();

    return {
      retainedDays: Object.keys(retainedLogs).length,
      archivedDaysCount: Object.keys(dailyLogs).length - Object.keys(retainedLogs).length,
      archivedMessagesCount,
      archivedPlatforms
    };
  }
}
