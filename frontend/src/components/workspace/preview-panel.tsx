"use client"

import { useCallback, useState } from "react"
import dynamic from "next/dynamic"
import {
  Eye,
  Code2,
  RefreshCw,
  Download,
  FilePlus2,
  Loader2,
  MonitorSmartphone,
  Wrench,
} from "lucide-react"

// Sandpack is browser-only and heavy — load it lazily, client-side only.
const SandpackHost = dynamic(
  () => import("./sandpack-host").then((m) => m.SandpackHost),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    ),
  }
)

interface PreviewPanelProps {
  files: Record<string, string> | null
  projectName: string | null
  generationId: number
  isGenerating: boolean
  statusMessage: string | null
  streamingFiles: string[]
  onDownload: () => void
  onNewProject: () => void
  onAskFix: (errorMessage: string) => void
}

export function PreviewPanel({
  files,
  projectName,
  generationId,
  isGenerating,
  statusMessage,
  streamingFiles,
  onDownload,
  onNewProject,
  onAskFix,
}: PreviewPanelProps) {
  const [view, setView] = useState<"preview" | "code">("preview")
  const [refreshTick, setRefreshTick] = useState(0)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const handleRuntimeError = useCallback((message: string | null) => {
    setRuntimeError(message)
  }, [])

  const hasProject = !!files && Object.keys(files).length > 0

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border bg-card/40 px-3 py-2 shrink-0 gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setView("preview")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
              view === "preview"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => setView("code")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
              view === "code"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
        </div>

        <span className="hidden lg:block text-xs text-muted-foreground truncate flex-1 text-center">
          {projectName ?? ""}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={!hasProject}
            className="forge-button-ghost h-7 w-7 p-0 justify-center disabled:opacity-40"
            title="Restart preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDownload}
            disabled={!hasProject}
            className="forge-button-ghost h-7 px-2.5 text-xs gap-1.5 disabled:opacity-40"
            title="Download project as ZIP"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ZIP</span>
          </button>
          <button
            onClick={onNewProject}
            className="forge-button-ghost h-7 px-2.5 text-xs gap-1.5"
            title="Start a new project"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 min-h-0">
        {hasProject ? (
          <SandpackHost
            files={files!}
            view={view}
            instanceKey={generationId * 1000 + refreshTick}
            onRuntimeError={handleRuntimeError}
          />
        ) : (
          <EmptyPreview isGenerating={isGenerating} />
        )}

        {/* Generation overlay */}
        {isGenerating && (statusMessage || streamingFiles.length > 0) && (
          <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
            <div className="forge-panel mx-auto max-w-md px-4 py-3 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs text-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span className="truncate">{statusMessage ?? "Working…"}</span>
              </div>
              {streamingFiles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {streamingFiles.map((p) => (
                    <span
                      key={p}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Runtime error → ask-to-fix pill */}
        {!isGenerating && runtimeError && hasProject && (
          <div className="absolute top-3 left-3 right-3 flex justify-center">
            <button
              onClick={() => onAskFix(runtimeError)}
              className="forge-panel flex items-center gap-2 border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 transition-colors max-w-full"
              title={runtimeError}
            >
              <Wrench className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">The app hit an error — ask Forge to fix it</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyPreview({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full border border-border bg-card p-4">
        <MonitorSmartphone className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        {isGenerating ? "Building your app…" : "Your app will appear here"}
      </p>
      <p className="text-xs text-muted-foreground max-w-xs">
        {isGenerating
          ? "The live preview starts as soon as the code is ready."
          : "Describe what you want to build in the chat and watch it come to life."}
      </p>
    </div>
  )
}
