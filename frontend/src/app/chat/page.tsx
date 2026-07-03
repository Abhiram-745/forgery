"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/lib/auth"
import { useProject } from "@/hooks/use-project"
import { ChatPanel } from "@/components/workspace/chat-panel"
import { PreviewPanel } from "@/components/workspace/preview-panel"
import { LogOut, MessageSquare, MonitorPlay } from "lucide-react"

function WorkspaceInner() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const {
    project,
    messages,
    isLoading,
    error,
    progress,
    generationId,
    hydrated,
    sendMessage,
    stop,
    reset,
    downloadZip,
  } = useProject()

  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat")
  const [composerSeed, setComposerSeed] = useState<string | null>(null)

  const handleLogout = () => {
    logout()
    router.replace("/")
  }

  const handleNewProject = () => {
    if (
      project &&
      !window.confirm("Start a new project? The current app and chat will be cleared.")
    ) {
      return
    }
    reset()
    setMobileTab("chat")
  }

  const handleAskFix = useCallback((errorMessage: string) => {
    setComposerSeed(`Fix this error in the app: ${errorMessage.slice(0, 500)}`)
    setMobileTab("chat")
    // clear the seed after it's consumed so the same error can be re-seeded
    setTimeout(() => setComposerSeed(null), 500)
  }, [])

  const handleSend = useCallback(
    (message: string) => {
      sendMessage(message)
    },
    [sendMessage]
  )

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

        {/* Mobile tab switcher */}
        <div className="flex md:hidden items-center gap-1 rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
              mobileTab === "chat"
                ? "bg-accent text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMobileTab("preview")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
              mobileTab === "preview"
                ? "bg-accent text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            App
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[180px]">
            {user?.email}
          </span>
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

      {/* Split workspace */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel */}
        <div
          className={`${
            mobileTab === "chat" ? "flex" : "hidden"
          } md:flex w-full md:w-[420px] lg:w-[460px] shrink-0 flex-col border-r border-border min-h-0`}
        >
          {hydrated && (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              error={error}
              statusMessage={progress.statusMessage}
              streamingChat={progress.streamingChat}
              streamingFiles={progress.streamingFiles}
              composerSeed={composerSeed}
              onSend={handleSend}
              onStop={stop}
            />
          )}
        </div>

        {/* Preview panel */}
        <div
          className={`${
            mobileTab === "preview" ? "flex" : "hidden"
          } md:flex flex-1 flex-col min-h-0 min-w-0`}
        >
          <PreviewPanel
            files={project?.files ?? null}
            projectName={project?.name ?? null}
            generationId={generationId}
            isGenerating={isLoading}
            statusMessage={progress.statusMessage}
            streamingFiles={progress.streamingFiles}
            onDownload={downloadZip}
            onNewProject={handleNewProject}
            onAskFix={handleAskFix}
          />
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <WorkspaceInner />
    </AuthGuard>
  )
}
