import { describe, it, expect } from 'vitest';
import {
  clusterPromptsIntoSessions,
  analyzeSessionPatterns
} from '../shared/session-analyzer.js';

describe('session-analyzer suite', () => {
  const baseTime = 1756400000000; // arbitrary timestamp base

  describe('clusterPromptsIntoSessions', () => {
    it('returns empty array for empty inputs', () => {
      expect(clusterPromptsIntoSessions([])).toEqual([]);
      expect(clusterPromptsIntoSessions(null)).toEqual([]);
    });

    it('clusters closely spaced events into a single session', () => {
      const events = [
        { timestamp: baseTime, platform: 'chatgpt' },
        { timestamp: baseTime + 60000, platform: 'chatgpt' }, // +1 min
        { timestamp: baseTime + 120000, platform: 'chatgpt' } // +2 min
      ];

      const sessions = clusterPromptsIntoSessions(events, { inactivityTimeoutMs: 300000 }); // 5 min timeout
      expect(sessions).toHaveLength(1);

      const s = sessions[0];
      expect(s.promptsCount).toBe(3);
      expect(s.durationMs).toBe(120000);
      expect(s.durationMinutes).toBe(2);
      expect(s.distinctPlatformsCount).toBe(1);
      expect(s.primaryPlatform).toBe('chatgpt');
    });

    it('splits events into separate sessions when inactivity exceeds timeout', () => {
      const events = [
        { timestamp: baseTime, platform: 'chatgpt' },
        { timestamp: baseTime + 60000, platform: 'chatgpt' },
        // 40-minute gap
        { timestamp: baseTime + 2460000, platform: 'claude' },
        { timestamp: baseTime + 2520000, platform: 'claude' }
      ];

      const sessions = clusterPromptsIntoSessions(events, { inactivityTimeoutMs: 1800000 }); // 30 min timeout
      expect(sessions).toHaveLength(2);
      expect(sessions[0].primaryPlatform).toBe('chatgpt');
      expect(sessions[1].primaryPlatform).toBe('claude');
    });

    it('classifies workstyles accurately based on prompt velocity and platforms', () => {
      // 10 prompts on one platform => deep_work
      const deepWorkEvents = Array.from({ length: 10 }, (_, i) => ({
        timestamp: baseTime + i * 30000,
        platform: 'claude'
      }));

      const sessions = clusterPromptsIntoSessions(deepWorkEvents);
      expect(sessions[0].workstyle).toBe('deep_work');

      // 8 prompts across multiple platforms => rapid_multitasking
      const multiEvents = Array.from({ length: 8 }, (_, i) => ({
        timestamp: baseTime + i * 30000,
        platform: i % 2 === 0 ? 'chatgpt' : 'claude'
      }));

      const multiSessions = clusterPromptsIntoSessions(multiEvents);
      expect(multiSessions[0].workstyle).toBe('rapid_multitasking');
    });
  });

  describe('analyzeSessionPatterns', () => {
    it('computes session patterns across multiple sessions', () => {
      const sessions = [
        { durationMinutes: 10, promptsCount: 5, distinctPlatformsCount: 1, workstyle: 'iterative_coding' },
        { durationMinutes: 20, promptsCount: 12, distinctPlatformsCount: 1, workstyle: 'deep_work' },
        { durationMinutes: 15, promptsCount: 8, distinctPlatformsCount: 2, workstyle: 'rapid_multitasking' }
      ];

      const analysis = analyzeSessionPatterns(sessions);
      expect(analysis.totalSessions).toBe(3);
      expect(analysis.averageDurationMinutes).toBe(15);
      expect(analysis.averagePromptsPerSession).toBe(8.3);
      expect(analysis.multitaskingRatePercent).toBe(33); // 1 of 3
      expect(analysis.workstyleBreakdown.deep_work).toBe(1);
    });

    it('handles empty session arrays', () => {
      const empty = analyzeSessionPatterns([]);
      expect(empty.totalSessions).toBe(0);
      expect(empty.dominantWorkstyle).toBe('none');
    });
  });
});
