import type {
  CompletionOptions,
  CompletionResult,
  Provider,
} from "./types"
import { ModelUnavailableError, ProviderError, RateLimitedError } from "./types"
import { getMockProvider } from "./provider-mock"

const BASE_URL = "https://openrouter.ai/api/v1"
const TIMEOUT_MS = 120_000

/** Real OpenRouter client (raw fetch, OpenAI-compatible wire format). */
class OpenRouterProvider implements Provider {
  constructor(private apiKey: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://forge-ai.platform",
      "X-Title": "Forge AI Platform",
    }
  }

  private body(model: string, opts: CompletionOptions, stream: boolean) {
    return JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 8192,
      stream,
    })
  }

  private async request(model: string, opts: CompletionOptions, stream: boolean): Promise<Response> {
    const signals = [AbortSignal.timeout(TIMEOUT_MS)]
    if (opts.signal) signals.push(opts.signal)
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: this.body(model, opts, stream),
      signal: AbortSignal.any(signals),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"))
        throw new RateLimitedError(
          `Rate limited on ${model}`,
          Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined
        )
      }
      if (res.status === 402 || res.status === 404) {
        throw new ModelUnavailableError(`Model ${model} unavailable (${res.status}): ${text.slice(0, 200)}`)
      }
      throw new ProviderError(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`, res.status)
    }
    return res
  }

  async complete(model: string, opts: CompletionOptions): Promise<CompletionResult> {
    const res = await this.request(model, opts, false)
    const data = await res.json()
    // OpenRouter can return 200 with an in-band error body.
    if (data.error) {
      const code = Number(data.error.code)
      if (code === 429) throw new RateLimitedError(data.error.message ?? "rate limited")
      throw new ProviderError(data.error.message ?? "provider error", code)
    }
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== "string" || text.length === 0) {
      throw new ProviderError(`Empty completion from ${model}`)
    }
    return { text, model: data.model ?? model }
  }

  async *stream(model: string, opts: CompletionOptions): AsyncGenerator<string, void, void> {
    const res = await this.request(model, opts, true)
    const reader = res.body?.getReader()
    if (!reader) throw new ProviderError("No response body")
    const decoder = new TextDecoder()
    let buffer = ""
    let yielded = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data: ")) continue
          const payload = trimmed.slice(6)
          if (payload === "[DONE]") return
          try {
            const data = JSON.parse(payload)
            if (data.error) {
              const code = Number(data.error.code)
              if (code === 429) throw new RateLimitedError(data.error.message ?? "rate limited")
              throw new ProviderError(data.error.message ?? "provider error", code)
            }
            const delta = data.choices?.[0]?.delta?.content
            if (typeof delta === "string" && delta.length > 0) {
              yielded = true
              yield delta
            }
          } catch (e) {
            if (e instanceof RateLimitedError || e instanceof ProviderError) throw e
            // malformed keep-alive line — ignore
          }
        }
      }
      if (!yielded) throw new ProviderError(`Empty stream from ${model}`)
    } finally {
      reader.releaseLock()
    }
  }
}

let singleton: Provider | null = null

export function getProvider(): Provider {
  if (process.env.FORGE_MOCK_AI) return getMockProvider(process.env.FORGE_MOCK_AI)
  if (!singleton) {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      throw new ProviderError(
        "OPENROUTER_API_KEY is not set. Add it to frontend/.env.local (local) or the Vercel project environment."
      )
    }
    singleton = new OpenRouterProvider(key)
  }
  return singleton
}
