/**
 * AIStat - Main World Network Interceptor
 */
(function () {
  'use strict';
  if (window.self !== window.top) return;
  if (window.__AI_STAT_INTERCEPTOR_LOADED__) return;
  window.__AI_STAT_INTERCEPTOR_LOADED__ = true;
  console.log('[AIStat] Network interceptor initialized.');
})();
