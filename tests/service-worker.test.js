import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleRuntimeMessage, updateBadge } from '../background/service-worker.js';
import { StatsStorage } from '../shared/storage.js';
import { resetChromeMock, chromeMock } from './mocks/chrome.mock.js';

describe('Background Service Worker', () => {
  beforeEach(() => {
    resetChromeMock();
  });

  it('handles RECORD_PROMPT and debounces duplicate triggers within 4000ms', async () => {
    const res1 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'chatgpt', timestamp: 10000 }
    });

    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBeUndefined();

    // Immediate duplicate trigger on same platform
    const res2 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'chatgpt', timestamp: 11000 }
    });

    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);

    // Prompt on different platform should succeed
    const res3 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'claude', timestamp: 11000 }
    });

    expect(res3.success).toBe(true);
    expect(res3.duplicate).toBeUndefined();
  });

  it('handles GET_STATS and returns summary statistics', async () => {
    await StatsStorage.incrementMessageCount('gemini');
    const res = await handleRuntimeMessage({ type: 'GET_STATS', numDays: 7 });

    expect(res.success).toBe(true);
    expect(res.summary.today.messagesCount).toBeGreaterThanOrEqual(1);
  });

  it('handles GET_EXPORT for various formats', async () => {
    await StatsStorage.incrementMessageCount('claude');

    const mdRes = await handleRuntimeMessage({ type: 'GET_EXPORT', format: 'markdown' });
    expect(mdRes.success).toBe(true);
    expect(mdRes.data).toContain('# 📊 AIStat Analytics & Productivity Report');

    const promRes = await handleRuntimeMessage({ type: 'GET_EXPORT', format: 'prometheus' });
    expect(promRes.success).toBe(true);
    expect(promRes.data).toContain('# HELP aistat_messages_total');

    const jsonldRes = await handleRuntimeMessage({ type: 'GET_EXPORT', format: 'json-ld' });
    expect(jsonldRes.success).toBe(true);
    expect(jsonldRes.data['@type']).toBe('Dataset');
  });

  it('handles GET_STORAGE_USAGE and ARCHIVE_LOGS', async () => {
    const usageRes = await handleRuntimeMessage({ type: 'GET_STORAGE_USAGE' });
    expect(usageRes.success).toBe(true);
    expect(usageRes.usage.quotaBytes).toBe(5242880);

    const archiveRes = await handleRuntimeMessage({ type: 'ARCHIVE_LOGS', retentionDays: 90 });
    expect(archiveRes.success).toBe(true);
    expect(archiveRes.archiveResult).toBeDefined();
  });

  it('handles RESET_DATA and clears storage', async () => {
    await StatsStorage.incrementMessageCount('deepseek');
    const resetRes = await handleRuntimeMessage({ type: 'RESET_DATA' });

    expect(resetRes.success).toBe(true);
    const logs = await StatsStorage.getDailyLogs();
    expect(Object.keys(logs)).toHaveLength(0);
  });

  it('updates badge with appropriate color based on goal thresholds', async () => {
    await StatsStorage.updateSettings({
      badgeDisplay: 'message_count',
      goals: {
        enabled: true,
        dailyTarget: 5,
        dailyMaxCap: 10,
        alertThresholdPercent: 80
      }
    });

    // Send 10 messages to reach cap
    for (let i = 0; i < 10; i++) {
      await StatsStorage.incrementMessageCount('chatgpt');
    }

    await updateBadge();
    const state = chromeMock.action._getState();
    expect(state.text).toBe('10');
    expect(state.backgroundColor).toBe('#ef4444'); // Red cap exceeded
  });

  it('authoritatively debounces rapid successive prompts within 4000ms', async () => {
    // 1. Initial prompt trigger
    const res1 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'chatgpt' }
    });
    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBeUndefined();

    // 2. Immediate duplicate within 4000ms
    const res2 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'chatgpt' }
    });
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);
  });
});
