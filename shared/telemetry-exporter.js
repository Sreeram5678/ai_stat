/**
 * AIStat - Telemetry, Metrics & Report Exporter Suite
 * Provides Markdown reports (AIStat-Report-YYYY-MM.md), Prometheus/OpenTelemetry metrics,
 * Schema.org JSON-LD, filtered aggregations, and Privacy-Safe Anonymous Benchmarks.
 */

import { PLATFORMS } from './constants.js';
import { CATEGORIES } from './topic-categorizer.js';
import { analyzeWeeklyTrends, sanitizeCount } from './trend-analyzer.js';
import {
  calculateTotalCostAndTokens,
  calculateArbitrageSavings,
  calculateSubscriptionROI,
  formatCost,
  formatTokens
} from './cost-estimator.js';
import {
  calculateTurnaroundTimes,
  calculateContextSwitching,
  buildWeeklyHeatmapMatrix
} from './velocity-analyzer.js';

/**
 * Generates an executive Markdown productivity & analytics report.
 * Formatted as AIStat-Report-YYYY-MM.md.
 * 100% Privacy-Safe: Operates strictly on aggregates and never exports raw prompts.
 *
 * @param {object} dailyLogs Map of daily telemetry records
 * @param {object} [options]
 * @returns {string} Formatted Markdown content
 */
export function exportMarkdownReport(dailyLogs = {}, options = {}) {
  const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const yearMonth = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const trends = analyzeWeeklyTrends(dailyLogs, { referenceDate: refDate });
  const costData = calculateTotalCostAndTokens(dailyLogs, 30, options.modelSelections || {}, options.reasoningEffort || 'medium', options.subscription || 'free');
  const arbData = calculateArbitrageSavings({
    baselineModel: options.baselineModel || 'claude-sonnet-5',
    alternativeModel: options.alternativeModel || 'deepseek-v3',
    monthlyPrompts: costData.totalMessages || 300,
    reasoningEffort: options.reasoningEffort || 'medium'
  });
  const heatmap = buildWeeklyHeatmapMatrix(dailyLogs);

  // Aggregate topics across period
  const topicTotals = {};
  let totalTopicPrompts = 0;
  let totalComplexitySum = 0;
  let totalComplexityCount = 0;

  Object.values(dailyLogs).forEach(day => {
    if (day.topics) {
      Object.entries(day.topics).forEach(([t, count]) => {
        const c = sanitizeCount(count);
        topicTotals[t] = (topicTotals[t] || 0) + c;
        totalTopicPrompts += c;
      });
    }
    if (day.complexityCount) {
      totalComplexitySum += day.complexitySum || 0;
      totalComplexityCount += day.complexityCount || 0;
    }
  });

  const avgComplexity = totalComplexityCount > 0 ? (totalComplexitySum / totalComplexityCount).toFixed(1) : '35.0';

  const lines = [
    `# 📊 AIStat Analytics & Productivity Report`,
    `> **Report File:** \`AIStat-Report-${yearMonth}.md\` | **Generated:** ${refDate.toISOString().slice(0, 10)} | **Active Streak:** ${trends.activeStreak} days`,
    ``,
    `## ⚡ Executive Summary (Past 7 Days)`,
    `- **Total Prompts Sent:** ${trends.totalThisWeek}`,
    `- **Week-over-Week Delta:** ${trends.wowDeltaFormatted} (${trends.wowDirection})`,
    `- **Daily Average:** ${trends.dailyAverageFormatted} messages/day`,
    `- **Average Prompt Complexity:** ${avgComplexity} / 100`,
    `- **Peak Productivity Hour:** ${trends.peakHour}:00 (${heatmap.peakWeekday} peak day)`,
    `- **Estimated Tokens:** ~${trends.estimatedTokensFormatted}`,
    `- **Estimated API Value:** ${trends.estimatedComputeValueFormatted}`,
    ``,
    `## 🧠 Topic & Semantic Distribution`,
    `| Topic / Category | Prompts | Share | Description |`,
    `| :--- | :--- | :--- | :--- |`
  ];

  if (totalTopicPrompts === 0) {
    lines.push(`| *General / Other* | ${trends.totalThisWeek} | 100% | General AI interactions |`);
  } else {
    Object.entries(CATEGORIES).forEach(([catId, meta]) => {
      const count = topicTotals[catId] || 0;
      if (count > 0) {
        const pct = ((count / totalTopicPrompts) * 100).toFixed(1);
        lines.push(`| **${meta.name}** | ${count} | ${pct}% | ${meta.description} |`);
      }
    });
  }

  lines.push(
    ``,
    `## 🏆 Platform Breakdown`,
    `| Platform | Messages | Share | Color |`,
    `| :--- | :--- | :--- | :--- |`
  );

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
    `### ⚖️ Model Arbitrage Simulation (${arbData.baseline.name} vs ${arbData.alternative.name})`,
    `- **Baseline (${arbData.baseline.name}):** ${arbData.baseline.formattedCost}/mo ($${arbData.baseline.inputPrice}/$${arbData.baseline.outputPrice} per 1M)`,
    `- **Alternative (${arbData.alternative.name}):** ${arbData.alternative.formattedCost}/mo ($${arbData.alternative.inputPrice}/$${arbData.alternative.outputPrice} per 1M)`,
    `- **Potential Monthly Arbitrage Savings:** **${arbData.formattedSavings} / mo** (${arbData.savingsPercent}% difference)`,
    `- **Projected Annual Arbitrage Savings:** **${arbData.formattedAnnualSavings} / year**`,
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
    `## 🔒 Methodology & Privacy Notes`,
    `- **Zero-Cloud Telemetry:** All metrics were computed 100% locally on-device inside your browser.`,
    `- **No Content Retention:** Prompts, conversation text, URLs, and personally identifying metadata are never stored or transmitted.`,
    `- **Deterministic Classification:** Topic categorization is derived from local heuristic pattern and keyword scoring.`,
    `- **API Cost Estimation:** Costs represent standard pay-as-you-go token rates from official provider documentation as of effective catalog dates.`,
    ``,
    `---`,
    `*Generated locally & privately by [AIStat](https://github.com/Sreeram5678/ai_stat)*`
  );

  return lines.join('\n');
}

