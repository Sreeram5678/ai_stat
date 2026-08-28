import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MemoryCache,
  BatchWriteQueue,
  retryWithBackoff,
  estimateObjectSize
} from '../shared/cache-manager.js';

describe('MemoryCache', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache({ maxEntries: 3, defaultTtlMs: 100 });
  });

  it('should set and get values correctly', () => {
    cache.set('key1', 'val1');
    expect(cache.get('key1')).toBe('val1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('nonexistent')).toBe(false);
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should evict least-recently-used item when capacity is exceeded', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' so 'b' becomes the oldest
    cache.get('a');

    // Add 'd', should evict 'b'
    cache.set('d', 4);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('should expire entries after TTL', async () => {
    cache.set('temp', 'data', 50);
    expect(cache.get('temp')).toBe('data');

    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('temp')).toBeNull();
    expect(cache.has('temp')).toBe(false);
  });

  it('should delete and clear entries properly', () => {
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    expect(cache.delete('k1')).toBe(true);
    expect(cache.get('k1')).toBeNull();
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe('BatchWriteQueue', () => {
  it('should batch items and flush when maxBatchSize reached', async () => {
    const onFlush = vi.fn(async (items) => ({ processed: items.length }));
    const queue = new BatchWriteQueue({ maxBatchSize: 3, flushIntervalMs: 500, onFlush });

    const p1 = queue.enqueue({ id: 1 });
    const p2 = queue.enqueue({ id: 2 });
    expect(onFlush).not.toHaveBeenCalled();

    const p3 = queue.enqueue({ id: 3 }); // triggers flush immediately
    const results = await Promise.all([p1, p2, p3]);

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(results[0]).toEqual({ processed: 3 });
  });

  it('should flush on interval timer if maxBatchSize not met', async () => {
    const onFlush = vi.fn(async (items) => `flushed:${items.length}`);
    const queue = new BatchWriteQueue({ maxBatchSize: 10, flushIntervalMs: 40, onFlush });

    const p = queue.enqueue('hello');
    expect(onFlush).not.toHaveBeenCalled();

    const res = await p;
    expect(res).toBe('flushed:1');
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('should reject all batch promises if onFlush throws', async () => {
    const onFlush = vi.fn(async () => { throw new Error('Flush failed'); });
    const queue = new BatchWriteQueue({ maxBatchSize: 2, onFlush });

    const p1 = queue.enqueue(1);
    const p2 = queue.enqueue(2);

    await expect(Promise.all([p1, p2])).rejects.toThrow('Flush failed');
  });
});

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry and succeed after transient errors', async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 3) throw new Error('Temporary failure');
      return 'recovered';
    });

    const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10, factor: 1.5 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after reaching max retries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('Persistent failure');
    });

    await expect(retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 5 })).rejects.toThrow('Persistent failure');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('estimateObjectSize', () => {
  it('should calculate byte size of strings and objects', () => {
    expect(estimateObjectSize('hello')).toBeGreaterThan(0);
    expect(estimateObjectSize({ foo: 'bar', count: 42 })).toBeGreaterThan(15);
  });
});
