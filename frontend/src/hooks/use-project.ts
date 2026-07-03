"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  loadState,
  saveState,
  clearState,
  emptyState,
  type StoredMessage,
  type StoredProject,
  type StoredState,
} from "@/lib/project-store"
import { downloadProjectZip } from "@/lib/zip"

/**
 * Client state for the vibecoding workspace. Sends the full project + history
 * to the stateless /api/generate endpoint, consumes its SSE event stream, and
 * persists everything to localStorage.
 */

export interface EngineProgress {
  statusMessage: string | null
  streamingChat: string
  /** Paths written so far in the current generation. */
  streamingFiles: string[]
}

export function useProject() {
  const [project, setProject] = useState<StoredProject | null>(null)
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<EngineProgress>({
    statusMessage: null,
    streamingChat: "",
    streamingFiles: [],
  })
  /** Bumped on every CREATE so the Sandpack provider remounts fresh. */
  const [generationId, setGenerationId] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const state = loadState()
    setProject(state.project)
    setMessages(state.chat)
    if (state.project) setGenerationId(1)
    setHydrated(true)
  }, [])

  // Persist on change (debounced inside saveState).
  useEffect(() => {
    if (!hydrated) return
    const state: StoredState = { version: 1, project, chat: messages }
    saveState(state)
  }, [project, messages, hydrated])

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading || !content.trim()) return
      setIsLoading(true)
      setError(null)
      setProgress({ statusMessage: "Sending…", streamingChat: "", streamingFiles: [] })

      const userMessage: StoredMessage = { role: "user", content, kind: "chat" }
      const history = [...messages, userMessage]
      setMessages(history)

      abortRef.current = new AbortController()
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
            files: project?.files ?? null,
          }),
          signal: abortRef.current.signal,
        })
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error ?? `Request failed (${response.status})`)
        }
        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""
        let chatText = ""
        const writtenPaths: string[] = []
        let completed = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue
            let event: Record<string, unknown>
            try {
              event = JSON.parse(trimmed.slice(6))
            } catch {
              continue
            }

            switch (event.type) {
              case "status":
                setProgress((p) => ({ ...p, statusMessage: String(event.message) }))
                break
              case "chat_chunk":
                chatText += String(event.content)
                setProgress((p) => ({
                  ...p,
                  statusMessage: null,
                  streamingChat: chatText,
                }))
                break
              case "file":
                if (!writtenPaths.includes(String(event.path))) {
                  writtenPaths.push(String(event.path))
                }
                setProgress((p) => ({ ...p, streamingFiles: [...writtenPaths] }))
                break
              case "complete": {
                completed = true
                const intent = String(event.intent)
                if (intent === "CHAT") {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: chatText || String(event.summary ?? ""),
                      kind: "chat",
                      meta: {
                        intent,
                        model: String(event.model ?? ""),
                        latency: Number(event.latency ?? 0),
                      },
                    },
                  ])
                } else {
                  const files = event.files as Record<string, string> | null
                  if (files) {
                    setProject((prev) => ({
                      id: prev?.id ?? `p_${Date.now().toString(36)}`,
                      name:
                        intent === "CREATE"
                          ? nameFromFiles(files) ?? prev?.name ?? "Forge App"
                          : prev?.name ?? nameFromFiles(files) ?? "Forge App",
                      files,
                      updatedAt: Date.now(),
                    }))
                    if (intent === "CREATE") setGenerationId((g) => g + 1)
                  }
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: String(event.summary ?? "Done."),
                      kind: "build",
                      meta: {
                        intent,
                        model: String(event.model ?? ""),
                        latency: Number(event.latency ?? 0),
                        filePaths: writtenPaths,
                        fallbackUsed: Boolean(event.fallbackUsed),
                        repairAttempts: Number(event.repairAttempts ?? 0),
                      },
                    },
                  ])
                }
                break
              }
              case "error": {
                completed = true
                const msg = String(event.message ?? "Generation failed")
                setError(msg)
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: msg, kind: "error" },
                ])
                break
              }
            }
          }
        }

        if (!completed && chatText) {
          // Stream ended without a complete event (rare) — keep the text.
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: chatText, kind: "chat" },
          ])
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user pressed stop — drop the in-flight turn quietly
        } else {
          const msg = err instanceof Error ? err.message : "Something went wrong"
          setError(msg)
          setMessages((prev) => [...prev, { role: "assistant", content: msg, kind: "error" }])
        }
      } finally {
        setIsLoading(false)
        setProgress({ statusMessage: null, streamingChat: "", streamingFiles: [] })
        abortRef.current = null
      }
    },
    [isLoading, messages, project]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    stop()
    clearState()
    const fresh = emptyState()
    setProject(fresh.project)
    setMessages(fresh.chat)
    setError(null)
    setGenerationId(0)
  }, [stop])

  const downloadZip = useCallback(async () => {
    if (!project) return
    await downloadProjectZip(project.files, project.name)
  }, [project])

  return {
    project,
    messages,
    isLoading,
    error,
    progress,
    generationId,
    hydrated,
    sendMessage,
    stop,
    reset,
    downloadZip,
  }
}

function nameFromFiles(files: Record<string, string>): string | null {
  try {
    const pkg = JSON.parse(files["package.json"] ?? "")
    if (typeof pkg?.name === "string" && pkg.name) {
      return pkg.name
        .split("-")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    }
  } catch {
    // ignore
  }
  return null
}
