import { describe, it, expect } from 'vitest';
import {
  calculateWoWChange,
  findPeakHour,
  calculateStreak,
  formatHour,
  analyzeWeeklyTrends
} from '../shared/trend-analyzer.js';

describe('Weekly Trends & Insights Engine (shared/trend-analyzer.js)', () => {
  describe('calculateWoWChange()', () => {
    it('calculates week-over-week percentage increase correctly', () => {
      const result = calculateWoWChange(150, 100);
      expect(result.delta).toBe(50);
      expect(result.formatted).toBe('+50%');
      expect(result.direction).toBe('up');
    });

    it('calculates week-over-week percentage decrease correctly', () => {
      const result = calculateWoWChange(50, 100);
      expect(result.delta).toBe(-50);
      expect(result.formatted).toBe('-50%');
      expect(result.direction).toBe('down');
    });

    it('handles flat / neutral week-over-week change', () => {
      const result = calculateWoWChange(80, 80);
      expect(result.delta).toBe(0);
      expect(result.formatted).toBe('0%');
      expect(result.direction).toBe('neutral');
    });

    it('handles zero previous week with active current week (+100%)', () => {
      const result = calculateWoWChange(45, 0);
      expect(result.delta).toBe(100);
      expect(result.formatted).toBe('+100%');
      expect(result.direction).toBe('up');
    });

    it('handles zero in both weeks', () => {
      const result = calculateWoWChange(0, 0);
      expect(result.delta).toBe(0);
      expect(result.formatted).toBe('0%');
      expect(result.direction).toBe('neutral');
    });
  });

  describe('findPeakHour()', () => {
    it('identifies the hour with highest aggregate message volume', () => {
      const dailyLogs = {
        '2026-08-28': {
          messagesCount: 20,
          hours: {
            '9': 3,
            '14': 12,
            '18': 5
          }
        },
        '2026-08-27': {
          messagesCount: 10,
          hours: {
            '14': 4,
            '20': 6
          }
        }
      };

      const peak = findPeakHour(dailyLogs);
      expect(peak.hour).toBe(14);
      expect(peak.formatted).toBe('14:00');
      expect(peak.count).toBe(16); // 12 + 4
      expect(peak.label).toBe('2:00 PM');
    });

    it('falls back gracefully to 14:00 when no hourly data is available', () => {
      const peak = findPeakHour({});
      expect(peak.hour).toBe(14);
      expect(peak.formatted).toBe('14:00');
      expect(peak.count).toBe(0);
    });
  });

  describe('calculateStreak()', () => {
    it('calculates consecutive active days up to reference date', () => {
      const refDate = new Date('2026-08-28T12:00:00Z');
      const dailyLogs = {
        '2026-08-28': { messagesCount: 10 },
        '2026-08-27': { messagesCount: 5 },
        '2026-08-26': { messagesCount: 8 },
        '2026-08-25': { messagesCount: 0 },
        '2026-08-24': { messagesCount: 15 }
      };

      const streak = calculateStreak(dailyLogs, refDate);
      expect(streak).toBe(3);
    });

    it('continues streak from yesterday if today has no logs yet', () => {
      const refDate = new Date('2026-08-28T12:00:00Z');
      const dailyLogs = {
        '2026-08-28': { messagesCount: 0 },
        '2026-08-27': { messagesCount: 12 },
        '2026-08-26': { messagesCount: 6 }
      };

      const streak = calculateStreak(dailyLogs, refDate);
      expect(streak).toBe(2);
    });
  });

  describe('analyzeWeeklyTrends()', () => {
    it('aggregates weekly metrics, ranks platforms including Google AI Search, and estimates compute value', () => {
      const refDate = new Date('2026-08-28T12:00:00Z');

      const dailyLogs = {
        // This week (Aug 22 - Aug 28): 70 total msgs
        '2026-08-28': { messagesCount: 20, platforms: { chatgpt: 10, aisearch: 10 }, hours: { '14': 15, '10': 5 } },
        '2026-08-27': { messagesCount: 10, platforms: { claude: 10 }, hours: { '14': 10 } },
        '2026-08-26': { messagesCount: 10, platforms: { gemini: 10 } },
        '2026-08-25': { messagesCount: 10, platforms: { deepseek: 10 } },
        '2026-08-24': { messagesCount: 10, platforms: { perplexity: 10 } },
        '2026-08-23': { messagesCount: 5, platforms: { aisearch: 5 } },
        '2026-08-22': { messagesCount: 5, platforms: { chatgpt: 5 } },
        // Last week (Aug 15 - Aug 21): 35 total msgs
        '2026-08-21': { messagesCount: 15, platforms: { chatgpt: 15 } },
        '2026-08-20': { messagesCount: 20, platforms: { chatgpt: 20 } }
      };

      const trends = analyzeWeeklyTrends(dailyLogs, { referenceDate: refDate });

      expect(trends.totalThisWeek).toBe(70);
      expect(trends.totalLastWeek).toBe(35);
      expect(trends.wowDeltaPct).toBe(100);
      expect(trends.wowDeltaFormatted).toBe('+100%');
      expect(trends.wowDirection).toBe('up');
      expect(trends.dailyAverage).toBe(10.0);
      expect(trends.dailyAverageFormatted).toBe('10.0');
      expect(trends.daysActiveThisWeek).toBe(7);
      expect(trends.peakHour).toBe('14:00');

      // Check aisearch platform
      const aisearch = trends.platformsRanked.find(p => p.id === 'aisearch');
      expect(aisearch).toBeDefined();
      expect(aisearch.name).toBe('Google AI Search');
      expect(aisearch.count).toBe(15);
      expect(aisearch.color).toBe('#4285F4');
      expect(aisearch.percentage).toBe(Math.round((15 / 70) * 100)); // 21%

      // Check estimated tokens & compute value (70 * 1200 = 84,000)
      expect(trends.estimatedTokens).toBe(84000);
      expect(trends.estimatedTokensFormatted).toBe('84.0k');
      expect(trends.estimatedComputeValueFormatted).toBe('$0.17');
    });
  });
});
