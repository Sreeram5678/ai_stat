/**
 * AIStat - Main World Network Interceptor
 */
(function () {
  'use strict';
  if (window.self !== window.top) return;
  if (window.__AI_STAT_INTERCEPTOR_LOADED__) return;
  window.__AI_STAT_INTERCEPTOR_LOADED__ = true;

  const host = window.location.hostname.toLowerCase();
  let platformId = null;
  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) platformId = 'chatgpt';
  else if (host.includes('claude.ai')) platformId = 'claude';
  if (!platformId) return;

  console.log('[AIStat] Monitoring platform:', platformId);
})();
