import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStorage } from '../shared/storage.js';
import { resetChromeMock, chromeMock } from './mocks/chrome.mock.js';

describe('StatsStorage - Backup & Restore System', () => {
  beforeEach(async () => {
    resetChromeMock();
  });

  describe('exportBackup()', () => {
    it('generates a valid backup structure with version, exportDate, dailyLogs, and settings', async () => {
      const initialLogs = {
        '2026-08-20': {
          date: '2026-08-20',
          messagesCount: 15,
          platforms: { chatgpt: 10, claude: 5 },
          hours: { '9': 5, '14': 10 }
        }
      };
      const initialSettings = {
        badgeDisplay: 'message_count',
        theme: 'dark'
      };

      await chromeMock.storage.local.set({
        dailyLogs: initialLogs,
        settings: initialSettings
      });

      const backup = await StatsStorage.exportBackup();

      expect(backup.version).toBe('2.0.0');
      expect(typeof backup.exportDate).toBe('string');
      expect(isNaN(Date.parse(backup.exportDate))).toBe(false);
      expect(backup.dailyLogs).toEqual(initialLogs);
      expect(backup.settings.theme).toBe('dark');
      expect(backup.settings.badgeDisplay).toBe('message_count');
    });

    it('handles empty storage gracefully', async () => {
      const backup = await StatsStorage.exportBackup();
      expect(backup.version).toBe('2.0.0');
      expect(backup.dailyLogs).toEqual({});
      expect(backup.settings).toBeDefined();
    });
  });

  describe('validateBackup()', () => {
    it('validates a correct backup object', () => {
      const validBackup = {
        version: '2.0.0',
        exportDate: '2026-08-28T12:00:00.000Z',
        dailyLogs: {
          '2026-08-25': {
            date: '2026-08-25',
            messagesCount: 12,
            platforms: { chatgpt: 8, gemini: 4 },
            hours: { '10': 12 }
          }
        },
        settings: {
          theme: 'auto',
          badgeDisplay: 'message_count'
        }
      };

      const result = StatsStorage.validateBackup(validBackup);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.data).toBeDefined();
      expect(result.data.dailyLogs['2026-08-25'].messagesCount).toBe(12);
      expect(result.data.dailyLogs['2026-08-25'].platforms.chatgpt).toBe(8);
    });

    it('validates a valid JSON stringified backup', () => {
      const validJson = JSON.stringify({
        version: '2.0.0',
        dailyLogs: {
          '2026-08-26': {
            messagesCount: 5,
            platforms: { claude: 5 }
          }
        }
      });

      const result = StatsStorage.validateBackup(validJson);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.data.dailyLogs['2026-08-26']).toBeDefined();
    });

    it('fails when given corrupted JSON string', () => {
      const corruptedJson = '{"version": "2.0.0", dailyLogs: {';
      const result = StatsStorage.validateBackup(corruptedJson);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid JSON format'))).toBe(true);
    });

    it('fails when root is null, array, or non-object', () => {
      expect(StatsStorage.validateBackup(null).valid).toBe(false);
      expect(StatsStorage.validateBackup([]).valid).toBe(false);
      expect(StatsStorage.validateBackup(123).valid).toBe(false);
      expect(StatsStorage.validateBackup('hello').valid).toBe(false);
    });

    it('fails when missing required fields (version, dailyLogs)', () => {
      const missingVersion = {
        dailyLogs: {}
      };
      const res1 = StatsStorage.validateBackup(missingVersion);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some(e => e.includes('version'))).toBe(true);

      const missingLogs = {
        version: '2.0.0'
      };
      const res2 = StatsStorage.validateBackup(missingLogs);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some(e => e.includes('dailyLogs'))).toBe(true);
    });

    it('fails on invalid date formats and non-existent dates', () => {
      const invalidDatesBackup = {
        version: '2.0.0',
        dailyLogs: {
          'invalid-date': { messagesCount: 1 },
          '2026-13-45': { messagesCount: 1 },
          '2026-02-30': { messagesCount: 1 },
          '2026/08/28': { messagesCount: 1 }
        }
      };

      const result = StatsStorage.validateBackup(invalidDatesBackup);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('fails when negative numbers are present in counts', () => {
      const negativeCountsBackup = {
        version: '2.0.0',
        dailyLogs: {
          '2026-08-27': {
            messagesCount: -5,
            platforms: { chatgpt: -2 },
            hours: { '10': -1 }
          }
        }
      };

      const result = StatsStorage.validateBackup(negativeCountsBackup);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Negative or NaN messagesCount'))).toBe(true);
      expect(result.errors.some(e => e.includes('Negative or NaN platform count'))).toBe(true);
      expect(result.errors.some(e => e.includes('Negative or NaN hour count'))).toBe(true);
    });

    it('protects against prototype injection attacks in JSON and object payloads', () => {
      const maliciousJson = '{"version":"2.0.0","__proto__":{"polluted":true},"dailyLogs":{"__proto__":{"injected":true},"2026-08-28":{"messagesCount":5,"platforms":{"constructor":1}}}}';
      const result = StatsStorage.validateBackup(maliciousJson);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Prototype injection detected'))).toBe(true);
      expect(Object.prototype.polluted).toBeUndefined();
      expect(Object.prototype.injected).toBeUndefined();
    });
  });

  describe('importBackup()', () => {
    it('throws error when importing invalid backup data', async () => {
      await expect(StatsStorage.importBackup({ invalid: true })).rejects.toThrow(
        /Backup validation failed/
      );
    });

    it('merges imported dailyLogs into existing dailyLogs in "merge" mode', async () => {
      // Existing data
      const existingLogs = {
        '2026-08-20': {
          date: '2026-08-20',
          messagesCount: 10,
          platforms: { chatgpt: 6, claude: 4 },
          hours: { '10': 5, '11': 5 }
        },
        '2026-08-21': {
          date: '2026-08-21',
          messagesCount: 20,
          platforms: { gemini: 20 },
          hours: { '12': 20 }
        }
      };
      await chromeMock.storage.local.set({ dailyLogs: existingLogs });

      // Imported data (duplicate date 2026-08-20 + new date 2026-08-22)
      const importedBackup = {
        version: '2.0.0',
        dailyLogs: {
          '2026-08-20': {
            date: '2026-08-20',
            messagesCount: 18, // higher than existing 10
            platforms: { chatgpt: 3, claude: 15 }, // chatgpt 3 < 6, claude 15 > 4
            hours: { '10': 8, '14': 10 } // 10: 8 > 5, 14: new
          },
          '2026-08-22': {
            date: '2026-08-22',
            messagesCount: 7,
            platforms: { deepseek: 7 },
            hours: { '15': 7 }
          }
        }
      };

      const finalLogs = await StatsStorage.importBackup(importedBackup, { mode: 'merge' });

      // Check date 2026-08-20 (Merged with Math.max)
      expect(finalLogs['2026-08-20'].messagesCount).toBe(18);
      expect(finalLogs['2026-08-20'].platforms.chatgpt).toBe(6); // Math.max(6, 3) = 6
      expect(finalLogs['2026-08-20'].platforms.claude).toBe(15); // Math.max(4, 15) = 15
      expect(finalLogs['2026-08-20'].hours['10']).toBe(8); // Math.max(5, 8) = 8
      expect(finalLogs['2026-08-20'].hours['11']).toBe(5); // retained
      expect(finalLogs['2026-08-20'].hours['14']).toBe(10); // new hour added

      // Check date 2026-08-21 (Untouched existing day)
      expect(finalLogs['2026-08-21'].messagesCount).toBe(20);
      expect(finalLogs['2026-08-21'].platforms.gemini).toBe(20);

      // Check date 2026-08-22 (Newly imported day)
      expect(finalLogs['2026-08-22'].messagesCount).toBe(7);
      expect(finalLogs['2026-08-22'].platforms.deepseek).toBe(7);

      // Verify persisted to chrome.storage
      const stored = await chromeMock.storage.local.get('dailyLogs');
      expect(stored.dailyLogs).toEqual(finalLogs);
    });

    it('overwrites all existing dailyLogs in "overwrite" mode', async () => {
      await chromeMock.storage.local.set({
        dailyLogs: {
          '2026-08-10': { date: '2026-08-10', messagesCount: 50 }
        },
        settings: {
          theme: 'light',
          badgeDisplay: 'none'
        }
      });

      const backupData = {
        version: '2.0.0',
        dailyLogs: {
          '2026-08-28': {
            date: '2026-08-28',
            messagesCount: 30,
            platforms: { perplexity: 30 }
          }
        },
        settings: {
          theme: 'dark',
          badgeDisplay: 'message_count'
        }
      };

      const finalLogs = await StatsStorage.importBackup(backupData, { mode: 'overwrite' });

      // Old 2026-08-10 must be gone
      expect(finalLogs['2026-08-10']).toBeUndefined();
      // Only 2026-08-28 exists
      expect(finalLogs['2026-08-28'].messagesCount).toBe(30);
      expect(finalLogs['2026-08-28'].platforms.perplexity).toBe(30);

      // Settings updated
      const stored = await chromeMock.storage.local.get(['dailyLogs', 'settings']);
      expect(stored.settings.theme).toBe('dark');
      expect(stored.settings.badgeDisplay).toBe('message_count');
    });
  });
});
