"use client"

import { useEffect, useRef, useState } from "react"
import {
  Send,
  Square,
  Sparkles,
  Bot,
  User as UserIcon,
  Loader2,
  FileCode2,
  Hammer,
  AlertTriangle,
} from "lucide-react"
import type { StoredMessage } from "@/lib/project-store"

interface ChatPanelProps {
  messages: StoredMessage[]
  isLoading: boolean
  error: string | null
  statusMessage: string | null
  streamingChat: string
  streamingFiles: string[]
  composerSeed: string | null
  onSend: (message: string) => void
  onStop: () => void
}

const SUGGESTIONS = [
  "Build a todo app with dark mode",
  "Make a pomodoro timer with sounds",
  "Create a markdown note-taking app",
  "Build an expense tracker with charts",
]

export function ChatPanel({
  messages,
  isLoading,
  error,
  statusMessage,
  streamingChat,
  streamingFiles,
  composerSeed,
  onSend,
  onStop,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Pre-fill from outside (e.g. "ask Forge to fix it").
  useEffect(() => {
    if (composerSeed) {
      setInput(composerSeed)
      inputRef.current?.focus()
    }
  }, [composerSeed])

  // auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingChat, statusMessage, streamingFiles])

  // textarea auto-resize
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput("")
    onSend(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-4 py-5">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-5">
                <Sparkles className="h-3 w-3" />
                Powered by OpenRouter free models
              </div>
              <h2 className="text-2xl font-bold text-gradient mb-2 text-center">
                What do you want to build?
              </h2>
              <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
                Describe your app and Forge builds it live. Follow up to change anything.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s)
                      inputRef.current?.focus()
                    }}
                    className="forge-panel p-3 text-left text-sm hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((m, idx) => (
              <MessageBubble key={idx} message={m} />
            ))}

            {isLoading && streamingChat && (
              <MessageBubble
                message={{ role: "assistant", content: streamingChat, kind: "chat" }}
                streaming
              />
            )}

            {isLoading && !streamingChat && (
              <div className="flex gap-3 animate-fade-in">
                <div className="h-7 w-7 rounded-md border border-border bg-card flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{statusMessage ?? "Working…"}</span>
                  </div>
                  {streamingFiles.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {streamingFiles.map((p) => (
                        <div
                          key={p}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground"
                        >
                          <FileCode2 className="h-3 w-3" />
                          {p}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && !isLoading && (
              <div className="forge-panel border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card/40 backdrop-blur-sm shrink-0 px-4 py-3">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your app or a change… (Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
            className="forge-input w-full resize-none pr-12 py-3 min-h-[48px] leading-relaxed"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-md bg-secondary hover:bg-secondary/80 border border-border flex items-center justify-center transition-colors"
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Forge builds with free models and falls back automatically when one is busy.
        </p>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  streaming = false,
}: {
  message: StoredMessage
  streaming?: boolean
}) {
  const isUser = message.role === "user"
  const isBuild = message.kind === "build"
  const isError = message.kind === "error"

  return (
    <div className="flex gap-3 animate-fade-in">
      <div
        className={`h-7 w-7 rounded-md border border-border flex items-center justify-center shrink-0 ${
          isUser ? "bg-white text-black" : "bg-card text-muted-foreground"
        }`}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          {isUser ? "You" : "Forge AI"}
        </div>

        {isBuild ? (
          <div className="forge-panel p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-1.5">
              <Hammer className="h-3.5 w-3.5" />
              {message.meta?.intent === "CREATE" ? "App built" : "Changes applied"}
            </div>
            <p className="text-sm leading-relaxed text-foreground break-words">
              {message.content}
            </p>
            {message.meta?.filePaths && message.meta.filePaths.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.meta.filePaths.map((p) => (
                  <span
                    key={p}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
            {message.meta?.model && (
              <p className="mt-2 text-[10px] font-mono text-muted-foreground/70">
                {message.meta.model}
                {message.meta.fallbackUsed ? " · fallback" : ""}
                {message.meta.repairAttempts ? ` · ${message.meta.repairAttempts} auto-fix` : ""}
                {message.meta.latency ? ` · ${(message.meta.latency / 1000).toFixed(1)}s` : ""}
              </p>
            )}
          </div>
        ) : isError ? (
          <div className="forge-panel border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-words">{message.content}</span>
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {message.content}
            {streaming && (
              <span className="inline-block h-3.5 w-1.5 bg-foreground ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
