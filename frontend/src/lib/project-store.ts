/**
 * localStorage persistence for the current project + chat transcript.
 * The server is stateless; this is the single source of truth.
 */

export type MessageKind = "chat" | "build" | "error"

export interface StoredMessage {
  role: "user" | "assistant"
  content: string
  kind: MessageKind
  meta?: {
    intent?: string
    model?: string
    latency?: number
    filePaths?: string[]
    fallbackUsed?: boolean
    repairAttempts?: number
  }
}

export interface StoredProject {
  id: string
  name: string
  files: Record<string, string>
  updatedAt: number
}

export interface StoredState {
  version: 1
  project: StoredProject | null
  chat: StoredMessage[]
}

const KEY = "forge:project:v1"
const SAVE_DEBOUNCE_MS = 400

export function loadState(): StoredState {
  if (typeof window === "undefined") return emptyState()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return emptyState()
    return {
      version: 1,
      project:
        parsed.project && typeof parsed.project.files === "object"
          ? {
              id: String(parsed.project.id ?? "project"),
              name: String(parsed.project.name ?? "Forge App"),
              files: parsed.project.files,
              updatedAt: Number(parsed.project.updatedAt ?? Date.now()),
            }
          : null,
      chat: Array.isArray(parsed.chat) ? parsed.chat : [],
    }
  } catch {
    return emptyState()
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function saveState(state: StoredState): void {
  if (typeof window === "undefined") return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // quota exceeded — drop oldest chat messages and retry once
      try {
        const trimmed = { ...state, chat: state.chat.slice(-20) }
        window.localStorage.setItem(KEY, JSON.stringify(trimmed))
      } catch {
        // give up silently
      }
    }
  }, SAVE_DEBOUNCE_MS)
}

export function clearState(): void {
  if (typeof window === "undefined") return
  if (saveTimer) clearTimeout(saveTimer)
  window.localStorage.removeItem(KEY)
}

export function emptyState(): StoredState {
  return { version: 1, project: null, chat: [] }
}
