/**
 * AIStat - Popup Controller
 */
import { StatsStorage } from '../shared/storage.js';
import { PLATFORMS } from '../shared/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
  const stats = await StatsStorage.getSummaryStats(7);
  console.log('[AIStat] Popup stats:', stats);
});
