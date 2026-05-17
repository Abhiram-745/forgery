import type { ModelCapability, ModelDefinition } from "@/types/models"
import { modelRegistry } from "@/ai/models/registry"
import type { RoutingDecision } from "@/types/orchestration"

const CAPABILITY_KEYWORDS: Record<ModelCapability, string[]> = {
  coding: [
    "code",
    "function",
    "component",
    "api",
    "endpoint",
    "database",
    "schema",
    "implement",
    "build",
    "create",
    "typescript",
    "javascript",
    "python",
    "react",
    "next.js",
    "tailwind",
    "css",
    "html",
    "bug",
    "error",
    "fix",
    "refactor",
    "optimize",
    "algorithm",
    "data structure",
    "testing",
    "unit test",
    "integration",
    "deployment",
    "server",
    "backend",
    "frontend",
    "fullstack",
  ],
  reasoning: [
    "explain",
    "why",
    "how does",
    "analyze",
    "compare",
    "evaluate",
    "think",
    "reason",
    "logic",
    "decision",
    "strategy",
    "approach",
    "pros and cons",
    "trade-off",
    "architecture",
    "design pattern",
    "best practice",
    "should i",
    "which is better",
  ],
  creative: [
    "design",
    "creative",
    "generate",
    "write",
    "story",
    "content",
    "copy",
    "marketing",
    "brand",
    "name",
    "idea",
    "brainstorm",
    "inspiration",
    "visual",
    "aesthetic",
    "beautiful",
    "stunning",
    "modern",
    "minimal",
  ],
  frontend: [
    "ui",
    "component",
    "react",
    "vue",
    "angular",
    "tailwind",
    "css",
    "style",
    "layout",
    "responsive",
    "animation",
    "interactive",
    "button",
    "form",
    "modal",
    "navigation",
    "dashboard",
    "page",
    "landing",
    "hero",
    "card",
    "table",
    "chart",
  ],
  debugging: [
    "debug",
    "error",
    "bug",
    "not working",
    "broken",
    "issue",
    "problem",
    "fix",
    "troubleshoot",
    "stack trace",
    "exception",
    "crash",
    "fail",
    "wrong output",
    "unexpected",
    "why is",
  ],
  architecture: [
    "architecture",
    "structure",
    "design",
    "system",
    "pattern",
    "microservice",
    "monolith",
    "scalable",
    "performance",
    "optimization",
    "infrastructure",
    "database design",
    "api design",
    "folder structure",
    "project structure",
    "organize",
    "modular",
    "clean code",
  ],
  general: [],
  multimodal: [
    "image",
    "photo",
    "picture",
    "vision",
    "see",
    "describe",
    "visual",
    "diagram",
    "screenshot",
  ],
}

function detectCapability(input: string): ModelCapability {
  const lowerInput = input.toLowerCase()
  const scores: Record<ModelCapability, number> = {
    coding: 0,
    reasoning: 0,
    creative: 0,
    frontend: 0,
    debugging: 0,
    architecture: 0,
    general: 0,
    multimodal: 0,
  }

  for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword)) {
        scores[capability as ModelCapability] += 1
      }
    }
  }

  let maxScore = 0
  let detectedCapability: ModelCapability = "general"

  for (const [capability, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      detectedCapability = capability as ModelCapability
    }
  }

  return detectedCapability
}

export function routeRequest(
  input: string,
  explicitCapability?: ModelCapability
): RoutingDecision {
  const capability = explicitCapability ?? detectCapability(input)
  const primary = modelRegistry.getPrimary(capability)
  const fallbacks = modelRegistry.getFallbacks(capability)

  return {
    selectedModel: primary,
    reason: `Selected ${primary.name} for ${capability} task`,
    capability,
    fallbackChain: fallbacks,
    timestamp: Date.now(),
  }
}

export { detectCapability }
