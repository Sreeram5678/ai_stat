/**
 * Robust In-Memory Chrome Extension API Mock for Vitest & jsdom
 * Provides mock implementations for MV3 storage, runtime, action, alarms, tabs, and event listeners.
 */

function clone(obj) {
  if (obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj));
}

export function createChromeMock() {
  let localStorageData = {};
  const storageListeners = new Set();
  const runtimeMessageListeners = new Set();
  const runtimeInstalledListeners = new Set();
  const runtimeStartupListeners = new Set();
  const alarmListeners = new Set();
  const alarmsMap = new Map();

  let actionState = {
    text: '',
    backgroundColor: '#000000',
    tabStates: new Map()
  };

  const chromeMock = {
    storage: {
      local: {
        async get(keys, callback) {
          let result = {};
          if (keys === null || keys === undefined) {
            result = clone(localStorageData);
          } else if (typeof keys === 'string') {
            if (keys in localStorageData) {
              result[keys] = clone(localStorageData[keys]);
            }
          } else if (Array.isArray(keys)) {
            keys.forEach(k => {
              if (k in localStorageData) {
                result[k] = clone(localStorageData[k]);
              }
            });
          } else if (typeof keys === 'object') {
            result = clone(keys);
            Object.keys(keys).forEach(k => {
              if (k in localStorageData) {
                result[k] = clone(localStorageData[k]);
              }
            });
          }

          if (typeof callback === 'function') {
            callback(result);
          }
          return result;
        },

        async set(items, callback) {
          if (!items || typeof items !== 'object') {
            throw new Error('Argument to set must be an object');
          }

          const changes = {};
          Object.keys(items).forEach(key => {
            const oldValue = clone(localStorageData[key]);
            const newValue = clone(items[key]);
            localStorageData[key] = newValue;
            changes[key] = { oldValue, newValue };
          });

          if (Object.keys(changes).length > 0) {
            chromeMock.storage.onChanged._trigger(changes, 'local');
          }

          if (typeof callback === 'function') {
            callback();
          }
        },

        async remove(keys, callback) {
          const keysToRemove = Array.isArray(keys) ? keys : [keys];
          const changes = {};

          keysToRemove.forEach(k => {
            if (k in localStorageData) {
              changes[k] = { oldValue: clone(localStorageData[k]), newValue: undefined };
              delete localStorageData[k];
            }
          });

          if (Object.keys(changes).length > 0) {
            chromeMock.storage.onChanged._trigger(changes, 'local');
          }

          if (typeof callback === 'function') {
            callback();
          }
        },

        async clear(callback) {
          const changes = {};
          Object.keys(localStorageData).forEach(k => {
            changes[k] = { oldValue: clone(localStorageData[k]), newValue: undefined };
          });

          localStorageData = {};

          if (Object.keys(changes).length > 0) {
            chromeMock.storage.onChanged._trigger(changes, 'local');
          }

          if (typeof callback === 'function') {
            callback();
          }
        },

        async getBytesInUse(keys, callback) {
          let totalBytes = 0;
          if (keys === null || keys === undefined) {
            totalBytes = new TextEncoder().encode(JSON.stringify(localStorageData)).length;
          } else {
            const keysToCheck = Array.isArray(keys) ? keys : [keys];
            const subset = {};
            keysToCheck.forEach(k => {
              if (k in localStorageData) {
                subset[k] = localStorageData[k];
              }
            });
            totalBytes = new TextEncoder().encode(JSON.stringify(subset)).length;
          }

          if (typeof callback === 'function') {
            callback(totalBytes);
          }
          return totalBytes;
        },

        _getStore() {
          return clone(localStorageData);
        },

        _setStore(data) {
          localStorageData = clone(data) || {};
        }
      },

      onChanged: {
        addListener(listener) {
          storageListeners.add(listener);
        },
        removeListener(listener) {
          storageListeners.delete(listener);
        },
        hasListener(listener) {
          return storageListeners.has(listener);
        },
        _trigger(changes, areaName = 'local') {
          storageListeners.forEach(listener => {
            try {
              listener(changes, areaName);
            } catch (err) {
              console.error('Error in chrome.storage.onChanged listener:', err);
            }
          });
        }
      }
    },

    runtime: {
      lastError: null,

      getURL(path = '') {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `chrome-extension://mock-extension-id/${cleanPath}`;
      },

      async sendMessage(message, callback) {
        let responseSent = false;
        let finalResponse;

        const promises = [];
        const sendResponse = (res) => {
          responseSent = true;
          finalResponse = res;
          if (typeof callback === 'function') {
            callback(res);
          }
        };

        const sender = { id: 'mock-extension-id', url: 'chrome-extension://mock-extension-id/' };

        for (const listener of runtimeMessageListeners) {
          try {
            const result = listener(message, sender, sendResponse);
            if (result === true) {
              // Asynchronous response expected
            }
          } catch (err) {
            console.error('Error in chrome.runtime.onMessage listener:', err);
          }
        }

        if (responseSent) {
          return finalResponse;
        }

        return finalResponse;
      },

      onMessage: {
        addListener(listener) {
          runtimeMessageListeners.add(listener);
        },
        removeListener(listener) {
          runtimeMessageListeners.delete(listener);
        },
        hasListener(listener) {
          return runtimeMessageListeners.has(listener);
        },
        _trigger(message, sender = {}, sendResponse = () => {}) {
          let asyncFlag = false;
          runtimeMessageListeners.forEach(listener => {
            const res = listener(message, sender, sendResponse);
            if (res === true) asyncFlag = true;
          });
          return asyncFlag;
        }
      },

      onInstalled: {
        addListener(listener) {
          runtimeInstalledListeners.add(listener);
        },
        removeListener(listener) {
          runtimeInstalledListeners.delete(listener);
        },
        hasListener(listener) {
          return runtimeInstalledListeners.has(listener);
        },
        async _trigger(details = { reason: 'install' }) {
          for (const listener of runtimeInstalledListeners) {
            await listener(details);
          }
        }
      },

      onStartup: {
        addListener(listener) {
          runtimeStartupListeners.add(listener);
        },
        removeListener(listener) {
          runtimeStartupListeners.delete(listener);
        },
        hasListener(listener) {
          return runtimeStartupListeners.has(listener);
        },
        async _trigger() {
          for (const listener of runtimeStartupListeners) {
            await listener();
          }
        }
      }
    },

    action: {
      async setBadgeText(details, callback) {
        const text = details?.text !== undefined ? String(details.text) : '';
        if (details?.tabId) {
          const tabState = actionState.tabStates.get(details.tabId) || {};
          tabState.text = text;
          actionState.tabStates.set(details.tabId, tabState);
        } else {
          actionState.text = text;
        }
        if (typeof callback === 'function') callback();
      },

      async setBadgeBackgroundColor(details, callback) {
        const color = details?.color || '#000000';
        if (details?.tabId) {
          const tabState = actionState.tabStates.get(details.tabId) || {};
          tabState.backgroundColor = color;
          actionState.tabStates.set(details.tabId, tabState);
        } else {
          actionState.backgroundColor = color;
        }
        if (typeof callback === 'function') callback();
      },

      async getBadgeText(details, callback) {
        let text = actionState.text;
        if (details?.tabId && actionState.tabStates.has(details.tabId)) {
          text = actionState.tabStates.get(details.tabId).text || '';
        }
        if (typeof callback === 'function') callback(text);
        return text;
      },

      async getBadgeBackgroundColor(details, callback) {
        let color = actionState.backgroundColor;
        if (details?.tabId && actionState.tabStates.has(details.tabId)) {
          color = actionState.tabStates.get(details.tabId).backgroundColor || color;
        }
        if (typeof callback === 'function') callback(color);
        return color;
      },

      _getState() {
        return {
          text: actionState.text,
          backgroundColor: actionState.backgroundColor,
          tabStates: new Map(actionState.tabStates)
        };
      },

      _reset() {
        actionState = {
          text: '',
          backgroundColor: '#000000',
          tabStates: new Map()
        };
      }
    },

    alarms: {
      async create(name, alarmInfo) {
        const alarmName = typeof name === 'string' ? name : '';
        const info = typeof name === 'object' ? name : (alarmInfo || {});
        alarmsMap.set(alarmName, {
          name: alarmName,
          periodInMinutes: info.periodInMinutes,
          delayInMinutes: info.delayInMinutes,
          when: info.when || Date.now() + (info.delayInMinutes || info.periodInMinutes || 0) * 60000
        });
      },

      async clear(name, callback) {
        const existed = alarmsMap.delete(name);
        if (typeof callback === 'function') callback(existed);
        return existed;
      },

      async clearAll(callback) {
        const count = alarmsMap.size;
        alarmsMap.clear();
        const cleared = count > 0;
        if (typeof callback === 'function') callback(cleared);
        return cleared;
      },

      async get(name, callback) {
        const alarm = alarmsMap.get(name) ? clone(alarmsMap.get(name)) : null;
        if (typeof callback === 'function') callback(alarm);
        return alarm;
      },

      async getAll(callback) {
        const list = Array.from(alarmsMap.values()).map(clone);
        if (typeof callback === 'function') callback(list);
        return list;
      },

      onAlarm: {
        addListener(listener) {
          alarmListeners.add(listener);
        },
        removeListener(listener) {
          alarmListeners.delete(listener);
        },
        hasListener(listener) {
          return alarmListeners.has(listener);
        },
        async _trigger(alarm) {
          for (const listener of alarmListeners) {
            await listener(typeof alarm === 'string' ? { name: alarm } : alarm);
          }
        }
      },

      _reset() {
        alarmsMap.clear();
        alarmListeners.clear();
      }
    },

    tabs: {
      async create(createProperties, callback) {
        const tab = {
          id: Math.floor(Math.random() * 10000) + 1,
          url: createProperties?.url || '',
          active: createProperties?.active ?? true
        };
        if (typeof callback === 'function') callback(tab);
        return tab;
      },

      async query(queryInfo, callback) {
        const tabs = [{ id: 1, url: 'https://chatgpt.com', active: true }];
        if (typeof callback === 'function') callback(tabs);
        return tabs;
      },

      async sendMessage(tabId, message, callback) {
        const response = { success: true };
        if (typeof callback === 'function') callback(response);
        return response;
      }
    },

    _resetAll() {
      localStorageData = {};
      storageListeners.clear();
      runtimeMessageListeners.clear();
      runtimeInstalledListeners.clear();
      runtimeStartupListeners.clear();
      alarmListeners.clear();
      alarmsMap.clear();
      actionState = {
        text: '',
        backgroundColor: '#000000',
        tabStates: new Map()
      };
      chromeMock.runtime.lastError = null;
    }
  };

  return chromeMock;
}

export const chromeMock = createChromeMock();

export function setupChromeMock() {
  globalThis.chrome = chromeMock;
  return chromeMock;
}

export function resetChromeMock() {
  chromeMock._resetAll();
  return chromeMock;
}
