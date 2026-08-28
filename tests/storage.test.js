import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsStorage } from '../shared/storage.js';
import { resetChromeMock, chromeMock } from './mocks/chrome.mock.js';

describe('StatsStorage', () => {
  beforeEach(() => {
    resetChromeMock();
    vi.useRealTimers();
  });

  describe('getTodayKey()', () => {
    it('returns a string matching YYYY-MM-DD format', () => {
      const todayKey = StatsStorage.getTodayKey();
      expect(todayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('correctly zero-pads single-digit month and day', () => {
      vi.useFakeTimers();
      // Test January 5, 2026
      vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
      expect(StatsStorage.getTodayKey()).toBe('2026-01-05');

      // Test December 31, 2026
      vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
      expect(StatsStorage.getTodayKey()).toBe('2026-12-31');
    });
  });

  describe('sanitizeCount()', () => {
    it('handles regular numbers and floats', () => {
      expect(StatsStorage.sanitizeCount(0)).toBe(0);
      expect(StatsStorage.sanitizeCount(42)).toBe(42);
      expect(StatsStorage.sanitizeCount(3.14)).toBe(3);
      expect(StatsStorage.sanitizeCount(99.9)).toBe(99);
    });

    it('handles numeric strings', () => {
      expect(StatsStorage.sanitizeCount('0')).toBe(0);
      expect(StatsStorage.sanitizeCount('42')).toBe(42);
      expect(StatsStorage.sanitizeCount(' 100 ')).toBe(100);
      expect(StatsStorage.sanitizeCount('150px')).toBe(150);
    });

    it('cleans and sanitizes [object Object] artifacts in strings', () => {
      expect(StatsStorage.sanitizeCount('42[object Object]')).toBe(42);
      expect(StatsStorage.sanitizeCount('[object Object]55')).toBe(55);
      expect(StatsStorage.sanitizeCount('[object Object]')).toBe(0);
    });

    it('extracts count from nested objects with messages, messagesCount, or count keys', () => {
      expect(StatsStorage.sanitizeCount({ messages: 15 })).toBe(15);
      expect(StatsStorage.sanitizeCount({ messagesCount: 20 })).toBe(20);
      expect(StatsStorage.sanitizeCount({ count: 7 })).toBe(7);
      expect(StatsStorage.sanitizeCount({ messages: { count: 3 } })).toBe(3);
      expect(StatsStorage.sanitizeCount({})).toBe(0);
    });

    it('handles NaN and non-finite values safely', () => {
      expect(StatsStorage.sanitizeCount(NaN)).toBe(0);
      expect(StatsStorage.sanitizeCount(Number.NaN)).toBe(0);
    });

    it('clamps negative numbers and strings to 0', () => {
      expect(StatsStorage.sanitizeCount(-5)).toBe(0);
      expect(StatsStorage.sanitizeCount(-100)).toBe(0);
      expect(StatsStorage.sanitizeCount('-25')).toBe(0);
    });

    it('handles injections, null, undefined, and non-numeric types', () => {
      expect(StatsStorage.sanitizeCount(null)).toBe(0);
      expect(StatsStorage.sanitizeCount(undefined)).toBe(0);
      expect(StatsStorage.sanitizeCount(false)).toBe(0);
      expect(StatsStorage.sanitizeCount(true)).toBe(0);
      expect(StatsStorage.sanitizeCount('')).toBe(0);
      expect(StatsStorage.sanitizeCount('<script>alert("xss")</script>')).toBe(0);
      expect(StatsStorage.sanitizeCount('SELECT * FROM users')).toBe(0);
      expect(StatsStorage.sanitizeCount('invalid')).toBe(0);
      expect(StatsStorage.sanitizeCount(() => {})).toBe(0);
    });
  });

  describe('incrementMessageCount() and recordPrompt()', () => {
    it('records single-platform prompt and increments dailyLogs correctly', async () => {
      const result = await StatsStorage.incrementMessageCount('chatgpt');
      const todayKey = StatsStorage.getTodayKey();

      expect(result.day).toBeDefined();
      expect(result.day.date).toBe(todayKey);
      expect(result.day.messagesCount).toBe(1);
      expect(result.day.platforms.chatgpt).toBe(1);

      // Verify persistent storage
      const dailyLogs = await StatsStorage.getDailyLogs();
      expect(dailyLogs[todayKey].messagesCount).toBe(1);
      expect(dailyLogs[todayKey].platforms.chatgpt).toBe(1);
    });

    it('supports object argument with custom timestamp and platform', async () => {
      const fixedTime = new Date('2026-06-15T14:30:00Z').getTime();
      const hour = String(new Date(fixedTime).getHours());

      vi.useFakeTimers();
      vi.setSystemTime(fixedTime);

      const result = await StatsStorage.recordPrompt({ platform: 'claude', timestamp: fixedTime });
      expect(result.day.platforms.claude).toBe(1);
      expect(result.day.hours[hour]).toBe(1);
    });

    it('aggregates multi-platform logs accurately across successive calls', async () => {
      await StatsStorage.incrementMessageCount('chatgpt');
      await StatsStorage.incrementMessageCount('chatgpt');
      await StatsStorage.incrementMessageCount('claude');
      await StatsStorage.incrementMessageCount('gemini');
      await StatsStorage.incrementMessageCount('deepseek');
      await StatsStorage.incrementMessageCount('perplexity');

      const todayKey = StatsStorage.getTodayKey();
      const dailyLogs = await StatsStorage.getDailyLogs();
      const day = dailyLogs[todayKey];

      expect(day.messagesCount).toBe(6);
      expect(day.platforms.chatgpt).toBe(2);
      expect(day.platforms.claude).toBe(1);
      expect(day.platforms.gemini).toBe(1);
      expect(day.platforms.deepseek).toBe(1);
      expect(day.platforms.perplexity).toBe(1);
    });
  });

  describe('getSummaryStats()', () => {
    function formatDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('computes rolling 7-day stats and platform totals correctly', async () => {
      const today = new Date();
      const todayKey = formatDate(today);

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayKey = formatDate(yesterday);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(today.getDate() - 2);
      const twoDaysAgoKey = formatDate(twoDaysAgo);

      const mockLogs = {
        [todayKey]: {
          date: todayKey,
          messagesCount: 10,
          platforms: { chatgpt: 6, claude: 4 },
          hours: { '10': 10 }
        },
        [yesterdayKey]: {
          date: yesterdayKey,
          messagesCount: 5,
          platforms: { chatgpt: 3, gemini: 2 },
          hours: { '14': 5 }
        },
        [twoDaysAgoKey]: {
          date: twoDaysAgoKey,
          messagesCount: 8,
          platforms: { deepseek: 8 },
          hours: { '18': 8 }
        }
      };

      await chrome.storage.local.set({ dailyLogs: mockLogs });

      const stats = await StatsStorage.getSummaryStats(7);

      // Period and week assertions
      expect(stats.period.timeline).toHaveLength(7);
      expect(stats.week.last7Days).toHaveLength(7);
      expect(stats.period.messages).toBe(23);
      expect(stats.week.messages).toBe(23);
      expect(stats.today.messagesCount).toBe(10);
      expect(stats.today.platforms).toEqual({ chatgpt: 6, claude: 4 });

      // Platform totals
      expect(stats.period.platformTotals.chatgpt).toBe(9);
      expect(stats.period.platformTotals.claude).toBe(4);
      expect(stats.period.platformTotals.gemini).toBe(2);
      expect(stats.period.platformTotals.deepseek).toBe(8);

      // All-time and month
      expect(stats.allTime.messages).toBe(23);
      expect(stats.allTime.platformTotals.chatgpt).toBe(9);
    });

    it('supports custom numDays period such as 14, 30, and "all"', async () => {
      const stats14 = await StatsStorage.getSummaryStats(14);
      expect(stats14.period.timeline).toHaveLength(14);

      const statsAll = await StatsStorage.getSummaryStats('all');
      expect(statsAll.period.timeline).toHaveLength(30);
    });
  });

  describe('Streak Calculation Edge Cases', () => {
    function formatDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('returns 0 when there are no messages recorded', async () => {
      const stats = await StatsStorage.getSummaryStats(7);
      expect(stats.streak).toBe(0);
    });

    it('returns 1 when active today only', async () => {
      const today = new Date();
      const todayKey = formatDate(today);

      await chrome.storage.local.set({
        dailyLogs: {
          [todayKey]: { date: todayKey, messagesCount: 3, platforms: { chatgpt: 3 } }
        }
      });

      const stats = await StatsStorage.getSummaryStats(7);
      expect(stats.streak).toBe(1);
    });

    it('counts consecutive active days ending today (e.g., today + yesterday + 2 days ago = 3)', async () => {
      const today = new Date();
      const d0 = formatDate(today);

      const yest = new Date();
      yest.setDate(today.getDate() - 1);
      const d1 = formatDate(yest);

      const twoAgo = new Date();
      twoAgo.setDate(today.getDate() - 2);
      const d2 = formatDate(twoAgo);

      await chrome.storage.local.set({
        dailyLogs: {
          [d0]: { date: d0, messagesCount: 5 },
          [d1]: { date: d1, messagesCount: 2 },
          [d2]: { date: d2, messagesCount: 8 }
        }
      });

      const stats = await StatsStorage.getSummaryStats(7);
      expect(stats.streak).toBe(3);
    });

    it('maintains streak from yesterday when today has 0 messages (grace period)', async () => {
      const today = new Date();
      const yest = new Date();
      yest.setDate(today.getDate() - 1);
      const d1 = formatDate(yest);

      const twoAgo = new Date();
      twoAgo.setDate(today.getDate() - 2);
      const d2 = formatDate(twoAgo);

      await chrome.storage.local.set({
        dailyLogs: {
          [d1]: { date: d1, messagesCount: 4 },
          [d2]: { date: d2, messagesCount: 6 }
        }
      });

      const stats = await StatsStorage.getSummaryStats(7);
      expect(stats.streak).toBe(2);
    });

    it('stops streak count when encountering a gap day', async () => {
      const today = new Date();
      const d0 = formatDate(today);

      // Skip yesterday (gap)
      const twoAgo = new Date();
      twoAgo.setDate(today.getDate() - 2);
      const d2 = formatDate(twoAgo);

      await chrome.storage.local.set({
        dailyLogs: {
          [d0]: { date: d0, messagesCount: 5 },
          [d2]: { date: d2, messagesCount: 10 }
        }
      });

      const stats = await StatsStorage.getSummaryStats(7);
      expect(stats.streak).toBe(1);
    });

    it('stops streak if today is 0 and yesterday is 0, even if older days have messages', async () => {
      const today = new Date();
      const twoAgo = new Date();
      twoAgo.setDate(today.getDate() - 2);
      const d2 = formatDate(twoAgo);

      await chrome.storage.local.set({
        dailyLogs: {
          [d2]: { date: d2, messagesCount: 20 }
        }
      });

      const stats = await StatsStorage.getSummaryStats(7);
      expect(stats.streak).toBe(0);
    });
  });

  describe('Settings CRUD, Export & Clear', () => {
    it('gets default settings and updates them', async () => {
      const initial = await StatsStorage.getSettings();
      expect(initial.badgeDisplay).toBe('message_count');

      const updated = await StatsStorage.updateSettings({ badgeDisplay: 'none', customTheme: 'dark' });
      expect(updated.badgeDisplay).toBe('none');
      expect(updated.customTheme).toBe('dark');

      const fetched = await StatsStorage.getSettings();
      expect(fetched.badgeDisplay).toBe('none');
      expect(fetched.customTheme).toBe('dark');
    });

    it('exports all stored data as JSON string', async () => {
      await StatsStorage.incrementMessageCount('claude');
      const jsonStr = await StatsStorage.exportJSON();
      const parsed = JSON.parse(jsonStr);

      expect(parsed.dailyLogs).toBeDefined();
    });

    it('exports daily logs as CSV format', async () => {
      await StatsStorage.incrementMessageCount('chatgpt');
      const csv = await StatsStorage.exportCSV();

      expect(csv).toContain('Date,Total Messages,ChatGPT,Claude,Gemini,DeepSeek,Perplexity');
      expect(csv).toContain(StatsStorage.getTodayKey());
    });

    it('clears all usage metrics while preserving user settings', async () => {
      await StatsStorage.updateSettings({ badgeDisplay: 'none' });
      await StatsStorage.incrementMessageCount('gemini');

      await StatsStorage.clearAllData();

      const dailyLogs = await StatsStorage.getDailyLogs();
      expect(Object.keys(dailyLogs)).toHaveLength(0);

      const settings = await StatsStorage.getSettings();
      expect(settings.badgeDisplay).toBe('none');
    });
  });
});