/**
 * Generates an Anonymous Benchmark Dataset for community aggregation and research.
 * Completely strips:
 * - Exact dates & timestamps
 * - User URLs & domains
 * - Account IDs & session tokens
 * - Raw prompt text
 * Retains only normalized relative distributions and aggregate velocity metrics.
 *
 * @param {object} dailyLogs Map of daily telemetry records
 * @param {object} [options]
 * @returns {object} Anonymous benchmark payload
 */
export function exportAnonymousBenchmark(dailyLogs = {}, options = {}) {
  const allDays = Object.values(dailyLogs);
  let totalPrompts = 0;
  const platformCounts = {};
  const topicCounts = {};
  const hourCounts = new Array(24).fill(0);
  const weekdayCounts = new Array(7).fill(0); // Mon-Sun
  let activeDaysCount = 0;
  let totalComplexitySum = 0;
  let totalComplexityCount = 0;

  allDays.forEach(day => {
    const count = sanitizeCount(day.messagesCount);
    if (count > 0) {
      activeDaysCount++;
      totalPrompts += count;
    }

    if (day.platforms) {
      Object.entries(day.platforms).forEach(([p, c]) => {
        const val = sanitizeCount(c);
        platformCounts[p] = (platformCounts[p] || 0) + val;
      });
    }

    if (day.topics) {
      Object.entries(day.topics).forEach(([t, c]) => {
        const val = sanitizeCount(c);
        topicCounts[t] = (topicCounts[t] || 0) + val;
      });
    }

    if (day.hours) {
      Object.entries(day.hours).forEach(([h, c]) => {
        const hour = parseInt(h, 10);
        if (hour >= 0 && hour < 24) {
          hourCounts[hour] += sanitizeCount(c);
        }
      });
    }

    if (day.date) {
      const parts = day.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const weekdayIndex = (d.getDay() + 6) % 7; // Mon=0, Sun=6
        weekdayCounts[weekdayIndex] += count;
      }
    }

    if (day.complexityCount) {
      totalComplexitySum += day.complexitySum || 0;
      totalComplexityCount += day.complexityCount || 0;
    }
  });

  const platformPercentages = {};
  if (totalPrompts > 0) {
    Object.entries(platformCounts).forEach(([p, c]) => {
      platformPercentages[p] = Number(((c / totalPrompts) * 100).toFixed(2));
    });
  }

  const topicPercentages = {};
  const totalTopicPrompts = Object.values(topicCounts).reduce((a, b) => a + b, 0);
  if (totalTopicPrompts > 0) {
    Object.entries(topicCounts).forEach(([t, c]) => {
      topicPercentages[t] = Number(((c / totalTopicPrompts) * 100).toFixed(2));
    });
  }

  const hourlyDistributionPercentages = hourCounts.map(c =>
    totalPrompts > 0 ? Number(((c / totalPrompts) * 100).toFixed(2)) : 0
  );

  const weekdayDistributionPercentages = weekdayCounts.map(c =>
    totalPrompts > 0 ? Number(((c / totalPrompts) * 100).toFixed(2)) : 0
  );

  const avgPromptsPerActiveDay = activeDaysCount > 0
    ? Number((totalPrompts / activeDaysCount).toFixed(1))
    : 0;

  const avgComplexity = totalComplexityCount > 0
    ? Number((totalComplexitySum / totalComplexityCount).toFixed(1))
    : 35.0;

  return {
    benchmarkSchemaVersion: 1,
    exportType: 'AIStat_Anonymous_Community_Benchmark',
    exportedAtUTC: new Date().toISOString().slice(0, 10),
    privacyGuarantee: {
      zeroCloudTelemetry: true,
      rawPromptsStripped: true,
      timestampsStripped: true,
      urlsStripped: true,
      anonymityNotice: 'This benchmark contains purely normalized relative distributions and aggregates. While high-entropy fingerprints are removed, true mathematical differential privacy is not formally guaranteed.'
    },
    aggregates: {
      totalLoggedVolumeTier: totalPrompts > 1000 ? '1000+' : totalPrompts > 500 ? '500-1000' : totalPrompts > 100 ? '100-500' : '<100',
      activeDaysTier: activeDaysCount > 90 ? '90+ days' : activeDaysCount > 30 ? '30-90 days' : '<30 days',
      averagePromptsPerActiveDay: avgPromptsPerActiveDay,
      averagePromptComplexity: avgComplexity
    },
    distributions: {
      platformPercentages,
      topicPercentages,
      hourlyDistributionPercentages,
      weekdayDistributionPercentages
    }
  };
}

