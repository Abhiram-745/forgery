import type { ModelDefinition } from "@/types/models"
import type { ChatMessage } from "@/types/orchestration"

export interface ProviderConfig {
  apiKey: string
  baseUrl: string
  timeout: number
}

export interface ProviderResponse {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
}

export interface ProviderStreamChunk {
  content: string
  done: boolean
  model?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export abstract class AIProvider {
  protected config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  abstract complete(
    model: ModelDefinition,
    messages: ChatMessage[],
    options?: {
      temperature?: number
      maxTokens?: number
      abortSignal?: AbortSignal
    }
  ): Promise<ProviderResponse>

  abstract streamComplete(
    model: ModelDefinition,
    messages: ChatMessage[],
    options?: {
      temperature?: number
      maxTokens?: number
      abortSignal?: AbortSignal
    }
  ): AsyncIterable<ProviderStreamChunk>

  abstract checkHealth(model: ModelDefinition): Promise<{
    isHealthy: boolean
    latency: number
  }>

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "HTTP-Referer": "https://forge-ai.platform",
      "X-Title": "Forge AI Platform",
    }
  }

  protected buildBody(
    model: ModelDefinition,
    messages: ChatMessage[],
    options?: {
      temperature?: number
      maxTokens?: number
      stream?: boolean
    }
  ) {
    return {
      model: model.id,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? model.maxTokens,
      stream: options?.stream ?? false,
    }
  }
}
