/**
 * AIStat - Usage Goals, Budgeting & Pacing Manager
 * Allows setting daily/weekly prompt targets, budget caps, and progress pacing.
 */

import { sanitizeCount } from './trend-analyzer.js';

export const DEFAULT_GOALS = {
  enabled: false,
  dailyTarget: 30,
  dailyMaxCap: 100,
  weeklyTarget: 150,
  alertThresholdPercent: 80,
  platformBudgets: {} // e.g. { chatgpt: 20, claude: 20 }
};

/**
 * Calculates current progress against configured goals and pacing.
 */
export function calculateGoalProgress(dailyLogs = {}, goals = DEFAULT_GOALS, referenceDate = new Date()) {
  const cfg = { ...DEFAULT_GOALS, ...(goals || {}) };
  const d = new Date(referenceDate);
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayData = dailyLogs[todayKey] || { messagesCount: 0, platforms: {} };
  const todayCount = sanitizeCount(todayData.messagesCount);

  // Past 7 days sum (including today)
  let weekCount = 0;
  for (let i = 6; i >= 0; i--) {
    const cur = new Date(d);
    cur.setDate(cur.getDate() - i);
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const day = dailyLogs[key];
    if (day) weekCount += sanitizeCount(day.messagesCount);
  }

  // Daily progress
  const dailyTarget = Math.max(1, cfg.dailyTarget || 30);
  const dailyMaxCap = cfg.dailyMaxCap ? Math.max(dailyTarget, cfg.dailyMaxCap) : null;
  const dailyPercent = Math.round((todayCount / dailyTarget) * 100);

  let dailyStatus = 'below_target';
  if (dailyMaxCap && todayCount >= dailyMaxCap) {
    dailyStatus = 'cap_exceeded';
  } else if (dailyMaxCap && todayCount >= dailyMaxCap * (cfg.alertThresholdPercent / 100)) {
    dailyStatus = 'near_cap';
  } else if (todayCount >= dailyTarget) {
    dailyStatus = 'target_reached';
  } else if (todayCount >= dailyTarget * (cfg.alertThresholdPercent / 100)) {
    dailyStatus = 'near_target';
  }

  // Weekly progress
  const weeklyTarget = Math.max(1, cfg.weeklyTarget || 150);
  const weeklyPercent = Math.round((weekCount / weeklyTarget) * 100);

  let weeklyStatus = 'below_target';
  if (weekCount >= weeklyTarget) {
    weeklyStatus = 'target_reached';
  } else if (weekCount >= weeklyTarget * (cfg.alertThresholdPercent / 100)) {
    weeklyStatus = 'near_target';
  }

  // Intraday pacing (expected % of day elapsed vs % of daily target used)
  const currentHour = d.getHours() + (d.getMinutes() / 60);
  const dayProgressRatio = Math.min(1, Math.max(0.01, currentHour / 24));
  const expectedTodayUsage = dailyTarget * dayProgressRatio;
  const pacingStatus = todayCount > expectedTodayUsage * 1.25
    ? 'ahead_of_pace'
    : todayCount < expectedTodayUsage * 0.75
      ? 'behind_pace'
      : 'on_pace';

  return {
    enabled: !!cfg.enabled,
    today: {
      current: todayCount,
      target: dailyTarget,
      maxCap: dailyMaxCap,
      percent: dailyPercent,
      remaining: Math.max(0, dailyTarget - todayCount),
      status: dailyStatus
    },
    week: {
      current: weekCount,
      target: weeklyTarget,
      percent: weeklyPercent,
      remaining: Math.max(0, weeklyTarget - weekCount),
      status: weeklyStatus
    },
    pacing: {
      hour: Math.floor(currentHour),
      dayElapsedPercent: Math.round(dayProgressRatio * 100),
      expectedMessages: Math.round(expectedTodayUsage),
      status: pacingStatus
    }
  };
}

/**
 * Checks if a prompt increment crosses an alert threshold.
 */
export function checkGoalAlert(currentCount, goals = DEFAULT_GOALS) {
  if (!goals || !goals.enabled) return null;

  const count = sanitizeCount(currentCount);
  const target = goals.dailyTarget || 30;
  const cap = goals.dailyMaxCap || 100;
  const threshold = goals.alertThresholdPercent || 80;

  if (cap && count >= cap) {
    return {
      type: 'cap_exceeded',
      severity: 'critical',
      message: `Daily message cap reached (${count}/${cap}). Consider taking a break!`,
      count,
      limit: cap
    };
  }

  if (cap && count >= Math.floor(cap * (threshold / 100))) {
    return {
      type: 'near_cap',
      severity: 'warning',
      message: `Approaching daily message cap (${count}/${cap})`,
      count,
      limit: cap
    };
  }

  if (count === target) {
    return {
      type: 'target_reached',
      severity: 'info',
      message: `Daily goal achieved! (${count}/${target} prompts sent today)`,
      count,
      limit: target
    };
  }

  return null;
}
