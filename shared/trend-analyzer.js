/**
 * AIStat - Weekly Trends & Analytics Engine
 * Provides statistical analysis, week-over-week deltas, peak productivity detection,
 * platform distribution ranking, and token valuation.
 */
import { PLATFORMS } from './constants.js';

/**
 * Format a Date object into YYYY-MM-DD string
 * @param {Date} d
 * @returns {string}
 */
export function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an integer count safely
 * @param {*} val
 * @returns {number}
 */
export function sanitizeCount(val) {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.max(0, Math.floor(val));
  }
  if (!val) return 0;
  if (typeof val === 'object') {
    return sanitizeCount(val.messages || val.messagesCount || val.count || 0);
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/\[object\s*Object\]/gi, '').trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
}

/**
 * Calculate week-over-week percentage change
 * @param {number} thisWeekCount
 * @param {number} lastWeekCount
 * @returns {{ delta: number, formatted: string, direction: 'up'|'down'|'neutral' }}
 */
export function calculateWoWChange(thisWeekCount, lastWeekCount) {
  const current = sanitizeCount(thisWeekCount);
  const previous = sanitizeCount(lastWeekCount);

  if (previous === 0) {
    if (current === 0) {
      return { delta: 0, formatted: '0%', direction: 'neutral' };
    }
    return { delta: 100, formatted: '+100%', direction: 'up' };
  }

  const rawDelta = ((current - previous) / previous) * 100;
  const delta = Math.round(rawDelta);

  if (delta > 0) {
    return { delta, formatted: `+${delta}%`, direction: 'up' };
  } else if (delta < 0) {
    return { delta, formatted: `${delta}%`, direction: 'down' };
  } else {
    return { delta: 0, formatted: '0%', direction: 'neutral' };
  }
}

/**
 * Convert 24-hour integer into readable 12-hour / standard time strings
 * @param {number} hour
 * @returns {{ standard: string, label: string }}
 */
export function formatHour(hour) {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const standard = `${String(h).padStart(2, '0')}:00`;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const label = `${displayHour}:00 ${period}`;
  return { standard, label };
}

/**
 * Identify peak activity hour from daily logs
 * @param {Object} dailyLogs
 * @param {string[]} [filterDates] - Optional array of date keys to restrict analysis
 * @returns {{ hour: number, formatted: string, label: string, count: number }}
 */
export function findPeakHour(dailyLogs = {}, filterDates = null) {
  const hourTotals = new Array(24).fill(0);
  let totalEntries = 0;

  const targetDates = filterDates || Object.keys(dailyLogs);

  targetDates.forEach(dateKey => {
    const day = dailyLogs[dateKey];
    if (day && day.hours && typeof day.hours === 'object') {
      Object.entries(day.hours).forEach(([hStr, count]) => {
        const h = parseInt(hStr, 10);
        if (!isNaN(h) && h >= 0 && h < 24) {
          const val = sanitizeCount(count);
          hourTotals[h] += val;
          totalEntries += val;
        }
      });
    }
  });

  // If no hours in targetDates, check all dailyLogs as fallback
  if (totalEntries === 0 && filterDates && Object.keys(dailyLogs).length > 0) {
    Object.values(dailyLogs).forEach(day => {
      if (day && day.hours && typeof day.hours === 'object') {
        Object.entries(day.hours).forEach(([hStr, count]) => {
          const h = parseInt(hStr, 10);
          if (!isNaN(h) && h >= 0 && h < 24) {
            const val = sanitizeCount(count);
            hourTotals[h] += val;
            totalEntries += val;
          }
        });
      }
    });
  }

  let peakHour = 14; // Default fallback to 14:00 (2 PM)
  let maxCount = 0;

  for (let i = 0; i < 24; i++) {
    if (hourTotals[i] > maxCount) {
      maxCount = hourTotals[i];
      peakHour = i;
    }
  }

  const { standard, label } = formatHour(peakHour);
  return {
    hour: peakHour,
    formatted: standard,
    label,
    count: maxCount
  };
}

/**
 * Calculate active consecutive day streak up to reference date
 * @param {Object} dailyLogs
 * @param {Date} referenceDate
 * @returns {number}
 */
