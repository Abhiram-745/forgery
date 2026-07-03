import type {
  ChatTurn,
  EngineEvent,
  FileMap,
  GenerateRequest,
  Intent,
  Manifest,
  Provider,
} from "./types"
import { ProviderError } from "./types"
import { getChain } from "./models"
import { getProvider } from "./provider"
import { runWithFailover, shortName } from "./failover"
import { resolveIntent } from "./intent"
import { parseModelOutput } from "./protocol"
import {
  APP_ENTRY,
  buildScaffold,
  defaultManifest,
  deriveAppName,
  addDepsToPackageJson,
} from "./scaffold"
import { validateProject } from "./validate"
import {
  ARCHITECT_SYSTEM,
  buildChatSystem,
  buildCreateSystem,
  buildEditSystem,
  buildRepairSystem,
} from "./prompts"

const MAX_REPAIR_ATTEMPTS = 2
const MAX_HISTORY_TURNS = 12

/**
 * The staged generation pipeline. Stateless: everything it needs arrives in
 * the request, everything the client needs leaves in events.
 */
export async function* runPipeline(
  req: GenerateRequest,
  signal?: AbortSignal
): AsyncGenerator<EngineEvent, void, void> {
  const provider = getProvider()
  const startedAt = Date.now()
  const history = (req.history ?? []).slice(-MAX_HISTORY_TURNS)
  const files = req.files && Object.keys(req.files).length > 0 ? req.files : null

  // ---- Stage 1: intent -------------------------------------------------------
  yield { type: "status", message: "Understanding your request…", stage: "intent" }
  const { intent } = await resolveIntent(req.message, files, history, provider, signal)
  yield { type: "intent", intent }

  if (intent === "CHAT") {
    yield* runChat(req.message, files, history, provider, startedAt, signal)
    return
  }

  if (intent === "CREATE") {
    yield* runCreate(req.message, history, provider, startedAt, signal)
    return
  }

  yield* runEdit(req.message, files!, history, provider, startedAt, signal)
}

// ---------------------------------------------------------------------------
// CHAT
// ---------------------------------------------------------------------------

