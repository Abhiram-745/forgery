export type ModelCapability =
  | "coding"
  | "reasoning"
  | "creative"
  | "frontend"
  | "debugging"
  | "architecture"
  | "general"
  | "multimodal"

export type ModelTier = "free" | "standard" | "premium"

export type ModelProvider = "openrouter"

export interface ModelDefinition {
  id: string
  name: string
  provider: ModelProvider
  capabilities: ModelCapability[]
  tier: ModelTier
  maxTokens: number
  contextWindow: number
  inputCostPerMillion: number
  outputCostPerMillion: number
  latency: "fast" | "medium" | "slow"
  supportsStreaming: boolean
  supportsTools: boolean
  priority: number
  isFallback: boolean
}

export interface ModelRegistry {
  models: Map<string, ModelDefinition>
  getByCapability: (capability: ModelCapability) => ModelDefinition[]
  getPrimary: (capability: ModelCapability) => ModelDefinition
  getFallbacks: (capability: ModelCapability) => ModelDefinition[]
  getAll: () => ModelDefinition[]
  getFreeModels: () => ModelDefinition[]
}