export function calculateStreak(dailyLogs = {}, referenceDate = new Date()) {
  let streak = 0;
  const checkDate = new Date(referenceDate);
  const todayKey = formatDateKey(checkDate);

  while (true) {
    const key = formatDateKey(checkDate);
    const day = dailyLogs[key];
    const count = day ? sanitizeCount(day.messagesCount) : 0;

    if (count > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If today has no messages yet, check yesterday to continue streak
      if (key === todayKey && streak === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayKey = formatDateKey(checkDate);
        const yDay = dailyLogs[yesterdayKey];
        if (yDay && sanitizeCount(yDay.messagesCount) > 0) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  return streak;
}

/**
 * Analyze weekly trends and statistics from dailyLogs
 * @param {Object} dailyLogs - Map of date keys (YYYY-MM-DD) to day logs
 * @param {Object} [options]
 * @param {Date|string} [options.referenceDate] - Base date for calculations (defaults to today)
 * @param {number} [options.tokenMultiplier=1200] - Estimated tokens per prompt + response interaction
 * @param {number} [options.costPer1kTokens=0.002] - Estimated compute cost per 1k tokens ($)
 * @returns {Object} Comprehensive weekly trend insights
 */
export function analyzeWeeklyTrends(dailyLogs = {}, options = {}) {
  const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const tokenMultiplier = options.tokenMultiplier || 1200;
  const costPer1kTokens = options.costPer1kTokens || 0.002;

  // 1. Build date keys for This Week (past 7 days: Day 0 to Day 6)
  const thisWeekDates = [];
  const thisWeekTimeline = [];
  let totalThisWeek = 0;
  const thisWeekPlatformTotals = {};
  let daysActiveThisWeek = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    thisWeekDates.push(key);

    const dayData = dailyLogs[key] || { date: key, messagesCount: 0, platforms: {} };
    const count = sanitizeCount(dayData.messagesCount);
    if (count > 0) daysActiveThisWeek++;

    thisWeekTimeline.push({
      date: key,
      dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
      messagesCount: count
    });

    totalThisWeek += count;

    if (dayData.platforms && typeof dayData.platforms === 'object') {
      Object.entries(dayData.platforms).forEach(([pId, pCount]) => {
        thisWeekPlatformTotals[pId] = (thisWeekPlatformTotals[pId] || 0) + sanitizeCount(pCount);
      });
    }
  }

  // 2. Build date keys for Last Week (preceding 7 days: Day 7 to Day 13)
  const lastWeekDates = [];
  let totalLastWeek = 0;
  const lastWeekPlatformTotals = {};

  for (let i = 13; i >= 7; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    lastWeekDates.push(key);

    const dayData = dailyLogs[key] || { date: key, messagesCount: 0, platforms: {} };
    const count = sanitizeCount(dayData.messagesCount);
    totalLastWeek += count;

    if (dayData.platforms && typeof dayData.platforms === 'object') {
      Object.entries(dayData.platforms).forEach(([pId, pCount]) => {
        lastWeekPlatformTotals[pId] = (lastWeekPlatformTotals[pId] || 0) + sanitizeCount(pCount);
      });
    }
  }

  // 3. Week-over-Week Calculation
  const wow = calculateWoWChange(totalThisWeek, totalLastWeek);

  // 4. Daily Average
  const dailyAverageNum = totalThisWeek > 0 ? parseFloat((totalThisWeek / 7).toFixed(1)) : 0;
  const dailyAverageFormatted = dailyAverageNum.toFixed(1);

  // 5. Peak Productivity Hour
  const peakHourInfo = findPeakHour(dailyLogs, thisWeekDates);

  // 6. Platform Rankings & Distribution
  // Use this week's totals, or fallback to all-time if this week is empty
  let activePlatformTotals = thisWeekPlatformTotals;
  let totalForPlatforms = totalThisWeek;

  if (totalThisWeek === 0) {
    const allTotals = {};
    Object.values(dailyLogs).forEach(day => {
      if (day.platforms) {
        Object.entries(day.platforms).forEach(([p, c]) => {
          allTotals[p] = (allTotals[p] || 0) + sanitizeCount(c);
        });
      }
    });
    const allSum = Object.values(allTotals).reduce((a, b) => a + b, 0);
    if (allSum > 0) {
      activePlatformTotals = allTotals;
      totalForPlatforms = allSum;
    }
  }

  const platformsRanked = Object.entries(PLATFORMS)
    .map(([id, meta]) => {
      const count = activePlatformTotals[id] || 0;
      const percentage = totalForPlatforms > 0 ? Math.round((count / totalForPlatforms) * 100) : 0;
      return {
        id,
        name: meta.name,
        color: meta.color,
        bgLight: meta.bgLight,
        count,
        percentage
      };
    })
    .sort((a, b) => b.count - a.count);

  const topPlatform = platformsRanked[0]?.count > 0
    ? platformsRanked[0]
    : { id: 'none', name: 'None', color: '#6366f1', count: 0, percentage: 0 };

  // 7. Active Streak
  const streak = calculateStreak(dailyLogs, refDate);

  // 8. Estimated Tokens & Compute Value
  const estimatedTokens = totalThisWeek * tokenMultiplier;
  let estimatedTokensFormatted = '0';
  if (estimatedTokens >= 1000000) {
    estimatedTokensFormatted = `${(estimatedTokens / 1000000).toFixed(1)}M`;
  } else if (estimatedTokens >= 1000) {
    estimatedTokensFormatted = `${(estimatedTokens / 1000).toFixed(1)}k`;
  } else {
    estimatedTokensFormatted = String(estimatedTokens);
  }

  const estimatedComputeValue = (estimatedTokens / 1000) * costPer1kTokens;
  const estimatedComputeValueFormatted = `$${estimatedComputeValue.toFixed(2)}`;

  // Period label e.g., "Aug 22 - Aug 28"
  const startD = new Date(refDate);
  startD.setDate(startD.getDate() - 6);
  const periodLabel = `${startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${refDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return {
    periodLabel,
    totalThisWeek,
    totalLastWeek,
    wowDeltaPct: wow.delta,
    wowDeltaFormatted: wow.formatted,
    wowDirection: wow.direction,
    dailyAverage: dailyAverageNum,
    dailyAverageFormatted,
    daysActiveThisWeek,
    peakHour: peakHourInfo.formatted,
    peakHourInfo,
    topPlatform,
    platformsRanked,
    activeStreak: streak,
    estimatedTokens,
    estimatedTokensFormatted,
    estimatedComputeValue,
    estimatedComputeValueFormatted,
    timeline: thisWeekTimeline
  };
}
