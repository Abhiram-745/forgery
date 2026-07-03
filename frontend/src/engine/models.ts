/**
 * Free-model registry with runtime discovery.
 *
 * Three ordered failover chains (generation, architect, fast). The static
 * chains are the source of truth for ordering; a background fetch of
 * OpenRouter's live model list prunes IDs that no longer exist and appends
 * newly available free coding models, so a stale hardcoded ID costs at most
 * one failover hop, never an outage.
 */

export type ChainKind = "generation" | "architect" | "fast"

/** Primary model, user-specified. */
export const PRIMARY_MODEL = "poolside/laguna-xs-2.1:free"

const GENERATION_CHAIN = [
  PRIMARY_MODEL,
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "moonshotai/kimi-k2:free",
  "z-ai/glm-4.5-air:free",
  "deepseek/deepseek-r1-0528:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
]

const ARCHITECT_CHAIN = [
  PRIMARY_MODEL,
  "deepseek/deepseek-chat-v3-0324:free",
  "qwen/qwen3-coder:free",
  "z-ai/glm-4.5-air:free",
  "moonshotai/kimi-k2:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
]

// Smaller/faster models first — used for intent classification and chat.
const FAST_CHAIN = [
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "z-ai/glm-4.5-air:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "qwen/qwen3-coder:free",
  PRIMARY_MODEL,
]

const STATIC_CHAINS: Record<ChainKind, string[]> = {
  generation: GENERATION_CHAIN,
  architect: ARCHITECT_CHAIN,
  fast: FAST_CHAIN,
}

// ---------------------------------------------------------------------------
// Runtime discovery (best effort, never blocking)
// ---------------------------------------------------------------------------

const DISCOVERY_TTL_MS = 10 * 60 * 1000
const CODER_HINT = /coder|code|dev|laguna/i

interface DiscoveryState {
  liveFreeIds: Set<string> | null
  extraCoders: string[]
  fetchedAt: number
  inFlight: Promise<void> | null
}

const discovery: DiscoveryState = {
  liveFreeIds: null,
  extraCoders: [],
  fetchedAt: 0,
  inFlight: null,
}

function refreshDiscovery(): void {
  if (discovery.inFlight) return
  if (Date.now() - discovery.fetchedAt < DISCOVERY_TTL_MS) return
  discovery.inFlight = (async () => {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const data = (await res.json()) as { data?: { id: string; name?: string }[] }
      const free = (data.data ?? []).filter((m) => m.id.endsWith(":free"))
      discovery.liveFreeIds = new Set(free.map((m) => m.id))
      const known = new Set(Object.values(STATIC_CHAINS).flat())
      discovery.extraCoders = free
        .filter((m) => !known.has(m.id) && CODER_HINT.test(m.id + " " + (m.name ?? "")))
        .map((m) => m.id)
        .slice(0, 5)
      discovery.fetchedAt = Date.now()
    } catch {
      // Offline or blocked — static chains stand as-is.
    } finally {
      discovery.inFlight = null
    }
  })()
}

/**
 * Resolve the failover chain for a stage. Kicks off a (non-blocking)
 * discovery refresh; applies the last completed discovery result.
 */
export function getChain(kind: ChainKind): string[] {
  refreshDiscovery()
  const base = STATIC_CHAINS[kind]
  if (!discovery.liveFreeIds) return [...base]
  const alive = base.filter((id) => discovery.liveFreeIds!.has(id))
  const chain = alive.length > 0 ? alive : [...base]
  if (kind === "generation") chain.push(...discovery.extraCoders)
  return chain
}

/** All statically known models, for the health endpoint / landing page. */
export function getKnownModels(): { id: string; role: string }[] {
  const seen = new Map<string, string>()
  for (const id of GENERATION_CHAIN) seen.set(id, "generation")
  for (const id of FAST_CHAIN) if (!seen.has(id)) seen.set(id, "fast")
  return [...seen.entries()].map(([id, role]) => ({ id, role }))
}