async function* runChat(
  message: string,
  files: FileMap | null,
  history: ChatTurn[],
  provider: Provider,
  startedAt: number,
  signal?: AbortSignal
): AsyncGenerator<EngineEvent, void, void> {
  const lastSummary = lastAssistantSummary(history)
  const system = buildChatSystem(files, lastSummary)

  let usedModel = ""
  let fallback = false
  const outcome = await runWithFailover(
    getChain("fast"),
    "chat",
    async (model) => {
      const chunks: string[] = []
      for await (const delta of provider.stream(model, {
        system,
        messages: [...history, { role: "user", content: message }],
        temperature: 0.6,
        maxTokens: 1024,
        signal,
      })) {
        chunks.push(delta)
      }
      return chunks
    }
  )
  usedModel = outcome.model
  fallback = outcome.fallbackUsed

  // Re-emit the collected reply as chunks (buffered per-model so a mid-stream
  // failover never shows the user half a reply from a dead model).
  for (const chunk of outcome.result) {
    yield { type: "chat_chunk", content: chunk }
  }

  yield {
    type: "complete",
    intent: "CHAT",
    files: null,
    deletedPaths: [],
    summary: outcome.result.join(""),
    model: usedModel,
    latency: Date.now() - startedAt,
    repairAttempts: 0,
    fallbackUsed: fallback,
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

async function* runCreate(
  message: string,
  history: ChatTurn[],
  provider: Provider,
  startedAt: number,
  signal?: AbortSignal
): AsyncGenerator<EngineEvent, void, void> {
  // Architect pass (skippable on failure).
  yield { type: "status", message: "Planning your app…", stage: "architect" }
  const manifest = await runArchitect(message, provider, signal)

  yield { type: "status", message: "Setting up the project…", stage: "scaffold" }
  const scaffold = buildScaffold(manifest.appName, manifest.npmDeps)

  const system = buildCreateSystem(manifest)
  const gen = generateWithProgress(
    provider,
    "generation",
    system,
    [...history, { role: "user", content: message }],
    signal
  )
  let genResult: GenerationResult | null = null
  for await (const item of gen) {
    if (item.kind === "event") yield item.event
    else genResult = item.result
  }
  const { ops, summary, model, fallbackUsed } = genResult!

  const writes = ops.filter((o) => o.op === "write")
  if (writes.length === 0) {
    yield {
      type: "error",
      message: "The model did not produce any usable files. Please try rephrasing your request.",
      recoverable: true,
    }
    return
  }

  let merged: FileMap = { ...scaffold }
  const deletedPaths: string[] = []
  applyOps(merged, ops, deletedPaths)

  for (const op of writes) {
    yield { type: "file", path: op.path, content: op.content }
  }

  // Validate + repair.
  const repairOut = yield* runValidateRepair(merged, provider, signal)
  if (!repairOut.ok) {
    yield {
      type: "error",
      message: repairOut.message,
      recoverable: true,
    }
    return
  }

  yield {
    type: "complete",
    intent: "CREATE",
    files: repairOut.files,
    deletedPaths,
    summary: summary || `Built ${manifest.appName}.`,
    model,
    latency: Date.now() - startedAt,
    repairAttempts: repairOut.attempts,
    fallbackUsed,
  }
}

async function runArchitect(
  message: string,
  provider: Provider,
  signal?: AbortSignal
): Promise<Manifest> {
  const appName = deriveAppName(message)
  try {
    const { result } = await runWithFailover(getChain("architect"), "architect", (model) =>
      provider.complete(model, {
        system: ARCHITECT_SYSTEM,
        messages: [{ role: "user", content: message }],
        temperature: 0.2,
        maxTokens: 1200,
        signal,
      })
    )
    const parsed = extractJson(result.text)
    if (parsed && Array.isArray(parsed.files)) {
      const manifestFiles = parsed.files
        .filter((f: { path?: string }) => typeof f?.path === "string" && /\.(jsx|css|js|json)$/.test(f.path))
        .map((f: { path: string; purpose?: string }) => ({
          path: f.path.replace(/^\.?\//, ""),
          purpose: String(f.purpose ?? ""),
        }))
        .slice(0, 10)
      if (!manifestFiles.some((f: { path: string }) => f.path === APP_ENTRY)) {
        manifestFiles.unshift({ path: APP_ENTRY, purpose: "Main application component" })
      }
      return {
        appName: typeof parsed.appName === "string" && parsed.appName ? parsed.appName : appName,
        files: manifestFiles,
        npmDeps: typeof parsed.npmDeps === "object" && parsed.npmDeps ? parsed.npmDeps : {},
      }
    }
  } catch {
    // Architect is an optimization; generation carries its own guardrails.
  }
  return defaultManifest(appName)
}

// ---------------------------------------------------------------------------
// EDIT
// ---------------------------------------------------------------------------

async function* runEdit(
  message: string,
  files: FileMap,
  history: ChatTurn[],
  provider: Provider,
  startedAt: number,
  signal?: AbortSignal
): AsyncGenerator<EngineEvent, void, void> {
  const lastSummary = lastAssistantSummary(history)
  const system = buildEditSystem(files, lastSummary)

  const gen = generateWithProgress(
    provider,
    "generation",
    system,
    [...history, { role: "user", content: message }],
    signal
  )
  let genResult: GenerationResult | null = null
  for await (const item of gen) {
    if (item.kind === "event") yield item.event
    else genResult = item.result
  }
  const { ops, summary, model, fallbackUsed } = genResult!

  if (ops.length === 0) {
    yield {
      type: "error",
      message: "The model did not produce any changes. Try describing the change differently.",
      recoverable: true,
    }
    return
  }

  const merged: FileMap = { ...files }
  const deletedPaths: string[] = []
  applyOps(merged, ops, deletedPaths)

  // Model-requested new npm imports self-heal in validate; but if the model
  // rewrote package.json directly, keep base deps intact.
  if (merged["package.json"] && !isValidJson(merged["package.json"])) {
    merged["package.json"] = files["package.json"] ?? addDepsToPackageJson("{}", {})
  }

  for (const op of ops.filter((o) => o.op === "write")) {
    yield { type: "file", path: op.path, content: op.content }
  }

  const repairOut = yield* runValidateRepair(merged, provider, signal)
  if (!repairOut.ok) {
    yield { type: "error", message: repairOut.message, recoverable: true }
    return
  }

  yield {
    type: "complete",
    intent: "EDIT",
    files: repairOut.files,
    deletedPaths,
    summary: summary || "Applied your changes.",
    model,
    latency: Date.now() - startedAt,
    repairAttempts: repairOut.attempts,
    fallbackUsed,
  }
}

// ---------------------------------------------------------------------------
// Generation with streaming progress
// ---------------------------------------------------------------------------

interface GenerationResult {
  ops: ReturnType<typeof parseModelOutput>["ops"]
  summary: string
  model: string
  fallbackUsed: boolean
}

type GenYield =
  | { kind: "event"; event: EngineEvent }
  | { kind: "result"; result: GenerationResult }

/**
 * Run a generation call with inline failover, scanning the streamed buffer
 * for file fences so the UI shows per-file progress live while the model
 * writes. Failover is inlined (rather than via runWithFailover) because
 * status events must be yielded mid-stream, not queued behind an await.
 */
async function* generateWithProgress(
  provider: Provider,
  chainKind: "generation",
  system: string,
  messages: ChatTurn[],
  signal?: AbortSignal
): AsyncGenerator<GenYield, void, void> {
  yield {
    kind: "event",
    event: { type: "status", message: "Writing code…", stage: "generate" },
  }

  const chain = getChain(chainKind)
  let lastError: unknown = null

  for (let idx = 0; idx < chain.length; idx++) {
    const model = chain[idx]
    if (idx > 0) {
      yield {
        kind: "event",
        event: {
          type: "status",
          message: `Falling back to ${shortName(model)}…`,
          stage: "generate",
        },
      }
    }
    try {
      let buffer = ""
      const seenPaths = new Set<string>()
      for await (const delta of provider.stream(model, {
        system,
        messages,
        temperature: 0.3,
        maxTokens: 16384,
        signal,
      })) {
        buffer += delta
        for (const path of scanFencePaths(buffer)) {
          if (!seenPaths.has(path)) {
            seenPaths.add(path)
            yield {
              kind: "event",
              event: { type: "status", message: `Writing ${path}…`, stage: "generate" },
            }
          }
        }
      }
      const parsed = parseModelOutput(buffer)
      if (parsed.ops.length === 0) {
        throw new ProviderError("Model output contained no parseable file blocks")
      }
      yield {
        kind: "result",
        result: {
          ops: parsed.ops,
          summary: parsed.summary,
          model,
          fallbackUsed: idx > 0,
        },
      }
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err
      lastError = err
    }
  }

  throw new ProviderError(
    `All models failed during generation. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

const FENCE_PATH_RE = /^```+[^\n]*?(?:file(?:name)?|path)\s*[:=]\s*["']?([^\s"'`\n]+)/gim

function scanFencePaths(buffer: string): string[] {
  // Only scan complete lines — a chunk boundary mid-path would otherwise
  // produce truncated "Writing src/A…" statuses.
  const complete = buffer.slice(0, buffer.lastIndexOf("\n") + 1)
  const paths: string[] = []
  for (const m of complete.matchAll(FENCE_PATH_RE)) {
    paths.push(m[1])
  }
  return paths
}

// ---------------------------------------------------------------------------
// Validate + repair loop
// ---------------------------------------------------------------------------

type RepairOutcome =
  | { ok: true; files: FileMap; attempts: number }
  | { ok: false; message: string; attempts: number }

async function* runValidateRepair(
  initial: FileMap,
  provider: Provider,
  signal?: AbortSignal
): AsyncGenerator<EngineEvent, RepairOutcome, void> {
  yield { type: "status", message: "Checking the code…", stage: "validate" }

  let { issues, files } = validateProject(initial)
  let fatal = issues.filter((i) => i.fatal)
  let attempts = 0

  while (fatal.length > 0 && attempts < MAX_REPAIR_ATTEMPTS) {
    attempts++
    yield {
      type: "status",
      message: `Fixing ${fatal.length} issue${fatal.length > 1 ? "s" : ""} (attempt ${attempts})…`,
      stage: "repair",
    }
    try {
      const { result } = await runWithFailover(getChain("generation"), "repair", (model) =>
        provider.complete(model, {
          system: buildRepairSystem(fatal, files),
          messages: [
            {
              role: "user",
              content: "Fix the errors listed in your instructions. Re-emit each broken file completely.",
            },
          ],
          temperature: 0.2,
          maxTokens: 16384,
          signal,
        })
      )
      const parsed = parseModelOutput(result.text)
      if (parsed.ops.length === 0) break
      applyOps(files, parsed.ops, [])
      for (const op of parsed.ops.filter((o) => o.op === "write")) {
        yield { type: "file", path: op.path, content: op.content }
      }
    } catch {
      break
    }
    const revalidated = validateProject(files)
    issues = revalidated.issues
    files = revalidated.files
    fatal = issues.filter((i) => i.fatal)
  }

  if (fatal.length > 0) {
    // Last resort: drop broken files that nothing essential depends on.
    const droppable = fatal.filter(
      (i) => i.path !== APP_ENTRY && i.path !== "package.json" && files[i.path] !== undefined
    )
    if (droppable.length > 0) {
      for (const issue of droppable) delete files[issue.path]
      const revalidated = validateProject(files)
      files = revalidated.files
      fatal = revalidated.issues.filter((i) => i.fatal)
    }
  }

  if (fatal.length > 0) {
    return {
      ok: false,
      attempts,
      message:
        "The generated code has errors that couldn't be fixed automatically: " +
        fatal.map((i) => `${i.path} — ${i.message}`).join("; "),
    }
  }
  return { ok: true, files, attempts }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyOps(
  files: FileMap,
  ops: ReturnType<typeof parseModelOutput>["ops"],
  deletedPaths: string[]
): void {
  for (const op of ops) {
    if (op.op === "delete") {
      if (files[op.path] !== undefined) {
        delete files[op.path]
        deletedPaths.push(op.path)
      }
    } else {
      files[op.path] = op.content
    }
  }
}

function lastAssistantSummary(history: ChatTurn[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") return history[i].content.slice(0, 400)
  }
  return null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractJson(text: string): any | null {
  // Strip fences, then find the first balanced {...} block.
  const cleaned = text.replace(/```(?:json)?/gi, "")
  const start = cleaned.indexOf("{")
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++
    else if (cleaned[i] === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function isValidJson(s: string): boolean {
  try {
    JSON.parse(s)
    return true
  } catch {
    return false
  }
}
