import { NextResponse } from "next/server"
import {
  getAllHealthStatuses,
  getTotalCost,
  getCostRecords,
  getAverageLatency,
  getHealthyModels,
  getModelScore,
} from "@/ai/orchestration/health"
import { modelRegistry } from "@/ai/models/registry"
import { getProvider } from "@/ai/providers"

export async function GET() {
  try {
    const healthStatuses = getAllHealthStatuses()
    const totalCost = getTotalCost()
    const avgLatency = getAverageLatency()
    const healthyModels = getHealthyModels()
    const costRecords = getCostRecords()

    const modelScores = modelRegistry.getAll().map((model) => ({
      id: model.id,
      name: model.name,
      score: getModelScore(model.id),
      capabilities: model.capabilities,
      tier: model.tier,
    }))

    return NextResponse.json({
      status: "healthy",
      timestamp: Date.now(),
      models: {
        total: modelRegistry.getAll().length,
        free: modelRegistry.getFreeModels().length,
        healthy: healthyModels.length,
        scores: modelScores,
      },
      performance: {
        averageLatency: Math.round(avgLatency),
        totalCost,
        totalRequests: costRecords.length,
      },
      health: healthStatuses.map((h) => ({
        modelId: h.modelId,
        isHealthy: h.isHealthy,
        latency: h.latency,
        errorRate: Math.round(h.errorRate * 100),
        consecutiveFailures: h.consecutiveFailures,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get("modelId")

    if (!modelId) {
      return NextResponse.json(
        { error: "modelId is required" },
        { status: 400 }
      )
    }

    const model = modelRegistry.models.get(modelId)
    if (!model) {
      return NextResponse.json(
        { error: `Model ${modelId} not found` },
        { status: 404 }
      )
    }

    const provider = getProvider()
    const health = await provider.checkHealth(model)

    return NextResponse.json({
      modelId,
      isHealthy: health.isHealthy,
      latency: health.latency,
      timestamp: Date.now(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 500 }
    )
  }
}
