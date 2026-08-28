/**
 * AIStat - Theme Manager Module
 * Supports 3-way theme (auto/system, light, dark) with dynamic OS preference detection & multi-tab sync.
 */
import { StatsStorage } from './storage.js';

export class ThemeManager {
  /**
   * Resolves the effective theme ('light' or 'dark') given a theme setting ('auto', 'light', 'dark', 'system').
   * If 'auto' or 'system', queries OS preference via matchMedia('(prefers-color-scheme: dark)').
   */
  static resolveEffectiveTheme(themeSetting = 'auto') {
    const setting = (themeSetting || 'auto').toLowerCase();

    if (setting === 'auto' || setting === 'system') {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        return mql && mql.matches ? 'dark' : 'light';
      }
      return 'light';
    }

    if (setting === 'dark') {
      return 'dark';
    }

    return 'light';
  }

  /**
   * Applies the theme to <html> element, updates UI controls, and optionally persists to storage.
   * @param {string} themeChoice - 'auto', 'light', or 'dark'
   * @param {object} options - { persist: boolean }
   * @returns {Promise<string>} - Resolves with the effective theme ('light' or 'dark')
   */
  static async applyTheme(themeChoice = 'auto', { persist = true } = {}) {
    const effectiveTheme = this.resolveEffectiveTheme(themeChoice);

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      this.updateThemeButtons(themeChoice);
    }

    if (persist) {
      try {
        await StatsStorage.updateSettings({ theme: themeChoice });
      } catch (err) {
        console.warn('[AIStat ThemeManager] Failed to persist theme:', err);
      }
    }

    return effectiveTheme;
  }

  /**
   * Updates theme selection buttons in the DOM (if present)
   */
  static updateThemeButtons(themeChoice) {
    if (typeof document === 'undefined') return;

    const buttons = document.querySelectorAll('.theme-toggle-btn, [data-theme-choice]');
    buttons.forEach(btn => {
      const choice = btn.getAttribute('data-theme-choice');
      if (choice) {
        btn.classList.toggle('active', choice === themeChoice);
      }
    });

    const lightBtn = document.getElementById('theme-btn-light');
    const darkBtn = document.getElementById('theme-btn-dark');
    const autoBtn = document.getElementById('theme-btn-auto');

    if (lightBtn && !lightBtn.hasAttribute('data-theme-choice')) {
      lightBtn.classList.toggle('active', themeChoice === 'light');
    }
    if (darkBtn && !darkBtn.hasAttribute('data-theme-choice')) {
      darkBtn.classList.toggle('active', themeChoice === 'dark');
    }
    if (autoBtn && !autoBtn.hasAttribute('data-theme-choice')) {
      autoBtn.classList.toggle('active', themeChoice === 'auto' || themeChoice === 'system');
    }
  }

  /**
   * Sets up matchMedia change listener when theme is 'auto' and chrome.storage.onChanged for multi-tab sync.
   * Returns a cleanup/unsubscribe function.
   */
  static initThemeListener(onThemeChange) {
    let currentSetting = 'auto';

    // 1. OS Preference Change Listener
    let mql = null;
    const handleMediaChange = (e) => {
      if (currentSetting === 'auto' || currentSetting === 'system') {
        const effectiveTheme = e.matches ? 'dark' : 'light';
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.setAttribute('data-theme', effectiveTheme);
        }
        if (typeof onThemeChange === 'function') {
          onThemeChange(effectiveTheme, currentSetting);
        }
      }
    };

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      if (mql.addEventListener) {
        mql.addEventListener('change', handleMediaChange);
      } else if (mql.addListener) {
        mql.addListener(handleMediaChange);
      }
    }

    // 2. Multi-tab storage sync
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.settings?.newValue?.theme !== undefined) {
        const newSetting = changes.settings.newValue.theme || 'auto';
        currentSetting = newSetting;
        const effective = this.resolveEffectiveTheme(newSetting);
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.setAttribute('data-theme', effective);
          this.updateThemeButtons(newSetting);
        }
        if (typeof onThemeChange === 'function') {
          onThemeChange(effective, newSetting);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // Initial setting read to sync currentSetting
    StatsStorage.getSettings().then(settings => {
      if (settings?.theme) {
        currentSetting = settings.theme;
      }
    }).catch(() => {});

    // Return cleanup function
    return () => {
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', handleMediaChange);
        } else if (mql.removeListener) {
          mql.removeListener(handleMediaChange);
        }
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }

  /**
   * Initializes theme on page load: loads saved theme, applies it, and starts listeners.
   */
  static async init(onThemeChange) {
    try {
      const settings = await StatsStorage.getSettings();
      const theme = settings.theme || 'auto';
      await this.applyTheme(theme, { persist: false });
    } catch (err) {
      console.warn('[AIStat ThemeManager] Error initializing saved theme:', err);
      await this.applyTheme('auto', { persist: false });
    }

    return this.initThemeListener(onThemeChange);
  }
}
