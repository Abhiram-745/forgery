import type { ModelCapability, ModelDefinition } from "./models"

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
}

export interface RoutingDecision {
  selectedModel: ModelDefinition
  reason: string
  capability: ModelCapability
  fallbackChain: ModelDefinition[]
  timestamp: number
}

export interface RetryConfig {
  maxRetries: number
  backoffMs: number
  maxBackoffMs: number
  retryableStatuses: number[]
}

export interface HealthStatus {
  modelId: string
  isHealthy: boolean
  lastChecked: number
  latency: number
  errorRate: number
  consecutiveFailures: number
}

export interface CostRecord {
  modelId: string
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: number
}

export interface LatencyRecord {
  modelId: string
  latency: number
  timestamp: number
}

export interface OrchestrationResult {
  response: string
  model: ModelDefinition
  tokens: {
    input: number
    output: number
    total: number
  }
  cost: number
  latency: number
  retries: number
  isFallback: boolean
}

export interface OrchestrationRequest {
  messages: ChatMessage[]
  systemPrompt?: string
  capability?: ModelCapability
  stream?: boolean
  temperature?: number
  maxTokens?: number
  abortSignal?: AbortSignal
}
