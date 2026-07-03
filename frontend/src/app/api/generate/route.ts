import { NextRequest } from "next/server"
import { runPipeline } from "@/engine/pipeline"
import type { GenerateRequest } from "@/engine/types"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Stateless generation endpoint. The client sends the full project state and
 * chat history; the pipeline streams engine events back over SSE.
 */
export async function POST(request: NextRequest) {
  let body: GenerateRequest
  try {
    const raw = await request.json()
    if (typeof raw?.message !== "string" || !raw.message.trim()) {
      return Response.json({ error: "message is required" }, { status: 400 })
    }
    body = {
      message: raw.message,
      history: Array.isArray(raw.history)
        ? raw.history
            .filter(
              (t: { role?: string; content?: string }) =>
                (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string"
            )
            .map((t: { role: "user" | "assistant"; content: string }) => ({
              role: t.role,
              content: t.content,
            }))
        : [],
      files:
        raw.files && typeof raw.files === "object" && !Array.isArray(raw.files)
          ? sanitizeFiles(raw.files)
          : null,
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      try {
        for await (const event of runPipeline(body, request.signal)) {
          send(event)
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "Generation failed unexpectedly",
            recoverable: true,
          })
        }
      } finally {
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch {
          // client already disconnected
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

const MAX_TOTAL_BYTES = 2_000_000

function sanitizeFiles(raw: Record<string, unknown>): Record<string, string> | null {
  const out: Record<string, string> = {}
  let total = 0
  for (const [path, content] of Object.entries(raw)) {
    if (typeof content !== "string") continue
    if (path.includes("..") || path.length > 200) continue
    total += content.length
    if (total > MAX_TOTAL_BYTES) break
    out[path] = content
  }
  return Object.keys(out).length > 0 ? out : null
}
