/**
 * Core types for the Forge generation engine.
 *
 * The engine is fully stateless on the server: every request carries the
 * complete project file map and chat history, and every response returns the
 * complete merged file map. Persistence lives in the browser (localStorage).
 */

export type Intent = "CHAT" | "CREATE" | "EDIT"

export type FileMap = Record<string, string>

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface GenerateRequest {
  message: string
  history: ChatTurn[]
  /** Current project files, or null when no project exists yet. */
  files: FileMap | null
}

/** Events streamed over SSE from /api/generate. */
export type EngineEvent =
  | { type: "status"; message: string; stage: Stage }
  | { type: "intent"; intent: Intent }
  | { type: "chat_chunk"; content: string }
  | { type: "file"; path: string; content: string }
  | {
      type: "complete"
      intent: Intent
      /** Full merged file map after this turn (null for CHAT). */
      files: FileMap | null
      deletedPaths: string[]
      summary: string
      model: string
      latency: number
      repairAttempts: number
      fallbackUsed: boolean
    }
  | { type: "error"; message: string; recoverable: boolean }

export type Stage =
  | "intent"
  | "chat"
  | "architect"
  | "scaffold"
  | "generate"
  | "validate"
  | "repair"
  | "done"

/** A single parsed file operation from model output. */
export interface FileOp {
  op: "write" | "delete"
  path: string
  content: string
}

export interface ParsedOutput {
  summary: string
  ops: FileOp[]
}

/** Architect pass output. */
export interface Manifest {
  appName: string
  files: { path: string; purpose: string }[]
  npmDeps: Record<string, string>
}

export interface ValidationIssue {
  path: string
  message: string
  /** Short excerpt around the error location, when available. */
  excerpt?: string
  fatal: boolean
}

/** Options for a single model completion call. */
export interface CompletionOptions {
  system: string
  messages: ChatTurn[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface CompletionResult {
  text: string
  model: string
}

/** Provider abstraction: real OpenRouter client or the offline mock. */
export interface Provider {
  /** Non-streaming completion. */
  complete(model: string, opts: CompletionOptions): Promise<CompletionResult>
  /** Streaming completion; yields text deltas. */
  stream(model: string, opts: CompletionOptions): AsyncGenerator<string, void, void>
}

export class RateLimitedError extends Error {
  retryAfterMs?: number
  constructor(message: string, retryAfterMs?: number) {
    super(message)
    this.name = "RateLimitedError"
    this.retryAfterMs = retryAfterMs
  }
}

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModelUnavailableError"
  }
}

export class ProviderError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "ProviderError"
    this.status = status
  }
}
