import { NextRequest, NextResponse } from "next/server"
import { orchestrate, orchestrateStream, contextManager, getDefaultPrompt } from "@/ai"
import type { Message } from "@/types/context"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      message,
      contextId,
      systemPrompt,
      capability,
      temperature = 0.7,
      maxTokens,
      stream = true,
    } = body

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    let ctx = contextId ? contextManager.getContext(contextId) : null

    if (!ctx) {
      const prompt = systemPrompt ?? getDefaultPrompt(capability ?? "general")
      ctx = contextManager.create({
        systemPrompt: prompt.template,
        capability,
      })
    }

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: Date.now(),
    }

    contextManager.addMessage(ctx.id, userMessage)

    const messages = ctx.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const abortController = new AbortController()

    request.signal.addEventListener("abort", () => {
      abortController.abort()
    })

    if (stream) {
      const encoder = new TextEncoder()
      const stream = new TransformStream()
      const writer = stream.writable.getWriter()

      orchestrateStream(
        {
          messages,
          systemPrompt: ctx.systemPrompt,
          capability: ctx.capability,
          temperature,
          maxTokens,
          abortSignal: abortController.signal,
        },
        (chunk) => {
          writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`)
          )
        },
        (result) => {
          const assistantMessage: Message = {
            role: "assistant",
            content: result.response,
            timestamp: Date.now(),
            tokenCount: result.tokens.output,
          }
          contextManager.addMessage(ctx!.id, assistantMessage)

          writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                response: result.response,
                contextId: ctx!.id,
                tokens: result.tokens,
                cost: result.cost,
                latency: result.latency,
                model: result.model.name,
                isFallback: result.isFallback,
              })}\n\n`
            )
          )
          writer.write(encoder.encode("data: [DONE]\n\n"))
          writer.close()
        },
        (error) => {
          writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error.message,
              })}\n\n`
            )
          )
          writer.write(encoder.encode("data: [DONE]\n\n"))
          writer.close()
        }
      )

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    } else {
      const result = await orchestrate({
        messages,
        systemPrompt: ctx.systemPrompt,
        capability: ctx.capability,
        temperature,
        maxTokens,
        abortSignal: abortController.signal,
      })

      const assistantMessage: Message = {
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
        tokenCount: result.tokens.output,
      }
      contextManager.addMessage(ctx.id, assistantMessage)

      return NextResponse.json({
        response: result.response,
        contextId: ctx.id,
        tokens: result.tokens,
        cost: result.cost,
        latency: result.latency,
        model: result.model.name,
        isFallback: result.isFallback,
        retries: result.retries,
      })
    }
  } catch (error) {
    console.error("Chat API error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contextId = searchParams.get("contextId")

    if (!contextId) {
      return NextResponse.json(
        { error: "contextId is required" },
        { status: 400 }
      )
    }

    contextManager.clear(contextId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear context" },
      { status: 500 }
    )
  }
}
