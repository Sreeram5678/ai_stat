/**
 * AIStat - Session Intelligence & Prompt Clustering Engine
 * Analyzes work sessions, prompt bursts, model multitasking, and productivity styles.
 */

import { PLATFORMS } from './constants.js';

/**
 * Cluster raw prompt events into discrete sessions based on inactivity timeout.
 * @param {Array<{ timestamp: number, platform: string }>} promptEvents
 * @param {Object} [options]
 * @param {number} [options.inactivityTimeoutMs=1800000] 30 minutes default
 */
export function clusterPromptsIntoSessions(promptEvents = [], { inactivityTimeoutMs = 30 * 60 * 1000 } = {}) {
  if (!Array.isArray(promptEvents) || promptEvents.length === 0) {
    return [];
  }

  // Sort timestamps chronologically
  const sorted = [...promptEvents].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const sessions = [];
  let currentSession = null;

  sorted.forEach(evt => {
    const ts = evt.timestamp || Date.now();
    const platform = evt.platform || 'chatgpt';

    if (!currentSession) {
      currentSession = {
        startTime: ts,
        endTime: ts,
        promptsCount: 1,
        platformCounts: { [platform]: 1 },
        events: [{ timestamp: ts, platform }]
      };
    } else {
      const timeSinceLast = ts - currentSession.endTime;
      if (timeSinceLast <= inactivityTimeoutMs) {
        // Continue session
        currentSession.endTime = ts;
        currentSession.promptsCount++;
        currentSession.platformCounts[platform] = (currentSession.platformCounts[platform] || 0) + 1;
        currentSession.events.push({ timestamp: ts, platform });
      } else {
        // Close previous session and start new
        sessions.push(finalizeSession(currentSession));
        currentSession = {
          startTime: ts,
          endTime: ts,
          promptsCount: 1,
          platformCounts: { [platform]: 1 },
          events: [{ timestamp: ts, platform }]
        };
      }
    }
  });

  if (currentSession) {
    sessions.push(finalizeSession(currentSession));
  }

  return sessions;
}

function finalizeSession(rawSession) {
  const durationMs = Math.max(0, rawSession.endTime - rawSession.startTime);
  const durationMinutes = Number((durationMs / 60000).toFixed(1));
  const distinctPlatforms = Object.keys(rawSession.platformCounts);

  // Velocity: prompts per minute during active duration (min 1 min)
  const effectiveMins = Math.max(1, durationMinutes);
  const promptsPerMinute = Number((rawSession.promptsCount / effectiveMins).toFixed(2));

  // Determine primary platform
  let primaryPlatform = distinctPlatforms[0] || 'unknown';
  let maxCount = 0;
  Object.entries(rawSession.platformCounts).forEach(([p, c]) => {
    if (c > maxCount) {
      maxCount = c;
      primaryPlatform = p;
    }
  });

  // Workstyle classification
  let workstyle = 'intermittent_lookup';
  if (rawSession.promptsCount >= 10 && distinctPlatforms.length === 1) {
    workstyle = 'deep_work';
  } else if (rawSession.promptsCount >= 8 && distinctPlatforms.length >= 2) {
    workstyle = 'rapid_multitasking';
  } else if (rawSession.promptsCount >= 5) {
    workstyle = 'iterative_coding';
  }

  return {
    startTime: rawSession.startTime,
    endTime: rawSession.endTime,
    durationMs,
    durationMinutes,
    promptsCount: rawSession.promptsCount,
    promptsPerMinute,
    platformCounts: rawSession.platformCounts,
    distinctPlatformsCount: distinctPlatforms.length,
    primaryPlatform,
    workstyle
  };
}

/**
 * Aggregates high-level intelligence metrics across multiple sessions.
 */
export function analyzeSessionPatterns(sessions = []) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      totalSessions: 0,
      averageDurationMinutes: 0,
      averagePromptsPerSession: 0,
      multitaskingRatePercent: 0,
      dominantWorkstyle: 'none',
      workstyleBreakdown: {}
    };
  }

  let totalDurationMins = 0;
  let totalPrompts = 0;
  let multiPlatformSessions = 0;
  const workstyleCounts = {};

  sessions.forEach(s => {
    totalDurationMins += s.durationMinutes;
    totalPrompts += s.promptsCount;
    if (s.distinctPlatformsCount > 1) multiPlatformSessions++;
    workstyleCounts[s.workstyle] = (workstyleCounts[s.workstyle] || 0) + 1;
  });

  const totalSessions = sessions.length;
  const averageDurationMinutes = Number((totalDurationMins / totalSessions).toFixed(1));
  const averagePromptsPerSession = Number((totalPrompts / totalSessions).toFixed(1));
  const multitaskingRatePercent = Math.round((multiPlatformSessions / totalSessions) * 100);

  let dominantWorkstyle = 'none';
  let maxWCount = 0;
  Object.entries(workstyleCounts).forEach(([style, count]) => {
    if (count > maxWCount) {
      maxWCount = count;
      dominantWorkstyle = style;
    }
  });

  return {
    totalSessions,
    averageDurationMinutes,
    averagePromptsPerSession,
    multitaskingRatePercent,
    dominantWorkstyle,
    workstyleBreakdown: workstyleCounts
  };
}
