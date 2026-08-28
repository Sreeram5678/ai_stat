import { setupChromeMock, resetChromeMock } from './mocks/chrome.mock.js';
import { beforeEach } from 'vitest';

// Install chrome mock into global scope
setupChromeMock();

beforeEach(() => {
  resetChromeMock();
});
