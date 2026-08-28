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

  it('deduplicates identical query submissions on aisearch within 15 seconds', async () => {
    const query = 'how do quantum computers work';

    // 1. Initial UI Enter key trigger
    const res1 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'aisearch', timestamp: 10000, queryText: query }
    });
    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBeUndefined();

    // 2. Delayed async network fetch on page render (e.g. 6 seconds later > 4000ms debounce)
    const res2 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'aisearch', timestamp: 16000, queryText: query }
    });
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true); // Blocked by query text match!

    // 3. New different search query after debounce
    const res3 = await handleRuntimeMessage({
      type: 'RECORD_PROMPT',
      data: { platform: 'aisearch', timestamp: 21000, queryText: 'what is general relativity' }
    });
    expect(res3.success).toBe(true);
    expect(res3.duplicate).toBeUndefined(); // Allowed as new query!
  });
});
