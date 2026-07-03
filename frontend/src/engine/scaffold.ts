import type { FileMap, Manifest } from "./types"

/**
 * Deterministic project scaffold. These files are never model-generated:
 * keeping the entry points, HTML shell, and package.json under our control
 * removes an entire class of free-model failures (broken mounts, invalid
 * JSON, missing react-dom imports).
 */

export const SCAFFOLD_PATHS = ["package.json", "index.html", "src/main.jsx", "src/index.css"]

/** Paths the model is never allowed to write or delete. */
export const PROTECTED_PATHS = new Set(["index.html", "src/main.jsx"])

/** The one file every project must have; generation fails without it. */
export const APP_ENTRY = "src/App.jsx"

const BASE_DEPS: Record<string, string> = {
  react: "^18.3.1",
  "react-dom": "^18.3.1",
}

export function buildScaffold(appName: string, extraDeps: Record<string, string>): FileMap {
  const pkg = {
    name: slugify(appName) || "forge-app",
    version: "0.1.0",
    private: true,
    main: "src/main.jsx",
    dependencies: { ...BASE_DEPS, ...sanitizeDeps(extraDeps) },
  }

  return {
    "package.json": JSON.stringify(pkg, null, 2) + "\n",
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appName)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
    "src/main.jsx": `import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,
    "src/index.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
`,
  }
}

/** Merge newly requested deps into an existing generated package.json. */
export function addDepsToPackageJson(pkgJson: string, deps: Record<string, string>): string {
  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(pkgJson)
  } catch {
    pkg = { name: "forge-app", version: "0.1.0", private: true, main: "src/main.jsx" }
  }
  const existing = (pkg.dependencies ?? {}) as Record<string, string>
  pkg.dependencies = { ...BASE_DEPS, ...existing, ...sanitizeDeps(deps) }
  return JSON.stringify(pkg, null, 2) + "\n"
}

function sanitizeDeps(deps: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, version] of Object.entries(deps ?? {})) {
    if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) continue
    // React itself is pinned by the scaffold.
    if (name === "react" || name === "react-dom") continue
    out[name] = typeof version === "string" && /^[\^~]?\d/.test(version) ? version : "latest"
  }
  return out
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Derive a short app name from the user's first prompt. */
export function deriveAppName(prompt: string): string {
  const cleaned = prompt
    .replace(/^(please\s+)?(can you\s+|could you\s+)?(build|create|make|generate|write)( me)?( an?| the)?\s*/i, "")
    .trim()
  const words = cleaned.split(/\s+/).slice(0, 6).join(" ")
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Forge App"
}

export function defaultManifest(appName: string): Manifest {
  return {
    appName,
    files: [{ path: APP_ENTRY, purpose: "Main application component" }],
    npmDeps: {},
  }
}
