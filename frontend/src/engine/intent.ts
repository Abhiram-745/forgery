import type { ChatTurn, FileMap, Intent, Provider } from "./types"
import { INTENT_SYSTEM } from "./prompts"
import { getChain } from "./models"
import { runWithFailover } from "./failover"

/**
 * Intent resolution: cheap deterministic heuristics first, one tiny model
 * call only when genuinely ambiguous, and a safe default (CHAT when a project
 * exists) when even the model can't be parsed. This is what stops "no" from
 * triggering another generation.
 */

const BUILD_VERBS =
  /\b(build|create|make|generate|write|code|develop|design|scaffold|clone|implement)\b/i
const CHANGE_VERBS =
  /\b(add|remove|delete|change|update|fix|rename|move|restyle|redesign|refactor|improve|adjust|tweak|swap|replace|increase|decrease|resize|recolou?r|hide|show|enable|disable|convert|translate|animate|center|align|sort|filter|dark ?mode|light ?mode)\b/i
const START_OVER =
  /\b(start over|start again|from scratch|scrap (this|it|that)|new (app|project)|different app|something else instead|restart|reset the (app|project)|throw (this|it) away)\b/i
const PURE_CHAT =
  /^(no|nope|nah|yes|yeah|yep|ok|okay|k|sure|thanks|thank you|thx|ty|cool|nice|great|awesome|perfect|love it|lol|hi|hello|hey|good|bad|hmm|wow|why|why\?|what|what\?|how|how\?|stop|wait|never ?mind|nvm|no thanks|not now|good job|well done)[.!?\s]*$/i
const QUESTION_START =
  /^(what|why|how|when|where|which|who|can you explain|explain|tell me|does|do you|is|are|could you tell)\b/i

export interface IntentResolution {
  intent: Intent
  source: "heuristic" | "model" | "default"
}

export async function resolveIntent(
  message: string,
  files: FileMap | null,
  history: ChatTurn[],
  provider: Provider,
  signal?: AbortSignal
): Promise<IntentResolution> {
  const text = message.trim()
  const hasProject = !!files && Object.keys(files).length > 0

  // --- Deterministic heuristics ---------------------------------------------
  if (PURE_CHAT.test(text)) return { intent: "CHAT", source: "heuristic" }
  if (text.length < 3) return { intent: "CHAT", source: "heuristic" }

  if (hasProject && START_OVER.test(text)) return { intent: "CREATE", source: "heuristic" }

  if (!hasProject) {
    // No project: a build verb or an app-like description means CREATE.
    if (BUILD_VERBS.test(text)) return { intent: "CREATE", source: "heuristic" }
    if (QUESTION_START.test(text) && text.includes("?")) return { intent: "CHAT", source: "heuristic" }
  } else {
    // Project exists: change verbs mean EDIT; questions mean CHAT.
    if (QUESTION_START.test(text) && !CHANGE_VERBS.test(text)) {
      return { intent: "CHAT", source: "heuristic" }
    }
    if (CHANGE_VERBS.test(text) || BUILD_VERBS.test(text)) {
      return { intent: "EDIT", source: "heuristic" }
    }
  }

  // --- Ambiguous: one tiny classifier call -----------------------------------
  try {
    const recent = history.slice(-4).map((t) => `${t.role}: ${t.content.slice(0, 200)}`).join("\n")
    const { result } = await runWithFailover(getChain("fast"), "intent", (model) =>
      provider.complete(model, {
        system: INTENT_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Project exists: ${hasProject ? "YES" : "NO"}\nRecent conversation:\n${recent}\n\nLatest user message: "${text.slice(0, 500)}"\n\nAnswer with one word.`,
          },
        ],
        temperature: 0,
        maxTokens: 6,
        signal,
      })
    )
    const word = result.text.trim().toUpperCase()
    if (word.includes("CREATE")) {
      // A model can't EDIT nothing; but never nuke an existing project unless
      // the user explicitly asked to start over (heuristic above handles that).
      return hasProject
        ? { intent: "EDIT", source: "model" }
        : { intent: "CREATE", source: "model" }
    }
    if (word.includes("EDIT")) {
      return hasProject
        ? { intent: "EDIT", source: "model" }
        : { intent: "CREATE", source: "model" }
    }
    if (word.includes("CHAT")) return { intent: "CHAT", source: "model" }
  } catch {
    // fall through to defaults
  }

  // --- Safe defaults ----------------------------------------------------------
  if (hasProject) return { intent: "CHAT", source: "default" }
  // No project and ambiguous long message: treat a substantial description as
  // CREATE (the whole point of the product), short murmurs as CHAT.
  return text.split(/\s+/).length >= 4
    ? { intent: "CREATE", source: "default" }
    : { intent: "CHAT", source: "default" }
}
