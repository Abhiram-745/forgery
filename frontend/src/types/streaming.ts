export interface StreamingChunk {
  content: string
  done: boolean
  model?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface StreamController {
  abort: () => void
  signal: AbortSignal
}

export interface StreamHandler {
  onChunk: (chunk: string) => void
  onComplete: (fullResponse: string, usage?: StreamingChunk["usage"]) => void
  onError: (error: Error) => void
  onAbort: () => void
}

export interface StreamManager {
  createStream: (handler: StreamHandler) => StreamController
  streamResponse: (
    stream: AsyncIterable<string>,
    controller: StreamController,
    handler: StreamHandler
  ) => Promise<void>
}
