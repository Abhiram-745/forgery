import type { CacheEntry, CacheConfig, CacheStore } from "@/types/cache"

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000,
  maxEntries: 100,
  enabled: true,
}

class LRUCache implements CacheStore {
  private store = new Map<string, CacheEntry<unknown>>()
  private config: CacheConfig

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  get<T>(key: string): T | null {
    if (!this.config.enabled) return null

    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    entry.hitCount++
    return entry.value
  }

  set<T>(key: string, value: T, ttl?: number): void {
    if (!this.config.enabled) return

    if (this.store.size >= this.config.maxEntries) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl ?? this.config.ttl),
      hitCount: 0,
    }

    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }

    return true
  }

  size(): number {
    return this.store.size
  }

  private evictLRU(): void {
    let lruKey: string | null = null
    let lruEntry: CacheEntry<unknown> | null = null

    for (const [key, entry] of this.store) {
      if (!lruEntry || entry.hitCount < lruEntry.hitCount) {
        lruKey = key
        lruEntry = entry
      }
    }

    if (lruKey) {
      this.store.delete(lruKey)
    }
  }
}

function generateCacheKey(messages: Array<{ role: string; content: string }>, modelId: string): string {
  const content = messages.map((m) => `${m.role}:${m.content}`).join("|")
  const hash = simpleHash(content + modelId)
  return `cache_${hash}`
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

const responseCache = new LRUCache()

export function getCachedResponse(key: string): string | null {
  return responseCache.get<string>(key)
}

export function setCachedResponse(key: string, value: string, ttl?: number): void {
  responseCache.set(key, value, ttl)
}

export function createCacheKey(messages: Array<{ role: string; content: string }>, modelId: string): string {
  return generateCacheKey(messages, modelId)
}

export { LRUCache }
export type { CacheConfig }
