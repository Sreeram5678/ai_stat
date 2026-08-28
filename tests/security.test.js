import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStorage } from '../shared/storage.js';
import { setupChromeMock } from './mocks/chrome.mock.js';

describe('Security & Vulnerability Resistance Suite', () => {
  beforeEach(() => {
    setupChromeMock();
  });

  describe('1. Prototype Pollution Defense', () => {
    it('should reject JSON backups with __proto__ or constructor injections', () => {
      const maliciousPayload = JSON.parse('{"version":"2.0.0","dailyLogs":{"2026-08-28":{"messagesCount":5,"__proto__":{"polluted":true}}},"constructor":{"prototype":{"isAdmin":true}}}');
      
      const validation = StatsStorage.validateBackup(maliciousPayload);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Prototype pollution') || e.includes('Invalid key') || e.includes('Invalid backup'))).toBe(true);
      expect(({})['polluted']).toBeUndefined();
      expect(({})['isAdmin']).toBeUndefined();
    });

    it('should sanitize nested objects containing prototype pollution in platform counts', () => {
      const evilCountObj = Object.create(null);
      evilCountObj['__proto__'] = 9999;
      evilCountObj['count'] = 12;

      const sanitized = StatsStorage.sanitizeCount(evilCountObj);
      expect(sanitized).toBe(12);
    });
  });

  describe('2. XSS & Script Injection Neutralization', () => {
    it('should sanitize script tags in date keys or platform counts', () => {
      const xssDate = '<script>alert("xss")</script>';
      const payload = {
        version: '2.0.0',
        dailyLogs: {
          [xssDate]: {
            messagesCount: 10
          }
        }
      };

      const validation = StatsStorage.validateBackup(payload);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid date format'))).toBe(true);
    });

    it('should sanitize non-string, non-numeric values in sanitizeCount', () => {
      expect(StatsStorage.sanitizeCount('<svg onload=alert(1)>')).toBe(0);
      expect(StatsStorage.sanitizeCount('javascript:void(0)')).toBe(0);
      expect(StatsStorage.sanitizeCount('100<script>alert(1)</script>')).toBe(100);
      expect(StatsStorage.sanitizeCount({ messages: '<script>50</script>' })).toBe(50);
    });
  });

  describe('3. Malformed JSON & Memory Bomb Resistance', () => {
    it('should handle circular object references gracefully', () => {
      const circular = { version: '2.0.0' };
      circular.self = circular;

      const validation = StatsStorage.validateBackup(circular);
      expect(validation.valid).toBe(false);
    });

    it('should reject non-calendar dates (e.g. February 31st, leap year edge cases)', () => {
      const invalidDates = ['2026-02-30', '2026-02-31', '2026-04-31', '2026-13-01', '2026-00-10'];
      for (const date of invalidDates) {
        const payload = {
          version: '2.0.0',
          dailyLogs: {
            [date]: { messagesCount: 5 }
          }
        };
        const validation = StatsStorage.validateBackup(payload);
        expect(validation.valid).toBe(false);
      }
    });

    it('should accept valid leap day dates (e.g. 2024-02-29, 2028-02-29)', () => {
      const leapPayload = {
        version: '2.0.0',
        dailyLogs: {
          '2028-02-29': { messagesCount: 15, platforms: { chatgpt: 15 } }
        }
      };
      const validation = StatsStorage.validateBackup(leapPayload);
      expect(validation.valid).toBe(true);
    });
  });
});
