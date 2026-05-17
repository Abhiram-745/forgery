import type {
  OrchestrationRequest,
  OrchestrationResult,
  ChatMessage,
} from "@/types/orchestration"
import { getProvider } from "@/ai/providers"
import { routeRequest, containsImageContent } from "./router"
import { withRetry } from "./retry"
import { recordSuccess, recordFailure } from "./health"
import { getCachedResponse, setCachedResponse } from "@/ai/cache/response"

function ensureMultimodalModel(
  model: any,
  fallbackChain: any[],
  hasImage: boolean
): any {
  if (!hasImage) return model

  if (model.capabilities.includes("multimodal")) {
    return model
  }

  for (const fallback of fallbackChain) {
    if (fallback.capabilities.includes("multimodal")) {
      return fallback
    }
  }

  return model
}

async function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const { modelRegistry } = await import("@/ai/models/registry")
  const model = modelRegistry.models.get(modelId)
  if (!model) return 0

  return (
    (inputTokens / 1_000_000) * model.inputCostPerMillion +
    (outputTokens / 1_000_000) * model.outputCostPerMillion
  )
}

export async function orchestrate(
  request: OrchestrationRequest
): Promise<OrchestrationResult> {
  const startTime = Date.now()
  const provider = getProvider()

  const fullInput = request.messages.map((m) => m.content).join(" ")
  const hasImageContent = containsImageContent(fullInput)
  const routing = routeRequest(fullInput, request.capability)

  let currentModel = ensureMultimodalModel(
    routing.selectedModel,
    routing.fallbackChain,
    hasImageContent
  )
  let fallbackIndex = 0
  let retries = 0
  let lastError: Error | null = null

  while (true) {
    try {
      const result = await withRetry(
        async () => {
          const response = await provider.complete(currentModel, request.messages, {
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            abortSignal: request.abortSignal,
          })

          const latency = Date.now() - startTime
          const cost = await estimateCost(
            currentModel.id,
            response.usage.promptTokens,
            response.usage.completionTokens
          )

          recordSuccess(
            currentModel.id,
            latency,
            response.usage.promptTokens,
            response.usage.completionTokens,
            cost
          )

          return {
            response: response.content,
            model: currentModel,
            tokens: {
              input: response.usage.promptTokens,
              output: response.usage.completionTokens,
              total: response.usage.totalTokens,
            },
            cost,
            latency,
            retries,
            isFallback: fallbackIndex > 0,
          }
        },
        { maxRetries: 2 }
      )

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const latency = Date.now() - startTime
      recordFailure(currentModel.id, latency)
      retries++

      const fallbacks = routing.fallbackChain
      if (fallbackIndex < fallbacks.length) {
        currentModel = fallbacks[fallbackIndex]
        fallbackIndex++
        continue
      }

      throw new Error(
        `All models failed. Last error: ${lastError.message}`
      )
    }
  }
}

export async function orchestrateStream(
  request: OrchestrationRequest,
  onChunk: (chunk: string) => void,
  onComplete: (result: OrchestrationResult) => void,
  onError: (error: Error) => void
): Promise<void> {
  const startTime = Date.now()
  const provider = getProvider()

  const fullInput = request.messages.map((m) => m.content).join(" ")
  const hasImageContent = containsImageContent(fullInput)
  const routing = routeRequest(fullInput, request.capability)

  let currentModel = ensureMultimodalModel(
    routing.selectedModel,
    routing.fallbackChain,
    hasImageContent
  )
  let fallbackIndex = 0
  let retries = 0
  let fullContent = ""
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

  async function tryStream(model: typeof currentModel): Promise<boolean> {
    try {
      const stream = provider.streamComplete(model, request.messages, {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        abortSignal: request.abortSignal,
      })

      for await (const chunk of stream) {
        if (chunk.done) {
          usage = chunk.usage
          break
        }
        if (chunk.content) {
          fullContent += chunk.content
          onChunk(chunk.content)
        }
      }

      const latency = Date.now() - startTime
      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0
      const cost = await estimateCost(model.id, inputTokens, outputTokens)

      recordSuccess(model.id, latency, inputTokens, outputTokens, cost)

      onComplete({
        response: fullContent,
        model,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: usage?.totalTokens ?? 0,
        },
        cost,
        latency,
        retries,
        isFallback: fallbackIndex > 0,
      })

      return true
    } catch (error) {
      const latency = Date.now() - startTime
      recordFailure(model.id, latency)
      retries++
      return false
    }
  }

  let success = await tryStream(currentModel)

  while (!success) {
    const fallbacks = routing.fallbackChain
    if (fallbackIndex < fallbacks.length) {
      currentModel = fallbacks[fallbackIndex]
      fallbackIndex++
      success = await tryStream(currentModel)
    } else {
      onError(
        new Error("All models failed for streaming")
      )
      return
    }
  }
}
