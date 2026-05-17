import { OpenRouterProvider } from "./openrouter"
import type { AIProvider } from "./base"

let cachedProvider: AIProvider | null = null

export function getProvider(): AIProvider {
  if (cachedProvider) return cachedProvider

  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required"
    )
  }

  cachedProvider = new OpenRouterProvider(apiKey)
  return cachedProvider
}

export function resetProvider(): void {
  cachedProvider = null
}

export { OpenRouterProvider }
export type { AIProvider } from "./base"
