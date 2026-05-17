import { useState, useCallback, useRef } from "react"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface ChatResult {
  response: string
  contextId: string
  tokens: {
    input: number
    output: number
    total: number
  }
  cost: number
  latency: number
  model: string
  isFallback: boolean
}

interface UseChatOptions {
  apiEndpoint?: string
  systemPrompt?: string
  capability?: string
  temperature?: number
  maxTokens?: number
  onChunk?: (chunk: string) => void
  onComplete?: (result: ChatResult) => void
  onError?: (error: Error) => void
}

export function useChat(options: UseChatOptions = {}) {
  const {
    apiEndpoint = "/api/chat",
    systemPrompt,
    capability,
    temperature = 0.7,
    maxTokens,
    onChunk,
    onComplete,
    onError,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [contextId, setContextId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return

      setIsLoading(true)
      setError(null)

      const userMessage: ChatMessage = { role: "user", content }
      setMessages((prev) => [...prev, userMessage])

      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            contextId,
            systemPrompt,
            capability,
            temperature,
            maxTokens,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""
        let fullResponse = ""
        let result: ChatResult | null = null

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === "data: [DONE]") continue
            if (!trimmed.startsWith("data: ")) continue

            try {
              const data = JSON.parse(trimmed.slice(6))

              if (data.type === "chunk") {
                fullResponse += data.content
                onChunk?.(data.content)
              } else if (data.type === "complete") {
                result = {
                  response: data.response,
                  contextId: data.contextId,
                  tokens: data.tokens,
                  cost: data.cost,
                  latency: data.latency,
                  model: data.model,
                  isFallback: data.isFallback,
                }
                setContextId(data.contextId)
              } else if (data.type === "error") {
                throw new Error(data.error)
              }
            } catch {
              continue
            }
          }
        }

        if (fullResponse) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullResponse },
          ])
        }

        if (result) {
          onComplete?.(result)
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred"

        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }

        setError(message)
        onError?.(err instanceof Error ? err : new Error(message))
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [
      isLoading,
      apiEndpoint,
      contextId,
      systemPrompt,
      capability,
      temperature,
      maxTokens,
      onChunk,
      onComplete,
      onError,
    ]
  )

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    setMessages([])
    setContextId(null)
    setError(null)
    stop()
  }, [stop])

  return {
    messages,
    isLoading,
    contextId,
    error,
    sendMessage,
    stop,
    clear,
  }
}
