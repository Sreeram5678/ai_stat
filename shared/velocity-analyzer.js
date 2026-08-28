/**
 * AIStat - Productivity, Velocity & Interaction Intensity Analyzer
 * Analyzes prompt velocity, turnaround time distributions, AI multi-homing context switches,
 * deep work vs quick query ratios, and 7x24 interaction intensity heatmaps.
 */

/**
 * Calculates prompts per active hour and velocity metrics.
 * An active hour is defined as an hour window in which at least 1 prompt was recorded.
 *
 * @param {Array<{ timestamp: number, platform?: string }>} events List of prompt events
 * @param {object} [options] Configuration options
 * @param {number} [options.windowHours] Optional fixed window in hours (default: derived from active hours)
 * @returns {object} Velocity summary metrics
 */
export function calculatePromptVelocity(events = [], options = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      totalPrompts: 0,
      activeHours: 0,
      promptsPerActiveHour: 0,
      promptsPerMinuteActive: 0,
      maxVelocityInHour: 0,
      peakHourKey: null
    };
  }

  const hourBuckets = {};

  events.forEach(evt => {
    const ts = typeof evt === 'number' ? evt : (evt?.timestamp || Date.now());
    if (isNaN(ts) || ts <= 0) return;

    const d = new Date(ts);
    const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}`;
    hourBuckets[hourKey] = (hourBuckets[hourKey] || 0) + 1;
  });

  const activeHours = Object.keys(hourBuckets).length;
  const totalPrompts = events.length;

  if (activeHours === 0) {
    return {
      totalPrompts: 0,
      activeHours: 0,
      promptsPerActiveHour: 0,
      promptsPerMinuteActive: 0,
      maxVelocityInHour: 0,
      peakHourKey: null
    };
  }

  const effectiveHours = options.windowHours && options.windowHours > 0 ? options.windowHours : activeHours;
  const promptsPerActiveHour = Number((totalPrompts / effectiveHours).toFixed(2));
  const promptsPerMinuteActive = Number((totalPrompts / (effectiveHours * 60)).toFixed(3));

  let maxVelocityInHour = 0;
  let peakHourKey = null;

  Object.entries(hourBuckets).forEach(([hKey, count]) => {
    if (count > maxVelocityInHour) {
      maxVelocityInHour = count;
      peakHourKey = hKey;
    }
  });

  return {
    totalPrompts,
    activeHours,
    promptsPerActiveHour,
    promptsPerMinuteActive,
    maxVelocityInHour,
    peakHourKey
  };
}

/**
 * Calculates inter-prompt turnaround time distribution metrics (delta_i = timestamp_i - timestamp_(i-1)).
 * Safely handles duplicate timestamps, negative intervals, clock shifts, and out-of-order logs.
 *
 * @param {Array<number|{ timestamp: number }>} timestamps Array of epoch millisecond timestamps or objects
 * @param {object} [options]
 * @param {number} [options.maxGapMs=1800000] Gaps larger than 30 mins are considered separate sessions and excluded from inter-prompt turnaround
 * @returns {object} Turnaround metrics in seconds
 */
export function calculateTurnaroundTimes(timestamps = [], options = {}) {
  const maxGapMs = options.maxGapMs || 30 * 60 * 1000; // 30 mins

  if (!Array.isArray(timestamps) || timestamps.length < 2) {
    return {
      count: 0,
      meanSeconds: 0,
      medianSeconds: 0,
      p25Seconds: 0,
      p75Seconds: 0,
      p90Seconds: 0,
      p95Seconds: 0,
      minSeconds: 0,
      maxSeconds: 0,
      histogram: {
        under30s: 0,
        under1m: 0,
        under3m: 0,
        under5m: 0,
        under15m: 0,
        over15m: 0
      }
    };
  }

  // Extract, sanitize, and sort timestamps chronologically
  const sanitized = timestamps
    .map(t => (typeof t === 'object' && t !== null ? t.timestamp : t))
    .filter(t => typeof t === 'number' && !isNaN(t) && t > 0)
    .sort((a, b) => a - b);

  if (sanitized.length < 2) {
    return {
      count: 0,
      meanSeconds: 0,
      medianSeconds: 0,
      p25Seconds: 0,
      p75Seconds: 0,
      p90Seconds: 0,
      p95Seconds: 0,
      minSeconds: 0,
      maxSeconds: 0,
      histogram: { under30s: 0, under1m: 0, under3m: 0, under5m: 0, under15m: 0, over15m: 0 }
    };
  }

  const deltasSeconds = [];
  const histogram = {
    under30s: 0,
    under1m: 0,
    under3m: 0,
    under5m: 0,
    under15m: 0,
    over15m: 0
  };

  for (let i = 1; i < sanitized.length; i++) {
    const diffMs = sanitized[i] - sanitized[i - 1];

    // Filter out invalid clock reversals or gaps exceeding session boundary
    if (diffMs >= 0 && diffMs <= maxGapMs) {
      const diffSec = Number((diffMs / 1000).toFixed(1));
      deltasSeconds.push(diffSec);

      if (diffSec < 30) histogram.under30s++;
      else if (diffSec < 60) histogram.under1m++;
      else if (diffSec < 180) histogram.under3m++;
      else if (diffSec < 300) histogram.under5m++;
      else if (diffSec < 900) histogram.under15m++;
      else histogram.over15m++;
    }
  }

  if (deltasSeconds.length === 0) {
    return {
      count: 0,
      meanSeconds: 0,
      medianSeconds: 0,
      p25Seconds: 0,
      p75Seconds: 0,
      p90Seconds: 0,
      p95Seconds: 0,
      minSeconds: 0,
      maxSeconds: 0,
      histogram
    };
  }

  // Calculate statistics
  deltasSeconds.sort((a, b) => a - b);
  const count = deltasSeconds.length;
  const sum = deltasSeconds.reduce((acc, val) => acc + val, 0);
  const meanSeconds = Number((sum / count).toFixed(1));
  const medianSeconds = getPercentile(deltasSeconds, 50);
  const p25Seconds = getPercentile(deltasSeconds, 25);
  const p75Seconds = getPercentile(deltasSeconds, 75);
  const p90Seconds = getPercentile(deltasSeconds, 90);
  const p95Seconds = getPercentile(deltasSeconds, 95);
  const minSeconds = deltasSeconds[0];
  const maxSeconds = deltasSeconds[count - 1];

  return {
    count,
    meanSeconds,
    medianSeconds,
    p25Seconds,
    p75Seconds,
    p90Seconds,
    p95Seconds,
    minSeconds,
    maxSeconds,
    histogram
  };
}

function getPercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sortedArray[lower];
  return Number((sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight).toFixed(1));
}

/**
 * Calculates Context Switching / AI Multi-Homing Index.
 * Measures how frequently a user transitions across platforms or models within active workflows.
 *
 * @param {Array<{ timestamp: number, platform?: string, model?: string }>} events
 * @param {object} [options]
 * @param {number} [options.workflowWindowMs=1800000] Max interval between consecutive prompts to be considered in same workflow (30m)
 * @returns {object} Context switching metrics
 */
export function calculateContextSwitching(events = [], options = {}) {
  const workflowWindowMs = options.workflowWindowMs || 30 * 60 * 1000;

  if (!Array.isArray(events) || events.length < 2) {
    return {
      eligibleTransitions: 0,
      platformSwitches: 0,
      modelSwitches: 0,
      contextSwitchRate: 0,
      multiHomingScore: 0,
      distinctPlatformsUsed: Array.isArray(events) && events.length === 1 ? 1 : 0,
      transitionsBreakdown: []
    };
  }

  const sorted = [...events]
    .filter(e => e && typeof e === 'object')
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let eligibleTransitions = 0;
  let platformSwitches = 0;
  let modelSwitches = 0;
  const distinctPlatforms = new Set();
  const transitionsBreakdown = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const prevTs = prev.timestamp || 0;
    const currTs = curr.timestamp || 0;
    const gap = currTs - prevTs;

    if (prev.platform) distinctPlatforms.add(prev.platform);
    if (curr.platform) distinctPlatforms.add(curr.platform);

    if (gap >= 0 && gap <= workflowWindowMs) {
      eligibleTransitions++;
      const isPlatformSwitch = prev.platform && curr.platform && prev.platform !== curr.platform;
      const isModelSwitch = (prev.model && curr.model && prev.model !== curr.model) || isPlatformSwitch;

      if (isPlatformSwitch) platformSwitches++;
      if (isModelSwitch) modelSwitches++;

      transitionsBreakdown.push({
        fromPlatform: prev.platform || 'unknown',
        toPlatform: curr.platform || 'unknown',
        fromModel: prev.model || 'default',
        toModel: curr.model || 'default',
        gapSeconds: Math.round(gap / 1000),
        isPlatformSwitch,
        isModelSwitch
      });
    }
  }

  const contextSwitchRate = eligibleTransitions > 0
    ? Number((platformSwitches / eligibleTransitions).toFixed(3))
    : 0;

  // Multi-homing score: Combines diversity of platforms used with frequency of active cross-platform switching
  // Range: 0.0 (strictly single tool) to 1.0 (heavy parallel multi-homing)
  const platformDiversityFactor = Math.min(1.0, (distinctPlatforms.size - 1) / 3);
  const multiHomingScore = Number(Math.min(1.0, contextSwitchRate * 0.6 + platformDiversityFactor * 0.4).toFixed(2));

  return {
    eligibleTransitions,
    platformSwitches,
    modelSwitches,
    contextSwitchRate,
    multiHomingScore,
    distinctPlatformsUsed: distinctPlatforms.size,
    transitionsBreakdown
  };
}

/**
 * Categorizes and aggregates workstyles into Deep Work vs Quick Query.
 *
 * Definitions:
 * - Deep Work: Session duration >= 10 mins AND >= 5 prompts with sustained single/focused platform engagement.
 * - Quick Query: Session duration <= 3 mins AND <= 2 prompts.
 * - Iterative / Multi-tasking: intermediate working patterns.
 *
 * @param {Array<object>} sessions Array of clustered session objects
 * @returns {object} Workstyle ratios with safe zero-denominator behavior
 */
export function calculateWorkstyleRatios(sessions = []) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      totalSessions: 0,
      deepWorkCount: 0,
      quickQueryCount: 0,
      iterativeCount: 0,
      deepWorkRatio: 0,
      quickQueryRatio: 0,
      iterativeRatio: 0,
      dominantStyle: 'none'
    };
  }

  let deepWorkCount = 0;
  let quickQueryCount = 0;
  let iterativeCount = 0;

  sessions.forEach(s => {
    const durationMins = s.durationMinutes || (s.durationMs ? s.durationMs / 60000 : 0);
    const count = s.promptsCount || 1;
    const style = s.workstyle || '';

    if (style === 'deep_work' || (durationMins >= 10 && count >= 5)) {
      deepWorkCount++;
    } else if (durationMins <= 3 && count <= 2) {
      quickQueryCount++;
    } else {
      iterativeCount++;
    }
  });

  const total = sessions.length;
  const deepWorkRatio = Number((deepWorkCount / total).toFixed(2));
  const quickQueryRatio = Number((quickQueryCount / total).toFixed(2));
  const iterativeRatio = Number((iterativeCount / total).toFixed(2));

  let dominantStyle = 'iterative';
  if (deepWorkCount >= quickQueryCount && deepWorkCount >= iterativeCount) dominantStyle = 'deep_work';
  else if (quickQueryCount > deepWorkCount && quickQueryCount >= iterativeCount) dominantStyle = 'quick_query';

  return {
    totalSessions: total,
    deepWorkCount,
    quickQueryCount,
    iterativeCount,
    deepWorkRatio,
    quickQueryRatio,
    iterativeRatio,
    dominantStyle
  };
}

/**
 * Builds a 7x24 weekly interaction intensity heatmap matrix from daily logs.
 * Weekdays: 0 (Monday) through 6 (Sunday), Hours: 0 through 23.
 *
 * @param {object} dailyLogs Map of daily telemetry records
 * @returns {object} 7x24 matrix, peak metrics, and normalized cells
 */
export function buildWeeklyHeatmapMatrix(dailyLogs = {}) {
  // 7 days x 24 hours (0 = Mon, 1 = Tue, ..., 6 = Sun)
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const weekdayTotals = new Array(7).fill(0);
  const hourTotals = new Array(24).fill(0);
  let totalPrompts = 0;
  let maxCellCount = 0;
  let peakCell = { weekday: 0, hour: 0, count: 0 };

  if (dailyLogs && typeof dailyLogs === 'object') {
    Object.entries(dailyLogs).forEach(([dateKey, day]) => {
      if (!day) return;
      // Parse UTC date YYYY-MM-DD
      const parts = dateKey.split('-');
      if (parts.length !== 3) return;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const dateNum = parseInt(parts[2], 10);
      const d = new Date(year, month, dateNum);

      // Convert JS Sunday=0 to Monday=0 (Mon=0, Tue=1, ..., Sun=6)
      const jsDay = d.getDay();
      const weekdayIndex = (jsDay + 6) % 7;

      if (day.hours && typeof day.hours === 'object') {
        Object.entries(day.hours).forEach(([h, count]) => {
          const hour = parseInt(h, 10);
          const val = typeof count === 'number' && !isNaN(count) ? Math.max(0, Math.floor(count)) : 0;
          if (hour >= 0 && hour < 24 && val > 0) {
            matrix[weekdayIndex][hour] += val;
            weekdayTotals[weekdayIndex] += val;
            hourTotals[hour] += val;
            totalPrompts += val;

            if (matrix[weekdayIndex][hour] > maxCellCount) {
              maxCellCount = matrix[weekdayIndex][hour];
              peakCell = { weekday: weekdayIndex, hour, count: maxCellCount };
            }
          }
        });
      }
    });
  }

  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const peakWeekdayIndex = weekdayTotals.indexOf(Math.max(0, ...weekdayTotals));
  const peakHour = hourTotals.indexOf(Math.max(0, ...hourTotals));

  return {
    matrix,
    weekdayTotals,
    hourTotals,
    totalPrompts,
    maxCellCount,
    peakWeekday: weekdayNames[peakWeekdayIndex] || 'Mon',
    peakWeekdayIndex,
    peakHour,
    peakCell: {
      ...peakCell,
      weekdayName: weekdayNames[peakCell.weekday] || 'Mon'
    }
  };
}

export default {
  calculatePromptVelocity,
  calculateTurnaroundTimes,
  calculateContextSwitching,
  calculateWorkstyleRatios,
  buildWeeklyHeatmapMatrix
};
