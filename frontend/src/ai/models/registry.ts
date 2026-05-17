import type { ModelDefinition, ModelRegistry, ModelCapability } from "@/types/models"

const MODELS: ModelDefinition[] = [
  {
    id: "deepseek/deepseek-chat:free",
    name: "DeepSeek Chat (Free)",
    provider: "openrouter",
    capabilities: ["coding", "reasoning", "general"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 128000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "medium",
    supportsStreaming: true,
    supportsTools: true,
    priority: 1,
    isFallback: false,
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Free)",
    provider: "openrouter",
    capabilities: ["reasoning", "architecture", "debugging"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 128000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "slow",
    supportsStreaming: true,
    supportsTools: false,
    priority: 1,
    isFallback: false,
  },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    name: "Qwen 2.5 Coder 32B (Free)",
    provider: "openrouter",
    capabilities: ["coding", "frontend", "debugging"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 128000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "medium",
    supportsStreaming: true,
    supportsTools: true,
    priority: 1,
    isFallback: false,
  },
  {
    id: "qwen/qwen-2.5-72b-instruct:free",
    name: "Qwen 2.5 72B Instruct (Free)",
    provider: "openrouter",
    capabilities: ["reasoning", "general", "architecture"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 128000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "medium",
    supportsStreaming: true,
    supportsTools: true,
    priority: 2,
    isFallback: false,
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash (Free)",
    provider: "openrouter",
    capabilities: ["coding", "creative", "frontend", "general", "multimodal"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 1048576,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "fast",
    supportsStreaming: true,
    supportsTools: true,
    priority: 1,
    isFallback: false,
  },
  {
    id: "google/gemini-flash-1.5-8b:free",
    name: "Gemini Flash 1.5 8B (Free)",
    provider: "openrouter",
    capabilities: ["coding", "creative", "frontend", "general"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 1048576,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "fast",
    supportsStreaming: true,
    supportsTools: true,
    priority: 2,
    isFallback: false,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct (Free)",
    provider: "openrouter",
    capabilities: ["reasoning", "general", "architecture"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 128000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "medium",
    supportsStreaming: true,
    supportsTools: true,
    priority: 2,
    isFallback: false,
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B Instruct (Free)",
    provider: "openrouter",
    capabilities: ["general", "coding"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 128000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "fast",
    supportsStreaming: true,
    supportsTools: true,
    priority: 3,
    isFallback: false,
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B Instruct (Free)",
    provider: "openrouter",
    capabilities: ["general", "coding"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 32000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "fast",
    supportsStreaming: true,
    supportsTools: true,
    priority: 4,
    isFallback: true,
  },
  {
    id: "qwen/qwen-2-vl-72b-instruct:free",
    name: "Qwen 2 VL 72B (Free)",
    provider: "openrouter",
    capabilities: ["multimodal", "creative", "frontend"],
    tier: "free",
    maxTokens: 8192,
    contextWindow: 32000,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latency: "medium",
    supportsStreaming: true,
    supportsTools: true,
    priority: 2,
    isFallback: false,
  },
]

const CAPABILITY_PRIORITY: Record<ModelCapability, ModelCapability[]> = {
  coding: ["coding", "general", "reasoning"],
  reasoning: ["reasoning", "general", "architecture"],
  creative: ["creative", "frontend", "general"],
  frontend: ["frontend", "coding", "creative"],
  debugging: ["debugging", "coding", "reasoning"],
  architecture: ["architecture", "reasoning", "general"],
  general: ["general", "coding", "reasoning"],
  multimodal: ["multimodal", "creative", "general"],
}

function buildRegistry(): ModelRegistry {
  const modelMap = new Map<string, ModelDefinition>()

  for (const model of MODELS) {
    modelMap.set(model.id, model)
  }

  function getByCapability(capability: ModelCapability): ModelDefinition[] {
    const priorityOrder = CAPABILITY_PRIORITY[capability] || ["general"]

    const scored = MODELS.map((model) => {
      let score = 0
      for (let i = 0; i < priorityOrder.length; i++) {
        if (model.capabilities.includes(priorityOrder[i])) {
          score = (priorityOrder.length - i) * 10
          break
        }
      }
      score -= model.priority
      if (model.isFallback) score -= 50
      return { model, score }
    })

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.model)
  }

  function getPrimary(capability: ModelCapability): ModelDefinition {
    const candidates = getByCapability(capability)
    return candidates[0] || MODELS.find((m) => m.isFallback) || MODELS[0]
  }

  function getFallbacks(capability: ModelCapability): ModelDefinition[] {
    const candidates = getByCapability(capability)
    return candidates.slice(1)
  }

  function getAll(): ModelDefinition[] {
    return MODELS
  }

  function getFreeModels(): ModelDefinition[] {
    return MODELS.filter((m) => m.tier === "free")
  }

  return {
    models: modelMap,
    getByCapability,
    getPrimary,
    getFallbacks,
    getAll,
    getFreeModels,
  }
}

export const modelRegistry = buildRegistry()
