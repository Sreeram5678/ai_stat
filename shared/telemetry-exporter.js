/**
 * AIStat - Telemetry, Metrics & Report Exporter Suite
 * Provides Markdown reports, Prometheus/OpenTelemetry metrics exposition,
 * JSON-LD structured data, and filtered multi-period aggregations.
 */

import { PLATFORMS } from './constants.js';
import { analyzeWeeklyTrends, sanitizeCount } from './trend-analyzer.js';
import { calculateTotalCostAndTokens, formatCost, formatTokens } from './cost-estimator.js';

/**
 * Generates an executive Markdown productivity report from daily logs.
 */
export function exportMarkdownReport(dailyLogs = {}, options = {}) {
  const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const trends = analyzeWeeklyTrends(dailyLogs, { referenceDate: refDate });
  const costData = calculateTotalCostAndTokens(dailyLogs, 30, options.modelSelections || {}, 'low', options.subscription || 'free');

  const lines = [
    `# 📊 AIStat Analytics & Productivity Report`,
    `> **Report Generated:** ${refDate.toISOString().slice(0, 10)} | **Active Streak:** ${trends.activeStreak} days`,
    ``,
    `## ⚡ Executive Summary (Past 7 Days)`,
    `- **Total Prompts Sent:** ${trends.totalThisWeek}`,
    `- **Week-over-Week Delta:** ${trends.wowDeltaFormatted} (${trends.wowDirection})`,
    `- **Daily Average:** ${trends.dailyAverageFormatted} messages/day`,
    `- **Peak Productivity Hour:** ${trends.peakHour}`,
    `- **Estimated Tokens:** ~${trends.estimatedTokensFormatted}`,
    `- **Estimated API Value:** ${trends.estimatedComputeValueFormatted}`,
    ``,
    `## 🏆 Platform Breakdown`,
    `| Platform | Messages | Share | Color |`,
    `| :--- | :--- | :--- | :--- |`
  ];

  trends.platformsRanked.forEach(p => {
    lines.push(`| **${p.name}** | ${p.count} | ${p.percentage}% | \`${p.color}\` |`);
  });

  lines.push(
    ``,
    `## 💰 30-Day Cost & ROI Modeling`,
    `- **30-Day API Equivalent:** ${costData.formattedCost} (${costData.formattedTokens} tokens)`,
    `- **Subscription Plan:** ${costData.roi.subscriptionName} ($${costData.roi.subscriptionCost}/mo)`,
    `- **Net Monthly Savings:** ${costData.roi.formattedSavings} (ROI: ${costData.roi.formattedRoi})`,
    `- **Value Status:** \`${costData.roi.status.toUpperCase()}\``,
    ``,
    `## 📅 Daily Timeline (Recent Week)`,
    `| Date | Day | Message Count |`,
    `| :--- | :--- | :--- |`
  );

  trends.timeline.forEach(t => {
    lines.push(`| \`${t.date}\` | ${t.dayName} | **${t.messagesCount}** |`);
  });

  lines.push(
    ``,
    `---`,
    `*Generated locally & privately by [AIStat](https://github.com/Sreeram5678/ai_stat)*`
  );

  return lines.join('\n');
}

/**
 * Generates Prometheus text exposition format metrics for developer scraping.
 */
export function exportPrometheusMetrics(dailyLogs = {}, options = {}) {
  const trends = analyzeWeeklyTrends(dailyLogs, options);
  const costData = calculateTotalCostAndTokens(dailyLogs, 'all');

  const lines = [
    `# HELP aistat_messages_total Total AI prompts recorded across all platforms`,
    `# TYPE aistat_messages_total counter`
  ];

  const platformTotals = {};
  Object.values(dailyLogs).forEach(day => {
    if (day.platforms) {
      Object.entries(day.platforms).forEach(([p, c]) => {
        platformTotals[p] = (platformTotals[p] || 0) + sanitizeCount(c);
      });
    }
  });

  Object.entries(PLATFORMS).forEach(([pId, meta]) => {
    const count = platformTotals[pId] || 0;
    lines.push(`aistat_messages_total{platform="${pId}",name="${meta.name}"} ${count}`);
  });

  lines.push(
    ``,
    `# HELP aistat_streak_days Current active consecutive prompting streak in days`,
    `# TYPE aistat_streak_days gauge`,
    `aistat_streak_days ${trends.activeStreak}`,
    ``,
    `# HELP aistat_estimated_cost_usd Total estimated API equivalent cost in USD`,
    `# TYPE aistat_estimated_cost_usd gauge`,
    `aistat_estimated_cost_usd ${costData.totalCost.toFixed(6)}`,
    ``,
    `# HELP aistat_estimated_tokens_total Total estimated prompt & completion tokens`,
    `# TYPE aistat_estimated_tokens_total gauge`,
    `aistat_estimated_tokens_total ${costData.totalTokens}`
  );

  return lines.join('\n');
}

/**
 * Generates JSON-LD structured data for Schema.org analytics integration.
 */
export function exportJSONLD(dailyLogs = {}, options = {}) {
  const trends = analyzeWeeklyTrends(dailyLogs, options);
  const costData = calculateTotalCostAndTokens(dailyLogs, 30);

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AIStat Personal Usage Telemetry',
    description: 'Aggregated local AI chat prompt frequency and platform distribution statistics.',
    temporalCoverage: trends.periodLabel,
    measurementTechnique: 'Local browser network interception and input event tracking',
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'Weekly Messages',
        value: trends.totalThisWeek
      },
      {
        '@type': 'PropertyValue',
        name: 'Active Streak Days',
        value: trends.activeStreak
      },
      {
        '@type': 'PropertyValue',
        name: 'Estimated Compute Tokens',
        value: trends.estimatedTokens
      },
      {
        '@type': 'PropertyValue',
        name: 'Estimated API Value USD',
        value: trends.estimatedComputeValue
      }
    ]
  };
}

/**
 * Filter and group daily telemetry datasets with flexible intervals.
 */
export function exportFilteredDataset(dailyLogs = {}, { startDate, endDate, platforms = null, groupBy = 'day' } = {}) {
  const dates = Object.keys(dailyLogs).sort();
  const filtered = {};

  dates.forEach(d => {
    if (startDate && d < startDate) return;
    if (endDate && d > endDate) return;

    const day = dailyLogs[d];
    if (!day) return;

    let dayCount = 0;
    const cleanPlatforms = {};

    if (day.platforms) {
      Object.entries(day.platforms).forEach(([p, c]) => {
        if (!platforms || platforms.includes(p)) {
          const val = sanitizeCount(c);
          cleanPlatforms[p] = val;
          dayCount += val;
        }
      });
    }

    if (groupBy === 'day') {
      filtered[d] = {
        date: d,
        messagesCount: dayCount,
        platforms: cleanPlatforms
      };
    } else if (groupBy === 'month') {
      const monthKey = d.substring(0, 7); // YYYY-MM
      if (!filtered[monthKey]) {
        filtered[monthKey] = { period: monthKey, messagesCount: 0, platforms: {} };
      }
      filtered[monthKey].messagesCount += dayCount;
      Object.entries(cleanPlatforms).forEach(([p, val]) => {
        filtered[monthKey].platforms[p] = (filtered[monthKey].platforms[p] || 0) + val;
      });
    }
  });

  return filtered;
}
