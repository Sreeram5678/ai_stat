import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from '../shared/theme-manager.js';
import { StatsStorage } from '../shared/storage.js';
import { resetChromeMock, chromeMock } from './mocks/chrome.mock.js';

describe('ThemeManager', () => {
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    resetChromeMock();
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;

    // Mock document
    const attributes = {};
    globalThis.document = {
      documentElement: {
        setAttribute: (k, v) => { attributes[k] = v; },
        getAttribute: (k) => attributes[k]
      },
      querySelectorAll: () => [],
      getElementById: () => null
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  describe('resolveEffectiveTheme()', () => {
    it('returns "dark" when themeSetting is "dark"', () => {
      expect(ThemeManager.resolveEffectiveTheme('dark')).toBe('dark');
      expect(ThemeManager.resolveEffectiveTheme('DARK')).toBe('dark');
    });

    it('returns "light" when themeSetting is "light"', () => {
      expect(ThemeManager.resolveEffectiveTheme('light')).toBe('light');
      expect(ThemeManager.resolveEffectiveTheme('LIGHT')).toBe('light');
    });

    it('resolves "auto" to "dark" when OS prefers dark mode', () => {
      globalThis.window = {
        matchMedia: vi.fn((query) => {
          expect(query).toBe('(prefers-color-scheme: dark)');
          return { matches: true };
        })
      };

      expect(ThemeManager.resolveEffectiveTheme('auto')).toBe('dark');
      expect(ThemeManager.resolveEffectiveTheme('system')).toBe('dark');
    });

    it('resolves "auto" to "light" when OS prefers light mode', () => {
      globalThis.window = {
        matchMedia: vi.fn((query) => {
          expect(query).toBe('(prefers-color-scheme: dark)');
          return { matches: false };
        })
      };

      expect(ThemeManager.resolveEffectiveTheme('auto')).toBe('light');
      expect(ThemeManager.resolveEffectiveTheme('system')).toBe('light');
    });

    it('gracefully falls back to "light" when matchMedia is unavailable', () => {
      globalThis.window = {};
      expect(ThemeManager.resolveEffectiveTheme('auto')).toBe('light');
    });
  });

  describe('applyTheme()', () => {
    it('sets data-theme attribute on document.documentElement and persists setting', async () => {
      globalThis.window = {
        matchMedia: () => ({ matches: false })
      };

      const effective = await ThemeManager.applyTheme('dark', { persist: true });
      expect(effective).toBe('dark');
      expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('dark');

      const settings = await StatsStorage.getSettings();
      expect(settings.theme).toBe('dark');
    });

    it('does not persist setting when persist is false', async () => {
      globalThis.window = {
        matchMedia: () => ({ matches: true })
      };

      const effective = await ThemeManager.applyTheme('auto', { persist: false });
      expect(effective).toBe('dark');
      expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('dark');

      const stored = await chromeMock.storage.local.get('settings');
      expect(stored.settings?.theme).toBeUndefined();
    });
  });

  describe('initThemeListener()', () => {
    it('notifies callback and updates DOM when media query changes in auto mode', () => {
      let mediaChangeListener = null;
      globalThis.window = {
        matchMedia: (query) => ({
          matches: false,
          addEventListener: (event, handler) => {
            if (event === 'change') mediaChangeListener = handler;
          },
          removeEventListener: () => {
            mediaChangeListener = null;
          }
        })
      };

      let notifiedTheme = null;
      const cleanup = ThemeManager.initThemeListener((effectiveTheme) => {
        notifiedTheme = effectiveTheme;
      });

      expect(typeof mediaChangeListener).toBe('function');

      // Simulate OS switching to dark mode
      mediaChangeListener({ matches: true });
      expect(notifiedTheme).toBe('dark');
      expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('dark');

      // Simulate OS switching back to light mode
      mediaChangeListener({ matches: false });
      expect(notifiedTheme).toBe('light');
      expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('light');

      cleanup();
      expect(mediaChangeListener).toBeNull();
    });

    it('syncs theme changes across tabs via chrome.storage.onChanged', async () => {
      globalThis.window = {
        matchMedia: () => ({
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {}
        })
      };

      let notifiedEffective = null;
      let notifiedSetting = null;

      const cleanup = ThemeManager.initThemeListener((effective, setting) => {
        notifiedEffective = effective;
        notifiedSetting = setting;
      });

      // Simulate storage change from another tab
      await chromeMock.storage.local.set({ settings: { theme: 'dark' } });

      expect(notifiedEffective).toBe('dark');
      expect(notifiedSetting).toBe('dark');
      expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('dark');

      cleanup();
    });
  });
});
