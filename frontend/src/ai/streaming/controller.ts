import type { StreamController, StreamHandler } from "@/types/streaming"

export function createStreamController(): StreamController {
  const controller = new AbortController()

  return {
    abort: () => controller.abort(),
    signal: controller.signal,
  }
}

export async function processStream(
  stream: AsyncIterable<string>,
  controller: StreamController,
  handler: StreamHandler
): Promise<void> {
  let fullResponse = ""

  try {
    for await (const chunk of stream) {
      if (controller.signal.aborted) {
        handler.onAbort()
        return
      }

      fullResponse += chunk
      handler.onChunk(chunk)
    }

    handler.onComplete(fullResponse)
  } catch (error) {
    if (controller.signal.aborted) {
      handler.onAbort()
    } else {
      handler.onError(
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }
}

export function createStreamHandler(
  callbacks: Partial<StreamHandler>
): StreamHandler {
  return {
    onChunk: callbacks.onChunk ?? (() => {}),
    onComplete: callbacks.onComplete ?? (() => {}),
    onError: callbacks.onError ?? ((error) => console.error("Stream error:", error)),
    onAbort: callbacks.onAbort ?? (() => {}),
  }
}
