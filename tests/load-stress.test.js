import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStorage } from '../shared/storage.js';
import { calculateTotalCostAndTokens, calculateSubscriptionROI } from '../shared/cost-estimator.js';
import { analyzeWeeklyTrends } from '../shared/trend-analyzer.js';
import { setupChromeMock } from './mocks/chrome.mock.js';

describe('Load, Stress & High-Volume Telemetry Suite', () => {
  beforeEach(() => {
    setupChromeMock();
  });

  it('should handle 1,000 days of historical daily logs within sub-100ms calculation bounds', async () => {
    const massiveLogs = {};
    const baseDate = new Date(2023, 0, 1);

    for (let i = 0; i < 1000; i++) {
      const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      massiveLogs[key] = {
        messagesCount: (i % 50) + 1,
        platforms: {
          chatgpt: (i % 20) + 1,
          claude: (i % 15),
          gemini: (i % 10),
          deepseek: (i % 5),
          perplexity: 1,
          aisearch: 2
        },
        hours: {
          9: 2,
          14: 5,
          20: 3
        }
      };
    }

    const t0 = performance.now();
    const costAnalysis = calculateTotalCostAndTokens(massiveLogs, 'all', {}, 'medium', 'chatgpt-plus');
    const t1 = performance.now();

    expect(costAnalysis.totalMessages).toBeGreaterThan(20000);
    expect(costAnalysis.totalTokens).toBeGreaterThan(10000000);
    expect(t1 - t0).toBeLessThan(100); // Must be fast (< 100ms)
  });

  it('should handle high-frequency concurrent increment requests deterministically', async () => {
    const platform = 'claude';
    const increments = 100;

    // Simulate 100 concurrent prompt increments
    await Promise.all(
      Array.from({ length: increments }).map(() =>
        StatsStorage.incrementMessageCount(platform)
      )
    );

    const stats = await StatsStorage.getSummaryStats(7);
    expect(stats.today.messagesCount).toBe(increments);
    expect(stats.today.platforms.claude).toBe(increments);
  });

  it('should compute weekly trends and Bento Card stats seamlessly under heavy data', () => {
    const heavyLogs = {};
    const today = new Date();
    
    for (let i = 0; i < 60; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      heavyLogs[key] = {
        messagesCount: 100,
        platforms: { chatgpt: 50, claude: 30, aisearch: 20 },
        hours: { 14: 50, 15: 50 }
      };
    }

    const trends = analyzeWeeklyTrends(heavyLogs);
    expect(trends.totalThisWeek).toBe(700);
    expect(trends.totalLastWeek).toBe(700);
    expect(trends.wowDeltaPct).toBe(0);
    expect(trends.peakHour).toBe('14:00');
  });
});
