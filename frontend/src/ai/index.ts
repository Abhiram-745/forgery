export { modelRegistry } from "./models/registry"
export type { ModelDefinition, ModelCapability, ModelTier, ModelProvider } from "@/types/models"

export { getProvider, OpenRouterProvider } from "./providers"
export type { AIProvider, ProviderConfig, ProviderResponse, ProviderStreamChunk } from "./providers/base"

export {
  orchestrate,
  orchestrateStream,
  routeRequest,
  detectCapability,
  withRetry,
  recordSuccess,
  recordFailure,
  getHealthStatus,
  getAllHealthStatuses,
  getTotalCost,
  getCostRecords,
  getAverageLatency,
  getHealthyModels,
  getModelScore,
} from "./orchestration"

export { contextManager, estimateTokenCount, estimateMessageTokens } from "./context"

export {
  getPrompt,
  getPromptsForCapability,
  getDefaultPrompt,
  getAllPrompts,
} from "./prompts"
export type { PromptTemplate } from "./prompts"

export { createStreamController, processStream, createStreamHandler } from "./streaming"

export { getCachedResponse, setCachedResponse, createCacheKey, LRUCache } from "./cache"
export type { CacheConfig } from "./cache"

export { registerTool, getTool, getAllTools, buildToolSchema } from "./tools/registry"
export type { ToolDefinition } from "./tools/registry"
