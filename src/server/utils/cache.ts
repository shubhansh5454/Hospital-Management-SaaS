/**
 * Memory-safe In-Memory TTL Cache Utility
 * Prevents memory leaks by limiting maximum item size and automatically purging expired entries.
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxItems: number;
  private defaultTtlMs: number;

  constructor(maxItems = 1000, defaultTtlSeconds = 300) {
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  /**
   * Set cache value with custom TTL
   */
  public set<T>(key: string, value: T, ttlSeconds?: number): void {
    // Evict oldest item if cache limit is reached
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
    });
  }

  /**
   * Get cached value if present and not expired
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Delete specific cache key
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear cache keys matching a specific prefix namespace
   */
  public invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache store
   */
  public clear(): void {
    this.cache.clear();
  }
}

// Global cache instances for specific domains
export const settingsCache = new SimpleCache(200, 300); // 5 minutes TTL for clinic settings
export const featureFlagsCache = new SimpleCache(100, 120); // 2 minutes TTL for feature flags
