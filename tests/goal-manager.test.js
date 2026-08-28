import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GOALS,
  calculateGoalProgress,
  checkGoalAlert
} from '../shared/goal-manager.js';

describe('goal-manager suite', () => {
  const sampleLogs = {
    '2026-08-28': { date: '2026-08-28', messagesCount: 25, platforms: { chatgpt: 25 } },
    '2026-08-27': { date: '2026-08-27', messagesCount: 30, platforms: { claude: 30 } },
    '2026-08-26': { date: '2026-08-26', messagesCount: 20, platforms: { gemini: 20 } }
  };

  describe('calculateGoalProgress', () => {
    it('calculates daily and weekly progress percentages correctly', () => {
      const goals = {
        enabled: true,
        dailyTarget: 50,
        dailyMaxCap: 100,
        weeklyTarget: 200,
        alertThresholdPercent: 80
      };

      const progress = calculateGoalProgress(sampleLogs, goals, new Date('2026-08-28T12:00:00'));

      expect(progress.enabled).toBe(true);
      expect(progress.today.current).toBe(25);
      expect(progress.today.target).toBe(50);
      expect(progress.today.percent).toBe(50);
      expect(progress.today.remaining).toBe(25);
      expect(progress.today.status).toBe('below_target');

      expect(progress.week.current).toBe(75); // 25 + 30 + 20
      expect(progress.week.target).toBe(200);
      expect(progress.week.percent).toBe(38);
    });

    it('identifies target_reached and cap_exceeded statuses', () => {
      const goals = {
        enabled: true,
        dailyTarget: 20,
        dailyMaxCap: 25,
        alertThresholdPercent: 80
      };

      const progress = calculateGoalProgress(sampleLogs, goals, new Date('2026-08-28T12:00:00'));
      expect(progress.today.status).toBe('cap_exceeded');
    });

    it('evaluates intraday pacing based on time of day', () => {
      const goals = {
        enabled: true,
        dailyTarget: 20,
        alertThresholdPercent: 80
      };

      // At 12:00 PM (50% of day elapsed), 25 messages is ahead of 10 expected messages
      const progressNoon = calculateGoalProgress(sampleLogs, goals, new Date('2026-08-28T12:00:00'));
      expect(progressNoon.pacing.status).toBe('ahead_of_pace');
    });
  });

  describe('checkGoalAlert', () => {
    const goals = {
      enabled: true,
      dailyTarget: 20,
      dailyMaxCap: 50,
      alertThresholdPercent: 80
    };

    it('returns null when disabled or within safe limits', () => {
      expect(checkGoalAlert(10, { enabled: false })).toBeNull();
      expect(checkGoalAlert(10, goals)).toBeNull();
    });

    it('triggers info alert on exact target reached', () => {
      const alert = checkGoalAlert(20, goals);
      expect(alert).not.toBeNull();
      expect(alert.type).toBe('target_reached');
      expect(alert.severity).toBe('info');
    });

    it('triggers warning alert when reaching 80% of cap', () => {
      const alert = checkGoalAlert(40, goals); // 40 = 80% of 50
      expect(alert).not.toBeNull();
      expect(alert.type).toBe('near_cap');
      expect(alert.severity).toBe('warning');
    });

    it('triggers critical alert when cap is exceeded', () => {
      const alert = checkGoalAlert(55, goals);
      expect(alert).not.toBeNull();
      expect(alert.type).toBe('cap_exceeded');
      expect(alert.severity).toBe('critical');
    });
  });
});
