import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock, resetChromeMock, setupChromeMock } from './mocks/chrome.mock.js';

describe('Chrome Mock API', () => {
  beforeEach(() => {
    resetChromeMock();
    setupChromeMock();
  });

  describe('chrome.storage.local', () => {
    it('stores and retrieves data by single key, array, and object defaults', async () => {
      await chrome.storage.local.set({ key1: 'value1', key2: 42 });

      const single = await chrome.storage.local.get('key1');
      expect(single).toEqual({ key1: 'value1' });

      const array = await chrome.storage.local.get(['key1', 'key2']);
      expect(array).toEqual({ key1: 'value1', key2: 42 });

      const defaults = await chrome.storage.local.get({ key1: 'default', key3: 'default3' });
      expect(defaults).toEqual({ key1: 'value1', key3: 'default3' });

      const all = await chrome.storage.local.get(null);
      expect(all).toEqual({ key1: 'value1', key2: 42 });
    });

    it('supports callback syntax for get, set, remove, clear, getBytesInUse', async () => {
      await new Promise(resolve => chrome.storage.local.set({ count: 10 }, resolve));

      const retrieved = await new Promise(resolve => chrome.storage.local.get('count', resolve));
      expect(retrieved).toEqual({ count: 10 });

      const bytes = await new Promise(resolve => chrome.storage.local.getBytesInUse('count', resolve));
      expect(bytes).toBeGreaterThan(0);

      await new Promise(resolve => chrome.storage.local.remove('count', resolve));
      const afterRemove = await chrome.storage.local.get('count');
      expect(afterRemove).toEqual({});

      await chrome.storage.local.set({ a: 1, b: 2 });
      await new Promise(resolve => chrome.storage.local.clear(resolve));
      const afterClear = await chrome.storage.local.get(null);
      expect(afterClear).toEqual({});
    });

    it('emits storage.onChanged events when modifying storage', async () => {
      const listener = vi.fn();
      chrome.storage.onChanged.addListener(listener);

      await chrome.storage.local.set({ foo: 'bar' });
      expect(listener).toHaveBeenCalledWith(
        { foo: { oldValue: undefined, newValue: 'bar' } },
        'local'
      );

      await chrome.storage.local.set({ foo: 'baz' });
      expect(listener).toHaveBeenCalledWith(
        { foo: { oldValue: 'bar', newValue: 'baz' } },
        'local'
      );

      await chrome.storage.local.remove('foo');
      expect(listener).toHaveBeenCalledWith(
        { foo: { oldValue: 'baz', newValue: undefined } },
        'local'
      );

      chrome.storage.onChanged.removeListener(listener);
      expect(chrome.storage.onChanged.hasListener(listener)).toBe(false);
    });
  });

  describe('chrome.action', () => {
    it('sets and gets badge text and background color', async () => {
      await chrome.action.setBadgeText({ text: '5' });
      expect(await chrome.action.getBadgeText({})).toBe('5');

      await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      expect(await chrome.action.getBadgeBackgroundColor({})).toBe('#6366f1');

      // Tab-specific badge
      await chrome.action.setBadgeText({ text: '9', tabId: 123 });
      expect(await chrome.action.getBadgeText({ tabId: 123 })).toBe('9');
      expect(await chrome.action.getBadgeText({})).toBe('5');
    });
  });

  describe('chrome.alarms', () => {
    it('creates, retrieves, clears, and triggers alarms', async () => {
      await chrome.alarms.create('refresh_badge', { periodInMinutes: 15 });

      const alarm = await chrome.alarms.get('refresh_badge');
      expect(alarm.name).toBe('refresh_badge');
      expect(alarm.periodInMinutes).toBe(15);

      const allAlarms = await chrome.alarms.getAll();
      expect(allAlarms).toHaveLength(1);

      const listener = vi.fn();
      chrome.alarms.onAlarm.addListener(listener);

      await chrome.alarms.onAlarm._trigger({ name: 'refresh_badge' });
      expect(listener).toHaveBeenCalledWith({ name: 'refresh_badge' });

      await chrome.alarms.clear('refresh_badge');
      expect(await chrome.alarms.get('refresh_badge')).toBeNull();

      chrome.alarms.onAlarm.removeListener(listener);
    });
  });

  describe('chrome.runtime', () => {
    it('generates extension URLs', () => {
      const url = chrome.runtime.getURL('dashboard/dashboard.html');
      expect(url).toBe('chrome-extension://mock-extension-id/dashboard/dashboard.html');
    });

    it('sends and receives runtime messages', async () => {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PING') {
          sendResponse({ reply: 'PONG' });
        }
        return true;
      });

      const response = await chrome.runtime.sendMessage({ type: 'PING' });
      expect(response).toEqual({ reply: 'PONG' });
    });

    it('triggers lifecycle events onInstalled and onStartup', async () => {
      const installedSpy = vi.fn();
      const startupSpy = vi.fn();

      chrome.runtime.onInstalled.addListener(installedSpy);
      chrome.runtime.onStartup.addListener(startupSpy);

      await chrome.runtime.onInstalled._trigger({ reason: 'install' });
      expect(installedSpy).toHaveBeenCalledWith({ reason: 'install' });

      await chrome.runtime.onStartup._trigger();
      expect(startupSpy).toHaveBeenCalled();
    });
  });
});
