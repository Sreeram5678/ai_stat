import { describe, it, expect } from 'vitest';
import {
  calculatePromptVelocity,
  calculateTurnaroundTimes,
  calculateContextSwitching,
  calculateWorkstyleRatios,
  buildWeeklyHeatmapMatrix
} from '../shared/velocity-analyzer.js';

describe('Velocity & Productivity Analyzer Suite', () => {
  describe('calculatePromptVelocity()', () => {
    it('handles empty events gracefully', () => {
      const res = calculatePromptVelocity([]);
      expect(res.totalPrompts).toBe(0);
      expect(res.activeHours).toBe(0);
      expect(res.promptsPerActiveHour).toBe(0);
    });

    it('calculates velocity accurately over multi-hour events', () => {
      const base = new Date('2026-08-28T10:00:00Z').getTime();
      const events = [
        { timestamp: base },
        { timestamp: base + 5 * 60 * 1000 },
        { timestamp: base + 10 * 60 * 1000 },
        // 1 hour later (11:00)
        { timestamp: base + 60 * 60 * 1000 },
        { timestamp: base + 65 * 60 * 1000 }
      ];

      const res = calculatePromptVelocity(events);
      expect(res.totalPrompts).toBe(5);
      expect(res.activeHours).toBe(2);
      expect(res.promptsPerActiveHour).toBe(2.5);
      expect(res.maxVelocityInHour).toBe(3);
    });
  });

  describe('calculateTurnaroundTimes()', () => {
    it('handles 0 or 1 event gracefully', () => {
      expect(calculateTurnaroundTimes([]).count).toBe(0);
      expect(calculateTurnaroundTimes([1000]).count).toBe(0);
    });

    it('handles duplicate timestamps and zero ms gaps safely', () => {
      const timestamps = [1000, 1000, 2000, 5000];
      const res = calculateTurnaroundTimes(timestamps);
      expect(res.count).toBe(3);
      expect(res.minSeconds).toBe(0);
      expect(res.maxSeconds).toBe(3);
    });

    it('computes mean, median, p25, p75, p90, p95 correctly', () => {
      // Intervals: 10s, 20s, 30s, 40s, 50s, 60s
      const base = 1000000;
      const timestamps = [
        base,
        base + 10 * 1000,
        base + 30 * 1000,
        base + 60 * 1000,
        base + 100 * 1000,
        base + 150 * 1000,
        base + 210 * 1000
      ];

      const res = calculateTurnaroundTimes(timestamps);
      expect(res.count).toBe(6);
      expect(res.minSeconds).toBe(10);
      expect(res.maxSeconds).toBe(60);
      expect(res.meanSeconds).toBe(35);
      expect(res.medianSeconds).toBeGreaterThanOrEqual(30);
      expect(res.p90Seconds).toBeGreaterThanOrEqual(50);
      expect(res.histogram.under30s).toBe(2); // 10s, 20s
    });

    it('excludes long gaps (> maxGapMs) that cross separate session boundaries', () => {
      const base = 1000000;
      const timestamps = [
        base,
        base + 30 * 1000,
        base + 2 * 3600 * 1000, // 2 hour gap
        base + 2 * 3600 * 1000 + 45 * 1000
      ];

      const res = calculateTurnaroundTimes(timestamps, { maxGapMs: 30 * 60 * 1000 });
      expect(res.count).toBe(2); // 30s and 45s, 2hr gap excluded
      expect(res.maxSeconds).toBe(45);
    });
  });

  describe('calculateContextSwitching()', () => {
    it('handles empty and single event datasets', () => {
      const res = calculateContextSwitching([]);
      expect(res.eligibleTransitions).toBe(0);
      expect(res.contextSwitchRate).toBe(0);
      expect(res.multiHomingScore).toBe(0);
    });

    it('detects platform switches within active workflow window', () => {
      const base = 1000000;
      const events = [
        { timestamp: base, platform: 'chatgpt', model: 'gpt-5.6' },
        { timestamp: base + 60 * 1000, platform: 'claude', model: 'claude-sonnet-5' }, // switch 1
        { timestamp: base + 120 * 1000, platform: 'claude', model: 'claude-sonnet-5' }, // same
        { timestamp: base + 180 * 1000, platform: 'deepseek', model: 'deepseek-v3' } // switch 2
      ];

      const res = calculateContextSwitching(events, { workflowWindowMs: 15 * 60 * 1000 });
      expect(res.eligibleTransitions).toBe(3);
      expect(res.platformSwitches).toBe(2);
      expect(res.contextSwitchRate).toBeCloseTo(0.667, 2);
      expect(res.distinctPlatformsUsed).toBe(3);
      expect(res.multiHomingScore).toBeGreaterThan(0.5);
    });
  });

  describe('calculateWorkstyleRatios()', () => {
    it('handles zero sessions safely without NaN or division by zero', () => {
      const res = calculateWorkstyleRatios([]);
      expect(res.totalSessions).toBe(0);
      expect(res.deepWorkRatio).toBe(0);
      expect(res.quickQueryRatio).toBe(0);
      expect(res.dominantStyle).toBe('none');
    });

    it('classifies deep work vs quick query sessions correctly', () => {
      const sessions = [
        { durationMinutes: 25, promptsCount: 12, workstyle: 'deep_work' },
        { durationMinutes: 15, promptsCount: 8, workstyle: 'iterative_coding' },
        { durationMinutes: 1, promptsCount: 1, workstyle: 'intermittent_lookup' }
      ];

      const res = calculateWorkstyleRatios(sessions);
      expect(res.totalSessions).toBe(3);
      expect(res.deepWorkCount).toBe(2);
      expect(res.quickQueryCount).toBe(1);
      expect(res.deepWorkRatio).toBe(0.67);
      expect(res.quickQueryRatio).toBe(0.33);
      expect(res.dominantStyle).toBe('deep_work');
    });
  });

  describe('buildWeeklyHeatmapMatrix()', () => {
    it('constructs a 7x24 matrix with correct weekday and hourly indices', () => {
      const mockLogs = {
        '2026-08-24': { // Monday
          date: '2026-08-24',
          messagesCount: 10,
          hours: { '9': 4, '14': 6 }
        },
        '2026-08-28': { // Friday
          date: '2026-08-28',
          messagesCount: 15,
          hours: { '14': 10, '20': 5 }
        }
      };

      const heatmap = buildWeeklyHeatmapMatrix(mockLogs);
      expect(heatmap.matrix).toHaveLength(7);
      expect(heatmap.matrix[0]).toHaveLength(24); // Mon
      expect(heatmap.matrix[0][9]).toBe(4);
      expect(heatmap.matrix[0][14]).toBe(6);
      expect(heatmap.matrix[4][14]).toBe(10); // Fri
      expect(heatmap.maxCellCount).toBe(10);
      expect(heatmap.totalPrompts).toBe(25);
    });
  });
});
