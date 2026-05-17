export interface CacheEntry<T> {
  value: T
  createdAt: number
  expiresAt: number
  hitCount: number
}

export interface CacheConfig {
  ttl: number
  maxEntries: number
  enabled: boolean
}

export interface CacheStore {
  get: <T>(key: string) => T | null
  set: <T>(key: string, value: T, ttl?: number) => void
  delete: (key: string) => void
  clear: () => void
  has: (key: string) => boolean
  size: () => number
}
