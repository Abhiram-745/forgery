import { getKnownModels, getChain, PRIMARY_MODEL } from "@/engine/models"
import { getHealthSnapshot } from "@/engine/failover"

export const runtime = "nodejs"

/** Engine status: configured chains + best-effort in-memory health. */
export async function GET() {
  return Response.json({
    status: "ok",
    primary: PRIMARY_MODEL,
    chains: {
      generation: getChain("generation"),
      architect: getChain("architect"),
      fast: getChain("fast"),
    },
    models: getKnownModels(),
    health: getHealthSnapshot(),
    mock: !!process.env.FORGE_MOCK_AI,
    timestamp: new Date().toISOString(),
  })
}
