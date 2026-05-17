import type {
  ConversationContext,
  ContextManager,
  CreateContextParams,
  Message,
} from "@/types/context"
import { estimateTokenCount, estimateMessageTokens } from "./tokens"

const contextStore = new Map<string, ConversationContext>()

const DEFAULT_SYSTEM_PROMPT = `You are Forge AI, an expert full-stack developer and coding assistant. You excel at:

- Writing clean, production-ready code
- Building React, Next.js, and full-stack applications
- Debugging complex issues
- Architecting scalable systems
- Explaining technical concepts clearly

Guidelines:
- Always provide complete, working code
- Use modern best practices
- Consider edge cases
- Write maintainable, well-structured code
- Be concise but thorough
- When generating UI, use Tailwind CSS
- Follow TypeScript best practices
- Prefer functional patterns where appropriate`

function generateId(): string {
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function createContext(params: CreateContextParams): ConversationContext {
  const id = params.id ?? generateId()
  const messages = params.initialMessages ?? []
  const systemPrompt = params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
  const tokenBudget = params.tokenBudget ?? 8000
  const capability = params.capability ?? "general"

  const currentTokenUsage = estimateMessageTokens(messages)

  const context: ConversationContext = {
    id,
    messages,
    systemPrompt,
    capability,
    tokenBudget,
    currentTokenUsage,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  contextStore.set(id, context)
  return context
}

function addMessage(contextId: string, message: Message): ConversationContext {
  const context = contextStore.get(contextId)
  if (!context) {
    throw new Error(`Context ${contextId} not found`)
  }

  message.tokenCount = estimateTokenCount(message.content)
  context.messages.push(message)
  context.currentTokenUsage = estimateMessageTokens(context.messages)
  context.updatedAt = Date.now()

  contextStore.set(contextId, context)
  return context
}

function getMessages(contextId: string): Message[] {
  const context = contextStore.get(contextId)
  return context?.messages ?? []
}

function getContext(contextId: string): ConversationContext | null {
  return contextStore.get(contextId) ?? null
}

function trimContext(contextId: string, maxTokens: number): ConversationContext {
  const context = contextStore.get(contextId)
  if (!context) {
    throw new Error(`Context ${contextId} not found`)
  }

  const systemMessage = context.messages.find((m) => m.role === "system")
  const nonSystemMessages = context.messages.filter((m) => m.role !== "system")

  let currentTokens = systemMessage
    ? estimateTokenCount(systemMessage.content)
    : 0

  const trimmed: Message[] = systemMessage ? [systemMessage] : []

  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msg = nonSystemMessages[i]
    const msgTokens = estimateTokenCount(msg.content) + 4

    if (currentTokens + msgTokens <= maxTokens) {
      trimmed.unshift(msg)
      currentTokens += msgTokens
    } else {
      break
    }
  }

  context.messages = trimmed
  context.currentTokenUsage = currentTokens
  context.updatedAt = Date.now()

  contextStore.set(contextId, context)
  return context
}

async function summarize(contextId: string): Promise<ConversationContext> {
  const context = contextStore.get(contextId)
  if (!context) {
    throw new Error(`Context ${contextId} not found`)
  }

  const messagesToSummarize = context.messages.filter(
    (m) => m.role !== "system"
  )

  if (messagesToSummarize.length <= 4) {
    return context
  }

  const earlyMessages = messagesToSummarize.slice(0, 2)
  const recentMessages = messagesToSummarize.slice(-4)

  const summaryContent = `[Summary of ${messagesToSummarize.length - 6} exchanged messages covering the conversation history]`

  const summaryMessage: Message = {
    role: "assistant",
    content: summaryContent,
    timestamp: Date.now(),
    tokenCount: estimateTokenCount(summaryContent),
  }

  context.messages = [
    ...(context.messages.find((m) => m.role === "system")
      ? [context.messages.find((m) => m.role === "system")!]
      : []),
    ...earlyMessages,
    summaryMessage,
    ...recentMessages,
  ]

  context.currentTokenUsage = estimateMessageTokens(context.messages)
  context.updatedAt = Date.now()

  contextStore.set(contextId, context)
  return context
}

function getTokenCount(contextId: string): number {
  const context = contextStore.get(contextId)
  return context?.currentTokenUsage ?? 0
}

function clear(contextId: string): void {
  contextStore.delete(contextId)
}

export const contextManager: ContextManager = {
  create: createContext,
  addMessage,
  getMessages,
  getContext,
  trimContext,
  summarize,
  getTokenCount,
  clear,
}
