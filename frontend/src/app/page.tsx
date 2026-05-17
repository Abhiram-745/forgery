export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gradient">Forge AI</h1>
        <p className="mt-4 text-muted-foreground">
          AI-powered coding platform
        </p>
        <div className="mt-8 forge-panel p-6 max-w-md mx-auto">
          <h2 className="text-lg font-medium mb-2">AI Engine Status</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Model Registry: Active</p>
            <p>Provider: OpenRouter</p>
            <p>Streaming: Enabled</p>
            <p>Orchestration: Ready</p>
          </div>
        </div>
      </div>
    </main>
  )
}