/**
 * Generates Prometheus text exposition format metrics.
 */
export function exportPrometheusMetrics(dailyLogs = {}, options = {}) {
  const trends = analyzeWeeklyTrends(dailyLogs, options);
  const costData = calculateTotalCostAndTokens(dailyLogs, 'all');

  const lines = [
    `# HELP aistat_messages_total Total AI prompts recorded across all platforms`,
    `# TYPE aistat_messages_total counter`
  ];

  const platformTotals = {};
  const topicTotals = {};

  Object.values(dailyLogs).forEach(day => {
    if (day.platforms) {
      Object.entries(day.platforms).forEach(([p, c]) => {
        platformTotals[p] = (platformTotals[p] || 0) + sanitizeCount(c);
      });
    }
    if (day.topics) {
      Object.entries(day.topics).forEach(([t, c]) => {
        topicTotals[t] = (topicTotals[t] || 0) + sanitizeCount(c);
      });
    }
  });

  Object.entries(PLATFORMS).forEach(([pId, meta]) => {
    const count = platformTotals[pId] || 0;
    lines.push(`aistat_messages_total{platform="${pId}",name="${meta.name}"} ${count}`);
  });

  lines.push(
    ``,
    `# HELP aistat_topic_prompts_total Total AI prompts categorized by local topic`,
    `# TYPE aistat_topic_prompts_total counter`
  );

  Object.entries(CATEGORIES).forEach(([catId, meta]) => {
    const count = topicTotals[catId] || 0;
    lines.push(`aistat_topic_prompts_total{topic="${catId}",name="${meta.name}"} ${count}`);
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
    description: 'Aggregated local AI chat prompt frequency, platform distribution, and topic statistics.',
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
export function exportFilteredDataset(dailyLogs = {}, { startDate, endDate, platforms = null, topics = null, groupBy = 'day' } = {}) {
  const dates = Object.keys(dailyLogs).sort();
  const filtered = {};

  dates.forEach(d => {
    if (startDate && d < startDate) return;
    if (endDate && d > endDate) return;

    const day = dailyLogs[d];
    if (!day) return;

    let dayCount = 0;
    const cleanPlatforms = {};
    const cleanTopics = {};

    if (day.platforms) {
      Object.entries(day.platforms).forEach(([p, c]) => {
        if (!platforms || platforms.includes(p)) {
          const val = sanitizeCount(c);
          cleanPlatforms[p] = val;
          dayCount += val;
        }
      });
    }

    if (day.topics) {
      Object.entries(day.topics).forEach(([t, c]) => {
        if (!topics || topics.includes(t)) {
          const val = sanitizeCount(c);
          cleanTopics[t] = val;
        }
      });
    }

    if (groupBy === 'day') {
      filtered[d] = {
        date: d,
        messagesCount: dayCount,
        platforms: cleanPlatforms,
        topics: cleanTopics,
        hours: day.hours || {}
      };
    } else if (groupBy === 'month') {
      const monthKey = d.substring(0, 7); // YYYY-MM
      if (!filtered[monthKey]) {
        filtered[monthKey] = { period: monthKey, messagesCount: 0, platforms: {}, topics: {} };
      }
      filtered[monthKey].messagesCount += dayCount;
      Object.entries(cleanPlatforms).forEach(([p, val]) => {
        filtered[monthKey].platforms[p] = (filtered[monthKey].platforms[p] || 0) + val;
      });
      Object.entries(cleanTopics).forEach(([t, val]) => {
        filtered[monthKey].topics[t] = (filtered[monthKey].topics[t] || 0) + val;
      });
    }
  });

  return filtered;
}

export default {
  exportMarkdownReport,
  exportAnonymousBenchmark,
  exportPrometheusMetrics,
  exportJSONLD,
  exportFilteredDataset
};
