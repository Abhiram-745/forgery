"use client"

import { useEffect, useMemo } from "react"
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  useSandpack,
  type SandpackFiles,
} from "@codesandbox/sandpack-react"
import { forgeSandpackTheme } from "@/lib/sandpack-theme"

/**
 * Runs the generated project in Sandpack's in-browser bundler.
 *
 * The generated package.json's dependencies are passed through customSetup —
 * that is how model-requested npm packages actually get installed. The react
 * template's own entry files are overridden with a hidden bridge that imports
 * the generated src/main.jsx, so the file explorer shows only project files.
 */

interface SandpackHostProps {
  files: Record<string, string>
  view: "preview" | "code"
  /** Changes force a full remount (used when a new app is created). */
  instanceKey: number
  /** Called with the runtime/bundler error message, or null when it clears. */
  onRuntimeError?: (message: string | null) => void
}

function RuntimeErrorListener({ onError }: { onError?: (message: string | null) => void }) {
  const { sandpack } = useSandpack()
  const message = sandpack.error?.message ?? null
  useEffect(() => {
    onError?.(message)
  }, [message, onError])
  return null
}

export function SandpackHost({ files, view, instanceKey, onRuntimeError }: SandpackHostProps) {
  const { sandpackFiles, dependencies } = useMemo(() => {
    const mapped: SandpackFiles = {
      // Bridge + template overrides, hidden from the explorer.
      "/index.js": { code: 'import "./src/main.jsx"\n', hidden: true },
      "/App.js": { code: "export default function Unused() { return null }\n", hidden: true },
      "/styles.css": { code: "", hidden: true },
      "/public/index.html": {
        code: '<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div></body></html>',
        hidden: true,
      },
    }
    for (const [path, content] of Object.entries(files)) {
      if (path === "package.json" || path === "index.html") continue
      mapped["/" + path] = { code: content }
    }
    let dependencies: Record<string, string> = { react: "^18.3.1", "react-dom": "^18.3.1" }
    try {
      const pkg = JSON.parse(files["package.json"] ?? "{}")
      if (pkg?.dependencies && typeof pkg.dependencies === "object") {
        dependencies = { ...dependencies, ...pkg.dependencies }
      }
    } catch {
      // fall back to base deps
    }
    return { sandpackFiles: mapped, dependencies }
  }, [files])

  return (
    <SandpackProvider
      key={instanceKey}
      template="react"
      files={sandpackFiles}
      customSetup={{ dependencies }}
      options={{
        activeFile: "/src/App.jsx",
        autorun: true,
        autoReload: true,
      }}
      theme={forgeSandpackTheme}
      style={{ height: "100%" }}
    >
      <RuntimeErrorListener onError={onRuntimeError} />
      {view === "preview" ? (
        <SandpackPreview
          style={{ height: "100%", background: "white" }}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showRestartButton={false}
        />
      ) : (
        <SandpackLayout style={{ height: "100%", border: "none", borderRadius: 0 }}>
          <SandpackFileExplorer
            autoHiddenFiles
            style={{ height: "100%", minWidth: 180, maxWidth: 220 }}
          />
          <SandpackCodeEditor
            readOnly
            showLineNumbers
            showTabs={false}
            style={{ height: "100%", flex: 1 }}
          />
        </SandpackLayout>
      )}
    </SandpackProvider>
  )
}
