/**
 * AIStat - Analytics Dashboard Controller
 */
import { StatsStorage } from '../shared/storage.js';
import { PLATFORMS } from '../shared/constants.js';

async function handleExportJSON() {
  const jsonStr = await StatsStorage.exportJSON();
  console.log('Exporting JSON:', jsonStr.length);
}
