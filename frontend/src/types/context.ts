import type { ModelCapability } from "./models"

export interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  timestamp: number
  tokenCount?: number
}

export interface ConversationContext {
  id: string
  messages: Message[]
  systemPrompt: string
  capability: ModelCapability
  tokenBudget: number
  currentTokenUsage: number
  createdAt: number
  updatedAt: number
}

export interface ContextManager {
  create: (params: CreateContextParams) => ConversationContext
  addMessage: (contextId: string, message: Message) => ConversationContext
  getMessages: (contextId: string) => Message[]
  getContext: (contextId: string) => ConversationContext | null
  trimContext: (contextId: string, maxTokens: number) => ConversationContext
  summarize: (contextId: string) => Promise<ConversationContext>
  getTokenCount: (contextId: string) => number
  clear: (contextId: string) => void
}

export interface CreateContextParams {
  id?: string
  systemPrompt?: string
  capability?: ModelCapability
  tokenBudget?: number
  initialMessages?: Message[]
}
