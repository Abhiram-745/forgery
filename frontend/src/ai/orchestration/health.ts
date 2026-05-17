import type { HealthStatus, CostRecord, LatencyRecord } from "@/types/orchestration"
import { modelRegistry } from "@/ai/models/registry"

const healthMap = new Map<string, HealthStatus>()
const costRecords: CostRecord[] = []
const latencyRecords: LatencyRecord[] = []

function initHealthTracking(): void {
  for (const model of modelRegistry.getAll()) {
    healthMap.set(model.id, {
      modelId: model.id,
      isHealthy: true,
      lastChecked: 0,
      latency: 0,
      errorRate: 0,
      consecutiveFailures: 0,
    })
  }
}

export function recordSuccess(
  modelId: string,
  latency: number,
  inputTokens: number,
  outputTokens: number,
  cost: number
): void {
  const health = healthMap.get(modelId)
  if (!health) return

  health.isHealthy = true
  health.lastChecked = Date.now()
  health.latency = latency
  health.consecutiveFailures = 0
  health.errorRate = Math.max(0, health.errorRate * 0.9)

  costRecords.push({
    modelId,
    inputTokens,
    outputTokens,
    cost,
    timestamp: Date.now(),
  })

  latencyRecords.push({
    modelId,
    latency,
    timestamp: Date.now(),
  })
}

export function recordFailure(modelId: string, latency: number): void {
  const health = healthMap.get(modelId)
  if (!health) return

  health.lastChecked = Date.now()
  health.latency = latency
  health.consecutiveFailures += 1
  health.errorRate = Math.min(1, health.errorRate + 0.2)

  if (health.consecutiveFailures >= 3) {
    health.isHealthy = false
  }
}

export function getHealthStatus(modelId: string): HealthStatus | null {
  return healthMap.get(modelId) ?? null
}

export function getAllHealthStatuses(): HealthStatus[] {
  return Array.from(healthMap.values())
}

export function getTotalCost(): number {
  return costRecords.reduce((sum, record) => sum + record.cost, 0)
}

export function getCostRecords(): CostRecord[] {
  return [...costRecords]
}

export function getAverageLatency(modelId?: string): number {
  const records = modelId
    ? latencyRecords.filter((r) => r.modelId === modelId)
    : latencyRecords

  if (records.length === 0) return 0
  return records.reduce((sum, r) => sum + r.latency, 0) / records.length
}

export function getHealthyModels(): string[] {
  return Array.from(healthMap.entries())
    .filter(([, health]) => health.isHealthy)
    .map(([modelId]) => modelId)
}

export function getModelScore(modelId: string): number {
  const health = healthMap.get(modelId)
  if (!health) return 0

  const healthScore = health.isHealthy ? 100 : 0
  const latencyScore = Math.max(0, 100 - health.latency / 10)
  const errorScore = (1 - health.errorRate) * 100
  const freshnessScore = health.lastChecked > 0 ? 50 : 0

  return (healthScore + latencyScore + errorScore + freshnessScore) / 4
}

initHealthTracking()
