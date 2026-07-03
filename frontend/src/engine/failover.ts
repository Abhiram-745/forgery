import { ModelUnavailableError, ProviderError, RateLimitedError } from "./types"

/**
 * Failover runner: walk an ordered model chain, giving each model one
 * transient retry before moving on. Best-effort in-memory health tracking
 * skips models that have failed repeatedly in the recent past (resets on
 * serverless cold start, which is fine — it's an optimization, not state).
 */

interface Health {
  consecutiveFailures: number
  skipUntil: number
}

const health = new Map<string, Health>()
const SKIP_AFTER_FAILURES = 3
const SKIP_WINDOW_MS = 5 * 60 * 1000
const MAX_RETRY_AFTER_MS = 3000

export interface FailoverOutcome<T> {
  result: T
  model: string
  fallbackUsed: boolean
  attempts: number
}

export async function runWithFailover<T>(
  chain: string[],
  stage: string,
  fn: (model: string) => Promise<T>,
  onStatus?: (message: string) => void
): Promise<FailoverOutcome<T>> {
  let attempts = 0
  let lastError: unknown = null
  const now = Date.now()
  const usable = chain.filter((m) => (health.get(m)?.skipUntil ?? 0) <= now)
  const ordered = usable.length > 0 ? usable : chain

  for (let idx = 0; idx < ordered.length; idx++) {
    const model = ordered[idx]
    if (idx > 0) onStatus?.(`Falling back to ${shortName(model)}…`)

    for (let attempt = 0; attempt < 2; attempt++) {
      attempts++
      try {
        const result = await fn(model)
        recordSuccess(model)
        return { result, model, fallbackUsed: idx > 0, attempts }
      } catch (err) {
        lastError = err
        // User aborted: stop everything immediately.
        if (isAbort(err)) throw err

        recordFailure(model)

        if (err instanceof RateLimitedError) {
          // Honor a short Retry-After once; otherwise fail over.
          if (attempt === 0 && err.retryAfterMs && err.retryAfterMs <= MAX_RETRY_AFTER_MS) {
            await sleep(err.retryAfterMs)
            continue
          }
          break // next model
        }
        if (err instanceof ModelUnavailableError) break // next model, no retry
        if (err instanceof ProviderError && err.status && err.status < 500 && err.status !== 408) {
          break // deterministic 4xx — retrying the same model won't help
        }
        // Transient (network, 5xx, timeout, empty response): one retry.
        if (attempt === 0) {
          await sleep(400 + Math.random() * 400)
          continue
        }
        break
      }
    }
  }

  throw new ProviderError(
    `All models failed for stage "${stage}". Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

function recordSuccess(model: string) {
  health.set(model, { consecutiveFailures: 0, skipUntil: 0 })
}

function recordFailure(model: string) {
  const h = health.get(model) ?? { consecutiveFailures: 0, skipUntil: 0 }
  h.consecutiveFailures++
  if (h.consecutiveFailures >= SKIP_AFTER_FAILURES) {
    h.skipUntil = Date.now() + SKIP_WINDOW_MS
  }
  health.set(model, h)
}

export function getHealthSnapshot(): Record<string, Health> {
  return Object.fromEntries(health.entries())
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError"
}

export function shortName(model: string): string {
  return model.replace(":free", "").split("/").pop() ?? model
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
