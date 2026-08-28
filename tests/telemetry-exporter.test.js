import { describe, it, expect } from 'vitest';
import {
  exportMarkdownReport,
  exportPrometheusMetrics,
  exportJSONLD,
  exportFilteredDataset
} from '../shared/telemetry-exporter.js';

describe('telemetry-exporter suite', () => {
  const sampleLogs = {
    '2026-08-20': { date: '2026-08-20', messagesCount: 10, platforms: { chatgpt: 6, claude: 4 } },
    '2026-08-21': { date: '2026-08-21', messagesCount: 15, platforms: { chatgpt: 5, gemini: 10 } },
    '2026-08-22': { date: '2026-08-22', messagesCount: 20, platforms: { claude: 20 } },
    '2026-08-23': { date: '2026-08-23', messagesCount: 25, platforms: { deepseek: 25 } },
    '2026-08-24': { date: '2026-08-24', messagesCount: 30, platforms: { perplexity: 30 } },
    '2026-08-25': { date: '2026-08-25', messagesCount: 35, platforms: { aisearch: 35 } },
    '2026-08-26': { date: '2026-08-26', messagesCount: 40, platforms: { chatgpt: 40 } }
  };

  describe('exportMarkdownReport', () => {
    it('generates a full markdown report with tables, summary, and ROI modeling', () => {
      const md = exportMarkdownReport(sampleLogs, { referenceDate: '2026-08-26' });

      expect(md).toContain('# 📊 AIStat Analytics & Productivity Report');
      expect(md).toContain('## ⚡ Executive Summary (Past 7 Days)');
      expect(md).toContain('## 🏆 Platform Breakdown');
      expect(md).toContain('## 💰 30-Day Cost & ROI Modeling');
      expect(md).toContain('## 📅 Daily Timeline (Recent Week)');
      expect(md).toContain('| **ChatGPT** |');
      expect(md).toContain('| `2026-08-26` |');
      expect(md).toContain('*Generated locally & privately by [AIStat]');
    });

    it('handles empty logs gracefully', () => {
      const md = exportMarkdownReport({}, { referenceDate: '2026-08-26' });
      expect(md).toContain('Total Prompts Sent:** 0');
      expect(md).toContain('Active Streak:** 0 days');
    });
  });

  describe('exportPrometheusMetrics', () => {
    it('outputs standard Prometheus metric blocks', () => {
      const metrics = exportPrometheusMetrics(sampleLogs, { referenceDate: '2026-08-26' });

      expect(metrics).toContain('# HELP aistat_messages_total');
      expect(metrics).toContain('# TYPE aistat_messages_total counter');
      expect(metrics).toContain('aistat_messages_total{platform="chatgpt",name="ChatGPT"} 51');
      expect(metrics).toContain('aistat_messages_total{platform="claude",name="Claude"} 24');
      expect(metrics).toContain('aistat_streak_days 7');
      expect(metrics).toContain('aistat_estimated_cost_usd');
      expect(metrics).toContain('aistat_estimated_tokens_total');
    });
  });

  describe('exportJSONLD', () => {
    it('generates Schema.org compliant Dataset object', () => {
      const jsonld = exportJSONLD(sampleLogs, { referenceDate: '2026-08-26' });

      expect(jsonld['@context']).toBe('https://schema.org');
      expect(jsonld['@type']).toBe('Dataset');
      expect(jsonld.name).toBe('AIStat Personal Usage Telemetry');
      expect(Array.isArray(jsonld.variableMeasured)).toBe(true);
      expect(jsonld.variableMeasured.find(v => v.name === 'Weekly Messages').value).toBe(175);
    });
  });

  describe('exportFilteredDataset', () => {
    it('filters by date range', () => {
      const result = exportFilteredDataset(sampleLogs, {
        startDate: '2026-08-21',
        endDate: '2026-08-23'
      });

      expect(Object.keys(result)).toEqual(['2026-08-21', '2026-08-22', '2026-08-23']);
      expect(result['2026-08-20']).toBeUndefined();
      expect(result['2026-08-24']).toBeUndefined();
    });

    it('filters by platforms', () => {
      const result = exportFilteredDataset(sampleLogs, {
        platforms: ['chatgpt']
      });

      expect(result['2026-08-20'].messagesCount).toBe(6);
      expect(result['2026-08-20'].platforms.claude).toBeUndefined();
      expect(result['2026-08-22'].messagesCount).toBe(0);
    });

    it('groups data by month', () => {
      const multiMonthLogs = {
        '2026-07-31': { date: '2026-07-31', messagesCount: 10, platforms: { chatgpt: 10 } },
        '2026-08-01': { date: '2026-08-01', messagesCount: 20, platforms: { chatgpt: 20 } },
        '2026-08-02': { date: '2026-08-02', messagesCount: 30, platforms: { claude: 30 } }
      };

      const result = exportFilteredDataset(multiMonthLogs, { groupBy: 'month' });
      expect(result['2026-07'].messagesCount).toBe(10);
      expect(result['2026-08'].messagesCount).toBe(50);
      expect(result['2026-08'].platforms.chatgpt).toBe(20);
      expect(result['2026-08'].platforms.claude).toBe(30);
    });
  });
});
