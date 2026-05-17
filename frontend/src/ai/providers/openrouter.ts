import { AIProvider, type ProviderConfig, type ProviderResponse, type ProviderStreamChunk } from "./base"
import type { ModelDefinition } from "@/types/models"
import type { ChatMessage } from "@/types/orchestration"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

export class OpenRouterProvider extends AIProvider {
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: OPENROUTER_BASE_URL,
      timeout: 60000,
    })
  }

  async complete(
    model: ModelDefinition,
    messages: ChatMessage[],
    options?: {
      temperature?: number
      maxTokens?: number
      abortSignal?: AbortSignal
    }
  ): Promise<ProviderResponse> {
    const body = this.buildBody(model, messages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stream: false,
    })

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: options?.abortSignal,
    })

    if (!response.ok) {
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    return {
      content: data.choices[0]?.message?.content ?? "",
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      finishReason: data.choices[0]?.finish_reason ?? "stop",
    }
  }

  async *streamComplete(
    model: ModelDefinition,
    messages: ChatMessage[],
    options?: {
      temperature?: number
      maxTokens?: number
      abortSignal?: AbortSignal
    }
  ): AsyncIterable<ProviderStreamChunk> {
    const body = this.buildBody(model, messages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stream: true,
    })

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(),
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: options?.abortSignal,
    })

    if (!response.ok) {
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}`
      )
    }

    if (!response.body) {
      throw new Error("No response body for streaming")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          yield { content: "", done: true }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === "data: [DONE]") continue
          if (!trimmed.startsWith("data: ")) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices[0]?.delta
            const content = delta?.content ?? ""

            if (content) {
              yield {
                content,
                done: false,
                model: json.model,
              }
            }

            if (json.choices[0]?.finish_reason) {
              yield {
                content: "",
                done: true,
                model: json.model,
                usage: json.usage
                  ? {
                      promptTokens: json.usage.prompt_tokens ?? 0,
                      completionTokens: json.usage.completion_tokens ?? 0,
                      totalTokens: json.usage.total_tokens ?? 0,
                    }
                  : undefined,
              }
            }
          } catch {
            continue
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async checkHealth(model: ModelDefinition): Promise<{
    isHealthy: boolean
    latency: number
  }> {
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const latency = Date.now() - startTime

      return {
        isHealthy: response.ok,
        latency,
      }
    } catch {
      return {
        isHealthy: false,
        latency: Date.now() - startTime,
      }
    }
  }
}
