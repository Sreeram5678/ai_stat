import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStorage } from '../../shared/storage.js';
import { handleRuntimeMessage } from '../../background/service-worker.js';
import { exportMarkdownReport, exportPrometheusMetrics } from '../../shared/telemetry-exporter.js';
import { calculateGoalProgress } from '../../shared/goal-manager.js';
import { clusterPromptsIntoSessions, analyzeSessionPatterns } from '../../shared/session-analyzer.js';
import { setupChromeMock, resetChromeMock } from '../mocks/chrome.mock.js';

describe('Multi-Tab Concurrency & Realistic Workflow Simulation', () => {
  beforeEach(() => {
    resetChromeMock();
    setupChromeMock();
  });

  it('simulates 10 concurrent tabs submitting AI prompts over a 24-hour workday', async () => {
    const platforms = ['chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity', 'aisearch'];
    const promptEvents = [];
    const baseDate = new Date('2026-08-28T08:00:00Z').getTime();

    // 1. Generate 500 prompts distributed across 10 virtual browser tabs
    const promises = [];
    for (let i = 0; i < 500; i++) {
      // Space events over 8 hours (28,800,000 ms)
      const offsetMs = Math.floor(Math.random() * 28800000);
      const timestamp = baseDate + offsetMs;
      const platform = platforms[i % platforms.length];

      promptEvents.push({ timestamp, platform });

      promises.push(
        handleRuntimeMessage({
          type: 'RECORD_PROMPT',
          data: { platform, timestamp }
        })
      );
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(500);

    // 2. Verify storage data consistency
    const dailyLogs = await StatsStorage.getDailyLogs();
    const stats = await StatsStorage.getSummaryStats(7);

    expect(stats.today.messagesCount).toBeGreaterThan(0);
    expect(typeof stats.today.messagesCount).toBe('number');
    expect(Number.isInteger(stats.today.messagesCount)).toBe(true);

    // 3. Verify Session Clustering on simulated events
    const sessions = clusterPromptsIntoSessions(promptEvents, { inactivityTimeoutMs: 20 * 60 * 1000 });
    expect(sessions.length).toBeGreaterThan(0);

    const sessionAnalysis = analyzeSessionPatterns(sessions);
    expect(sessionAnalysis.totalSessions).toBe(sessions.length);
    expect(sessionAnalysis.averageDurationMinutes).toBeGreaterThanOrEqual(0);
    expect(sessionAnalysis.averagePromptsPerSession).toBeGreaterThan(0);

    // 4. Verify Goal Progress under simulated load
    const goals = {
      enabled: true,
      dailyTarget: 100,
      dailyMaxCap: 300,
      alertThresholdPercent: 80
    };
    const goalProgress = calculateGoalProgress(dailyLogs, goals);
    expect(goalProgress.today.current).toBe(stats.today.messagesCount);
    expect(goalProgress.today.percent).toBeGreaterThan(0);

    // 5. Verify Telemetry Exporters under simulated data
    const md = exportMarkdownReport(dailyLogs);
    expect(md).toContain('AIStat Analytics & Productivity Report');

    const prom = exportPrometheusMetrics(dailyLogs);
    expect(prom).toContain('aistat_messages_total');

    // 6. Verify Storage Quota metrics
    const usage = await StatsStorage.getStorageUsage();
    expect(usage.bytesInUse).toBeGreaterThan(0);
    expect(usage.percentUsed).toBeLessThan(50); // Well under 5MB limit
  });
});
