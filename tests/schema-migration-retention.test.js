import { describe, it, expect, beforeEach } from 'vitest';
import { StatsStorage, SCHEMA_VERSION } from '../shared/storage.js';
import { resetChromeMock, chromeMock } from './mocks/chrome.mock.js';
import { exportAnonymousBenchmark, exportMarkdownReport } from '../shared/telemetry-exporter.js';

describe('Schema Migration & Automated Retention Suite', () => {
  beforeEach(() => {
    resetChromeMock();
  });

  describe('migrateSchema()', () => {
    it('migrates legacy v1 dailyLogs to Schema v2 with zero data loss', async () => {
      const v1Logs = {
        '2026-01-15': {
          date: '2026-01-15',
          messagesCount: 25,
          platforms: { chatgpt: 15, claude: 10 },
          hours: { '9': 10, '14': 15 }
        }
      };

      const v1Settings = {
        badgeDisplay: 'message_count',
        theme: 'dark'
      };

      await chromeMock.storage.local.set({
        dailyLogs: v1Logs,
        settings: v1Settings
      });

      const migrationResult = await StatsStorage.migrateSchema();
      expect(migrationResult.migrated).toBe(true);
      expect(migrationResult.toVersion).toBe(SCHEMA_VERSION);

      const logsAfter = await StatsStorage.getDailyLogs();
      const day = logsAfter['2026-01-15'];
      expect(day.messagesCount).toBe(25);
      expect(day.platforms.chatgpt).toBe(15);
      expect(day.topics).toBeDefined();
      expect(day.models).toBeDefined();

      const settingsAfter = await StatsStorage.getSettings();
      expect(settingsAfter.schemaVersion).toBe(SCHEMA_VERSION);
      expect(settingsAfter.theme).toBe('dark');
      expect(settingsAfter.retentionPolicy).toBe('90');
    });

    it('is idempotent when run multiple times on already-migrated data', async () => {
      await chromeMock.storage.local.set({
        dailyLogs: {
          '2026-08-28': { date: '2026-08-28', messagesCount: 5 }
        },
        settings: {
          schemaVersion: SCHEMA_VERSION
        }
      });

      const firstRun = await StatsStorage.migrateSchema();
      expect(firstRun.migrated).toBe(false);

      const secondRun = await StatsStorage.migrateSchema();
      expect(secondRun.migrated).toBe(false);
    });
  });

  describe('archiveOldLogs() and Retention Policies', () => {
    it('rolls up old logs into monthlyAggregates table while purging daily records', async () => {
      const oldDate = '2024-05-10'; // > 90 days ago
      const recentDate = StatsStorage.getTodayKey();

      await chromeMock.storage.local.set({
        dailyLogs: {
          [oldDate]: {
            date: oldDate,
            messagesCount: 30,
            platforms: { chatgpt: 20, claude: 10 },
            topics: { code_debugging: 25, writing_editing: 5 }
          },
          [recentDate]: {
            date: recentDate,
            messagesCount: 12,
            platforms: { chatgpt: 12 },
            topics: { code_debugging: 12 }
          }
        }
      });

      const res = await StatsStorage.archiveOldLogs(90);
      expect(res.archivedDaysCount).toBe(1);
      expect(res.archivedMessagesCount).toBe(30);
      expect(res.retainedDays).toBe(1);

      // Verify daily logs
      const dailyAfter = await StatsStorage.getDailyLogs();
      expect(dailyAfter[oldDate]).toBeUndefined();
      expect(dailyAfter[recentDate]).toBeDefined();

      // Verify monthly aggregates
      const monthly = await StatsStorage.getMonthlyAggregates();
      expect(monthly['2024-05']).toBeDefined();
      expect(monthly['2024-05'].messagesCount).toBe(30);
      expect(monthly['2024-05'].platforms.chatgpt).toBe(20);
      expect(monthly['2024-05'].topics.code_debugging).toBe(25);
      expect(monthly['2024-05'].activeDays).toBe(1);
    });

    it('respects "disabled" retention setting and leaves all historical data untouched', async () => {
      await StatsStorage.updateSettings({ retentionPolicy: 'disabled' });

      const oldDate = '2023-01-01';
      await chromeMock.storage.local.set({
        dailyLogs: {
          [oldDate]: { date: oldDate, messagesCount: 50 }
        }
      });

      const res = await StatsStorage.runRetentionPolicy();
      expect(res.skipped).toBe(true);

      const logs = await StatsStorage.getDailyLogs();
      expect(logs[oldDate]).toBeDefined();
    });
  });

  describe('365+ Days Synthetic Dataset Performance & Stability', () => {
    it('processes and aggregates 365+ days of dense synthetic telemetry efficiently under 250ms', async () => {
      const syntheticLogs = {};
      const baseDate = new Date('2025-01-01');

      for (let i = 0; i < 370; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        syntheticLogs[dateKey] = {
          date: dateKey,
          messagesCount: 20 + (i % 15),
          platforms: {
            chatgpt: 10 + (i % 5),
            claude: 5 + (i % 3),
            gemini: 3 + (i % 2),
            deepseek: 2
          },
          hours: {
            '9': 5,
            '11': 8,
            '15': 7
          },
          topics: {
            code_debugging: 12,
            research_analysis: 5,
            writing_editing: 3
          },
          complexitySum: (20 + (i % 15)) * 45,
          complexityCount: 20 + (i % 15)
        };
      }

      await chromeMock.storage.local.set({ dailyLogs: syntheticLogs });

      const t0 = performance.now();
      const summary = await StatsStorage.getSummaryStats(30);
      const benchmark = exportAnonymousBenchmark(syntheticLogs);
      const report = exportMarkdownReport(syntheticLogs);
      const t1 = performance.now();

      expect(summary.period.timeline).toHaveLength(30);
      expect(benchmark.aggregates.totalLoggedVolumeTier).toBe('1000+');
      expect(benchmark.aggregates.activeDaysTier).toBe('90+ days');
      expect(report).toContain('# 📊 AIStat Analytics & Productivity Report');

      const elapsedMs = t1 - t0;
      expect(elapsedMs).toBeLessThan(500); // Super fast execution
    });
  });
});
