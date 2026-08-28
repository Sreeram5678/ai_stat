/**
 * AIStat - In-Memory Cache, Rate-Limiting & Batch Queuing Engine
 * Optimizes chrome.storage access with LRU caching, batched writes, and quota resilience.
 */

export class MemoryCache {
  constructor({ maxEntries = 100, defaultTtlMs = 60000 } = {}) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (LRU)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
    return value;
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key);
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

export class BatchWriteQueue {
  constructor({ flushIntervalMs = 50, maxBatchSize = 50, onFlush = null } = {}) {
    this.flushIntervalMs = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
    this.onFlush = onFlush;
    this.queue = [];
    this.timer = null;
    this.isFlushing = false;
  }

  enqueue(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
      }
    });
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    const items = batch.map(b => b.item);

    try {
      let result;
      if (this.onFlush) {
        result = await this.onFlush(items);
      }
      batch.forEach(b => b.resolve(result));
    } catch (err) {
      batch.forEach(b => b.reject(err));
    } finally {
      this.isFlushing = false;
      if (this.queue.length > 0) {
        this.flush();
      }
    }
  }

  get pendingCount() {
    return this.queue.length;
  }
}

/**
 * Execute an async operation with exponential backoff retries.
 */
export async function retryWithBackoff(fn, { maxRetries = 3, initialDelayMs = 20, factor = 2 } = {}) {
  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, delay));
      delay *= factor;
    }
  }

  throw lastError;
}

/**
 * Estimates storage usage in bytes for JSON-serializable objects.
 */
export function estimateObjectSize(obj) {
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (typeof Blob !== 'undefined') {
      return new Blob([str]).size;
    }
    return Buffer.byteLength(str, 'utf8');
  } catch (err) {
    return 0;
  }
}

export const globalCache = new MemoryCache({ maxEntries: 50, defaultTtlMs: 30000 });
