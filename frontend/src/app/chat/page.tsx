"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/lib/auth"
import { useChat } from "@/hooks/use-chat"
import {
  Send,
  Loader2,
  Trash2,
  LogOut,
  Sparkles,
  Bot,
  User as UserIcon,
  Square,
} from "lucide-react"

function ChatInner() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [input, setInput] = useState("")
  const [streamingText, setStreamingText] = useState("")
  const [modelInfo, setModelInfo] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, isLoading, error, sendMessage, stop, clear } = useChat({
    apiEndpoint: "/api/chat",
    onChunk: (chunk) => {
      setStreamingText((prev) => prev + chunk)
    },
    onComplete: (result) => {
      setStreamingText("")
      setModelInfo(`${result.model} · ${result.tokens.total} tokens · ${result.latency}ms`)
    },
    onError: () => {
      setStreamingText("")
    },
  })

  // auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // textarea auto-resize
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput("")
    setStreamingText("")
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = () => {
    clear()
    setStreamingText("")
    setModelInfo(null)
  }

  const handleLogout = () => {
    logout()
    router.replace("/")
  }

  const suggestions = [
    "Explain async/await in JavaScript",
    "Write a React useDebounce hook",
    "Refactor this code for performance",
    "What is the difference between SQL and NoSQL?",
  ]

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card/40 backdrop-blur-sm px-4 sm:px-6 py-3 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs">
            F
          </div>
          <span className="font-semibold text-sm sm:text-base">Forge AI</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[180px]">
            {user?.email}
          </span>
          <button
            onClick={handleClear}
            className="forge-button-ghost h-8 px-3 text-xs gap-1.5"
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            onClick={handleLogout}
            className="forge-button-ghost h-8 px-3 text-xs gap-1.5"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {messages.length === 0 && !streamingText && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
                <Sparkles className="h-3 w-3" />
                Powered by OpenRouter free models
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-3">
                How can I help you today?
              </h2>
              <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
                Ask anything about code, get explanations, debug issues, or brainstorm ideas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {suggestions.map((s) => (
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

          <div className="space-y-6">
            {messages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role} content={m.content} />
            ))}

            {streamingText && (
              <MessageBubble role="assistant" content={streamingText} streaming />
            )}

            {isLoading && !streamingText && (
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-md border border-border bg-card flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:200ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:400ms]" />
                </div>
              </div>
            )}

            {error && (
              <div className="forge-panel border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
                <p className="font-medium mb-1">Error</p>
                <p className="text-red-300/80">{error}</p>
              </div>
            )}

            {modelInfo && !isLoading && (
              <div className="text-[10px] text-muted-foreground/70 font-mono text-center">
                {modelInfo}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card/40 backdrop-blur-sm shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message... (Shift+Enter for newline)"
              rows={1}
              disabled={isLoading}
              className="forge-input w-full resize-none pr-12 py-3 min-h-[48px] leading-relaxed"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={stop}
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
            Forge AI auto-selects the best free model for your request. Responses may vary.
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  streaming = false,
}: {
  role: "user" | "assistant" | "system"
  content: string
  streaming?: boolean
}) {
  const isUser = role === "user"
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
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
          {content}
          {streaming && (
            <span className="inline-block h-3.5 w-1.5 bg-foreground ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatInner />
    </AuthGuard>
  )
}
