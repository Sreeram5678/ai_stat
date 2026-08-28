/**
 * AIStat - Storage & Analytics Data Layer (Schema v2)
 * Persists all metrics locally in chrome.storage.local with zero-cloud guarantees.
 * Supports deterministic migrations, automated retention, topic aggregates, and complexity metrics.
 */

import { globalCache, estimateObjectSize } from './cache-manager.js';
import { classifyPrompt } from './topic-categorizer.js';

export const SCHEMA_VERSION = 2;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
let _writeQueue = Promise.resolve();

export class StatsStorage {
  static get SCHEMA_VERSION() {
    return SCHEMA_VERSION;
  }

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
    return {
      schemaVersion: SCHEMA_VERSION,
      badgeDisplay: 'message_count',
      theme: 'auto',
      reasoningEffort: 'medium',
      subscription: 'free',
      retentionPolicy: '90', // '30' | '90' | '365' | 'disabled'
      strictPrivacyMode: true,
      ...(settings || {})
    };
  }

  static async updateSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ settings: updated });
    }
    return updated;
  }

  /**
   * Deterministic and idempotent v1 -> v2 schema migration.
   */
  static async migrateSchema() {
    let data = {};
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      data = await chrome.storage.local.get(null);
    }

    const currentSettings = data.settings || {};
    const currentVersion = currentSettings.schemaVersion || 1;

    if (currentVersion >= SCHEMA_VERSION && data.dailyLogs) {
      return { migrated: false, currentVersion: SCHEMA_VERSION };
    }

    const rawLogs = data.dailyLogs || {};
    const migratedLogs = {};

    Object.entries(rawLogs).forEach(([dateKey, day]) => {
      if (FORBIDDEN_KEYS.has(dateKey) || !this.isValidDateKey(dateKey)) return;

      migratedLogs[dateKey] = {
        date: dateKey,
        messagesCount: this.sanitizeCount(day.messagesCount),
        platforms: { ...(day.platforms || {}) },
        hours: { ...(day.hours || {}) },
        topics: { ...(day.topics || {}) },
        models: { ...(day.models || {}) },
        complexitySum: typeof day.complexitySum === 'number' ? day.complexitySum : 0,
        complexityCount: typeof day.complexityCount === 'number' ? day.complexityCount : 0
      };
    });

    const updatedSettings = {
      ...currentSettings,
      schemaVersion: SCHEMA_VERSION,
      retentionPolicy: currentSettings.retentionPolicy || '90'
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({
        dailyLogs: migratedLogs,
        settings: updatedSettings
      });
    }

    return { migrated: true, fromVersion: currentVersion, toVersion: SCHEMA_VERSION, recordsCount: Object.keys(migratedLogs).length };
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

        if (day.topics && typeof day.topics === 'object') {
          cleanDay.topics = {};
          Object.keys(day.topics).forEach(t => {
            if (!FORBIDDEN_KEYS.has(t)) {
              cleanDay.topics[t] = this.sanitizeCount(day.topics[t]);
            }
          });
        }

        if (day.models && typeof day.models === 'object') {
          cleanDay.models = {};
          Object.keys(day.models).forEach(m => {
            if (!FORBIDDEN_KEYS.has(m)) {
              cleanDay.models[m] = this.sanitizeCount(day.models[m]);
            }
          });
        }

        if (typeof day.complexitySum === 'number') {
          cleanDay.complexitySum = day.complexitySum;
        }

        if (typeof day.complexityCount === 'number') {
          cleanDay.complexityCount = day.complexityCount;
        }

        cleanLogs[dateKey] = cleanDay;
      }
    });

    return cleanLogs;
  }

  static async getMonthlyAggregates() {
    let monthlyAggregates = {};
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get('monthlyAggregates');
      monthlyAggregates = result.monthlyAggregates || {};
    }
    return monthlyAggregates;
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
   * Record a single prompt sent on an AI platform with topic & complexity metadata.
   * NEVER persists raw prompt text.
   */
  static async recordPrompt({
    platform = 'chatgpt',
    timestamp,
    category,
    complexity,
    model,
    text
  } = {}) {
    const execute = async () => {
      const todayKey = this.getTodayKey();
      const now = timestamp || Date.now();
      const hour = String(new Date(now).getHours());

      // Derive topic and complexity locally if prompt text is passed in memory
      let promptCategory = category;
      let promptComplexity = complexity;

      if (!promptCategory && text) {
        const classification = classifyPrompt(text);
        promptCategory = classification.category;
        if (promptComplexity == null) {
          promptComplexity = classification.complexity;
        }
      }

      promptCategory = promptCategory || 'general_other';
      const complexityVal = typeof promptComplexity === 'number' && !isNaN(promptComplexity)
        ? Math.min(100, Math.max(0, Math.round(promptComplexity)))
        : 35; // Default median complexity heuristic

      const dailyLogs = await this.getDailyLogs();

      if (!dailyLogs[todayKey]) {
        dailyLogs[todayKey] = {
          date: todayKey,
          messagesCount: 0,
          platforms: {},
          hours: {},
          topics: {},
          models: {},
          complexitySum: 0,
          complexityCount: 0
        };
      }

      const day = dailyLogs[todayKey];
      day.messagesCount = this.sanitizeCount(day.messagesCount) + 1;

      if (!day.platforms) day.platforms = {};
      day.platforms[platform] = this.sanitizeCount(day.platforms[platform]) + 1;

      if (!day.hours) day.hours = {};
      day.hours[hour] = this.sanitizeCount(day.hours[hour]) + 1;

      if (!day.topics) day.topics = {};
      day.topics[promptCategory] = this.sanitizeCount(day.topics[promptCategory]) + 1;

      if (model) {
        if (!day.models) day.models = {};
        day.models[model] = this.sanitizeCount(day.models[model]) + 1;
      }

      day.complexitySum = (day.complexitySum || 0) + complexityVal;
      day.complexityCount = (day.complexityCount || 0) + 1;

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
      hours: {},
      topics: {},
      models: {},
      complexitySum: 0,
      complexityCount: 0
    };

    // Calculate requested period timeline
    const daysToIterate = numDays === 'all' ? 30 : (parseInt(numDays, 10) || 7);
    const timeline = [];
    let periodMessages = 0;
    const periodPlatformTotals = {};
    const periodTopicTotals = {};
    let periodComplexitySum = 0;
    let periodComplexityCount = 0;

    for (let i = daysToIterate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayData = dailyLogs[key] || { date: key, messagesCount: 0, platforms: {}, topics: {} };
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

      if (dayData.topics) {
        Object.entries(dayData.topics).forEach(([t, tCount]) => {
          periodTopicTotals[t] = (periodTopicTotals[t] || 0) + this.sanitizeCount(tCount);
        });
      }

      if (dayData.complexityCount) {
        periodComplexitySum += dayData.complexitySum || 0;
        periodComplexityCount += dayData.complexityCount || 0;
      }
    }

    // Past 7 Days (fixed for week overview)
    let weekMessages = 0;
    const weekPlatformTotals = {};
    const weekTopicTotals = {};
    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayData = dailyLogs[key] || { date: key, messagesCount: 0, platforms: {}, topics: {} };
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

      if (dayData.topics) {
        Object.entries(dayData.topics).forEach(([t, tCount]) => {
          weekTopicTotals[t] = (weekTopicTotals[t] || 0) + this.sanitizeCount(tCount);
        });
      }
    }

    // All-time totals
    let allTimeMessages = 0;
    const allTimePlatformTotals = {};
    const allTimeTopicTotals = {};
    Object.values(dailyLogs).forEach(day => {
      allTimeMessages += this.sanitizeCount(day.messagesCount);
      if (day.platforms) {
        Object.entries(day.platforms).forEach(([p, pCount]) => {
          allTimePlatformTotals[p] = (allTimePlatformTotals[p] || 0) + this.sanitizeCount(pCount);
        });
      }
      if (day.topics) {
        Object.entries(day.topics).forEach(([t, tCount]) => {
          allTimeTopicTotals[t] = (allTimeTopicTotals[t] || 0) + this.sanitizeCount(tCount);
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

    // Active Streak
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

    const averageComplexity = periodComplexityCount > 0
      ? Number((periodComplexitySum / periodComplexityCount).toFixed(1))
      : 0;

    return {
      today: {
        messagesCount: this.sanitizeCount(today.messagesCount),
        platforms: today.platforms || {},
        hours: today.hours || {},
        topics: today.topics || {},
        avgComplexity: today.complexityCount > 0 ? Number((today.complexitySum / today.complexityCount).toFixed(1)) : 0
      },
      week: {
        messages: weekMessages,
        last7Days,
        platformTotals: weekPlatformTotals,
        topicTotals: weekTopicTotals
      },
      period: {
        numDays,
        messages: periodMessages,
        timeline,
        platformTotals: periodPlatformTotals,
        topicTotals: periodTopicTotals,
        averageComplexity
      },
      month: {
        messages: monthMessages
      },
      allTime: {
        messages: allTimeMessages,
        platformTotals: allTimePlatformTotals,
        topicTotals: allTimeTopicTotals
      },
      streak,
      settings
    };
  }

  /**
   * Generates a timestamped JSON backup object containing schema version, exportDate, dailyLogs, monthlyAggregates, and settings.
   */
  static async exportBackup() {
    const dailyLogs = await this.getDailyLogs();
    const monthlyAggregates = await this.getMonthlyAggregates();
    const settings = await this.getSettings();
    return {
      version: '2.0.0',
      schemaVersion: SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      dailyLogs,
      monthlyAggregates,
      settings
    };
  }

  /**
   * Validates backup format, schema structure, dates, and non-negative counts.
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

    for (const key of Object.getOwnPropertyNames(parsed)) {
      if (FORBIDDEN_KEYS.has(key)) {
        errors.push(`Prototype pollution / injection detected with forbidden root key "${key}"`);
      }
    }

    if (!parsed.version || typeof parsed.version !== 'string') {
      errors.push('Missing or invalid "version" string field');
    }

    if (parsed.exportDate !== undefined) {
      if (typeof parsed.exportDate !== 'string' || isNaN(Date.parse(parsed.exportDate))) {
        errors.push('Invalid "exportDate" timestamp');
      }
    }

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
          hours: {},
          topics: {},
          models: {},
          complexitySum: typeof day.complexitySum === 'number' ? day.complexitySum : 0,
          complexityCount: typeof day.complexityCount === 'number' ? day.complexityCount : 0
        };

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

        if (day.topics && typeof day.topics === 'object' && !Array.isArray(day.topics)) {
          for (const t of Object.getOwnPropertyNames(day.topics)) {
            if (!FORBIDDEN_KEYS.has(t)) {
              cleanDay.topics[t] = this.sanitizeCount(day.topics[t]);
            }
          }
        }

        sanitizedLogs[key] = cleanDay;
      }
    }

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
        schemaVersion: parsed.schemaVersion || SCHEMA_VERSION,
        exportDate: parsed.exportDate || new Date().toISOString(),
        dailyLogs: sanitizedLogs,
        monthlyAggregates: parsed.monthlyAggregates || {},
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
      const existingLogs = await this.getDailyLogs();
      finalLogs = { ...existingLogs };

      for (const [dateKey, importedDay] of Object.entries(importedLogs)) {
        if (!finalLogs[dateKey]) {
          finalLogs[dateKey] = {
            date: dateKey,
            messagesCount: this.sanitizeCount(importedDay.messagesCount),
            platforms: { ...(importedDay.platforms || {}) },
            hours: { ...(importedDay.hours || {}) },
            topics: { ...(importedDay.topics || {}) },
            models: { ...(importedDay.models || {}) },
            complexitySum: importedDay.complexitySum || 0,
            complexityCount: importedDay.complexityCount || 0
          };
        } else {
          const existingDay = finalLogs[dateKey];
          const existingCount = this.sanitizeCount(existingDay.messagesCount);
          const importedCount = this.sanitizeCount(importedDay.messagesCount);

          existingDay.messagesCount = Math.max(existingCount, importedCount);

          const mergedPlatforms = { ...(existingDay.platforms || {}) };
          if (importedDay.platforms) {
            for (const [p, pCount] of Object.entries(importedDay.platforms)) {
              mergedPlatforms[p] = Math.max(this.sanitizeCount(mergedPlatforms[p]), this.sanitizeCount(pCount));
            }
          }
          existingDay.platforms = mergedPlatforms;

          const mergedHours = { ...(existingDay.hours || {}) };
          if (importedDay.hours) {
            for (const [h, hCount] of Object.entries(importedDay.hours)) {
              mergedHours[h] = Math.max(this.sanitizeCount(mergedHours[h]), this.sanitizeCount(hCount));
            }
          }
          existingDay.hours = mergedHours;

          const mergedTopics = { ...(existingDay.topics || {}) };
          if (importedDay.topics) {
            for (const [t, tCount] of Object.entries(importedDay.topics)) {
              mergedTopics[t] = Math.max(this.sanitizeCount(mergedTopics[t]), this.sanitizeCount(tCount));
            }
          }
          existingDay.topics = mergedTopics;
        }
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({
        dailyLogs: finalLogs,
        ...(data.monthlyAggregates ? { monthlyAggregates: data.monthlyAggregates } : {})
      });
      if (data.settings && mode === 'overwrite') {
        await this.updateSettings(data.settings);
      }
    }

    return finalLogs;
  }

  static async exportJSON() {
    const backup = await this.exportBackup();
    return JSON.stringify(backup, null, 2);
  }

  static async exportCSV() {
    const dailyLogs = await this.getDailyLogs();
    const headers = ['Date', 'Total Messages', 'ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Perplexity', 'Google AI Search', 'Top Topic'];
    const rows = Object.values(dailyLogs)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => {
        let topTopic = 'general_other';
        let topTopicCount = 0;
        if (day.topics) {
          Object.entries(day.topics).forEach(([t, c]) => {
            if (c > topTopicCount) {
              topTopicCount = c;
              topTopic = t;
            }
          });
        }
        return [
          day.date,
          this.sanitizeCount(day.messagesCount),
          this.sanitizeCount(day.platforms?.chatgpt),
          this.sanitizeCount(day.platforms?.claude),
          this.sanitizeCount(day.platforms?.gemini),
          this.sanitizeCount(day.platforms?.deepseek),
          this.sanitizeCount(day.platforms?.perplexity),
          this.sanitizeCount(day.platforms?.aisearch),
          topTopic
        ];
      });

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  static async clearAllData() {
    const settings = await this.getSettings();
    globalCache.clear();
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ settings });
    }
  }

  static async getStorageUsage() {
    let bytesInUse = 0;
    const quotaBytes = 5242880; // 5 MB

    if (typeof chrome !== 'undefined' && chrome.storage?.local?.getBytesInUse) {
      try {
        bytesInUse = await chrome.storage.local.getBytesInUse(null);
      } catch (err) {
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
   * Archives detailed daily logs older than retentionDays into monthly summary aggregates.
   * Retains high-level monthly summaries permanently while freeing daily row quota.
   */
  static async archiveOldLogs(retentionDays = 90) {
    if (retentionDays === 'disabled' || retentionDays === 0 || retentionDays === Infinity) {
      return { retainedDays: (await this.getDailyLogs()).length, archivedDaysCount: 0, archivedMessagesCount: 0 };
    }

    const daysNum = parseInt(retentionDays, 10) || 90;
    const dailyLogs = await this.getDailyLogs();
    const existingMonthly = await this.getMonthlyAggregates();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);
    const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

    const retainedLogs = {};
    const updatedMonthly = { ...existingMonthly };
    let archivedMessagesCount = 0;
    const archivedPlatforms = {};

    Object.entries(dailyLogs).forEach(([dateKey, day]) => {
      if (dateKey >= cutoffKey) {
        retainedLogs[dateKey] = day;
      } else {
        const count = this.sanitizeCount(day.messagesCount);
        archivedMessagesCount += count;

        const monthKey = dateKey.substring(0, 7); // YYYY-MM
        if (!updatedMonthly[monthKey]) {
          updatedMonthly[monthKey] = {
            period: monthKey,
            messagesCount: 0,
            platforms: {},
            topics: {},
            activeDays: 0
          };
        }

        const m = updatedMonthly[monthKey];
        m.messagesCount += count;
        if (count > 0) m.activeDays = (m.activeDays || 0) + 1;

        if (day.platforms) {
          Object.entries(day.platforms).forEach(([p, pCount]) => {
            const pVal = this.sanitizeCount(pCount);
            archivedPlatforms[p] = (archivedPlatforms[p] || 0) + pVal;
            m.platforms[p] = (m.platforms[p] || 0) + pVal;
          });
        }

        if (day.topics) {
          Object.entries(day.topics).forEach(([t, tCount]) => {
            const tVal = this.sanitizeCount(tCount);
            m.topics[t] = (m.topics[t] || 0) + tVal;
          });
        }
      }
    });

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({
        dailyLogs: retainedLogs,
        monthlyAggregates: updatedMonthly
      });
    }
    globalCache.clear();

    return {
      retainedDays: Object.keys(retainedLogs).length,
      archivedDaysCount: Object.keys(dailyLogs).length - Object.keys(retainedLogs).length,
      archivedMessagesCount,
      archivedPlatforms,
      monthlySummariesCount: Object.keys(updatedMonthly).length
    };
  }

  /**
   * Evaluates user settings and runs automated retention cleanup if enabled.
   */
  static async runRetentionPolicy() {
    const settings = await this.getSettings();
    const policy = settings.retentionPolicy || '90';
    if (policy === 'disabled') {
      return { skipped: true, reason: 'retention_disabled' };
    }
    const days = parseInt(policy, 10) || 90;
    return this.archiveOldLogs(days);
  }
}

export default StatsStorage;
