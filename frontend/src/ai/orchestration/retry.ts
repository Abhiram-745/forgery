import type { RetryConfig } from "@/types/orchestration"

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const exponential = config.backoffMs * Math.pow(2, attempt)
  const jitter = Math.random() * 500
  return Math.min(exponential + jitter, config.maxBackoffMs)
}

function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof Error) {
    const statusMatch = error.message.match(/API error: (\d+)/)
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10)
      return config.retryableStatuses.includes(status)
    }
    return error.message.includes("rate limit") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ETIMEDOUT")
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (
        attempt < mergedConfig.maxRetries &&
        isRetryableError(lastError, mergedConfig)
      ) {
        const backoff = calculateBackoff(attempt, mergedConfig)
        await sleep(backoff)
        continue
      }

      throw lastError
    }
  }

  throw lastError ?? new Error("Unknown error after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { DEFAULT_RETRY_CONFIG, isRetryableError, calculateBackoff }
