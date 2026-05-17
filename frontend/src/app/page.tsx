"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Sparkles,
  ArrowRight,
  Zap,
  Brain,
  Shield,
  Code2,
  Layers,
  GitBranch,
} from "lucide-react"
import { useAuth } from "@/lib/auth"

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const ctaHref = mounted && !isLoading && isAuthenticated ? "/chat" : "/login"
  const ctaLabel = mounted && !isLoading && isAuthenticated ? "Open Chat" : "Get Started"

  return (
    <main className="relative min-h-screen bg-background overflow-x-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[1000px] bg-white/[0.04] blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_70%)]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm">
            F
          </div>
          <span className="font-semibold text-base sm:text-lg">Forge AI</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href="#features"
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
          >
            Features
          </a>
          <a
            href="#models"
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
          >
            Models
          </a>
          <Link
            href={ctaHref}
            className="forge-button-primary h-9 px-4 text-sm gap-1.5"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 sm:pt-24 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6 animate-fade-in">
          <Sparkles className="h-3 w-3" />
          Powered by OpenRouter · 10+ free models
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-gradient max-w-4xl leading-[1.05] animate-slide-up">
          The intelligent
          <br />
          coding companion
        </h1>

        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed animate-slide-up [animation-delay:100ms]">
          Forge AI auto-routes your prompts to the best free model for the task &mdash; coding,
          reasoning, debugging, and more. Streaming responses, smart fallbacks, zero cost.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 animate-slide-up [animation-delay:200ms]">
          <Link href={ctaHref} className="forge-button-primary h-11 px-6 text-sm gap-2">
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#features" className="forge-button-secondary h-11 px-6 text-sm">
            Learn more
          </a>
        </div>

        {/* Engine status card (preserved from original) */}
        <div className="mt-16 forge-panel p-6 max-w-md w-full mx-auto animate-slide-up [animation-delay:300ms]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">AI Engine Status</h2>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1.5 font-mono">
            <div className="flex justify-between"><span>Model Registry</span><span className="text-foreground/80">Active</span></div>
            <div className="flex justify-between"><span>Provider</span><span className="text-foreground/80">OpenRouter</span></div>
            <div className="flex justify-between"><span>Streaming</span><span className="text-foreground/80">Enabled</span></div>
            <div className="flex justify-between"><span>Orchestration</span><span className="text-foreground/80">Ready</span></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-3">
              Built for serious coding
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
              A polished AI workspace with intelligent orchestration under the hood.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              title="Smart Model Routing"
              description="Automatically picks the optimal free model based on your request type — coding, reasoning, debugging, or creative."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Real-time Streaming"
              description="Responses stream token-by-token through a low-latency SSE pipeline. No waiting for full generations."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Automatic Fallbacks"
              description="Built-in health checks and retry logic. If a model fails, requests instantly route to the next best option."
            />
            <FeatureCard
              icon={<Code2 className="h-5 w-5" />}
              title="Coding First"
              description="Optimized for DeepSeek, Qwen Coder, and Llama families — the strongest open free models for software work."
            />
            <FeatureCard
              icon={<Layers className="h-5 w-5" />}
              title="Context Aware"
              description="Multi-turn conversations with persistent context, token estimation, and intelligent prompt management."
            />
            <FeatureCard
              icon={<GitBranch className="h-5 w-5" />}
              title="Zero Cost"
              description="100% free models from OpenRouter. No credit card required. Bring your own key and start building."
            />
          </div>
        </div>
      </section>

      {/* Models */}
      <section id="models" className="relative z-10 px-6 py-20 sm:py-28 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-3">
              The best free models, orchestrated
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
              Forge AI taps into the strongest free models on OpenRouter and routes each request intelligently.
            </p>
          </div>

          <div className="forge-panel p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs sm:text-sm">
              {[
                "deepseek/deepseek-chat:free",
                "deepseek/deepseek-r1:free",
                "qwen/qwen-2.5-coder-32b-instruct:free",
                "qwen/qwen-2.5-72b-instruct:free",
                "google/gemini-2.0-flash-exp:free",
                "google/gemini-flash-1.5-8b:free",
                "meta-llama/llama-3.3-70b-instruct:free",
                "meta-llama/llama-3.1-8b-instruct:free",
                "mistralai/mistral-7b-instruct:free",
                "qwen/qwen-2-vl-72b-instruct:free",
              ].map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-2 py-2 px-3 rounded-md bg-secondary/40 border border-border/60"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shrink-0" />
                  <span className="text-muted-foreground truncate">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-gradient mb-4">
            Start building with AI
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Sign in to chat with Forge AI. Free forever, no credit card.
          </p>
          <Link href={ctaHref} className="forge-button-primary h-12 px-8 text-sm gap-2">
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-white text-black flex items-center justify-center font-bold text-[10px]">
              F
            </div>
            <span className="text-xs text-muted-foreground">Forge AI · AI-powered coding platform</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              OpenRouter
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="forge-panel p-5 hover:bg-card/80 transition-colors group">
      <div className="h-9 w-9 rounded-md bg-secondary border border-border flex items-center justify-center mb-3 text-foreground/80 group-hover:text-foreground transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}
