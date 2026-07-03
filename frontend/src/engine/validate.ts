import { parse } from "@babel/parser"
import type { FileMap, ValidationIssue } from "./types"
import { APP_ENTRY } from "./scaffold"
import { addDepsToPackageJson } from "./scaffold"

/**
 * Static validation of a merged project file map. Returns issues for the
 * repair loop, and self-heals what it safely can (bare imports missing from
 * package.json are added automatically).
 */

export interface ValidationResult {
  issues: ValidationIssue[]
  /** File map after self-healing fixes (package.json deps). */
  files: FileMap
}

// Node built-ins and modules Sandpack can't run — flag as fatal.
const FORBIDDEN_IMPORTS = new Set([
  "fs", "path", "os", "child_process", "http", "https", "net", "crypto",
  "express", "next", "vite", "webpack",
])

export function validateProject(files: FileMap): ValidationResult {
  const issues: ValidationIssue[] = []
  const out: FileMap = { ...files }
  const bareImports = new Set<string>()

  if (!out[APP_ENTRY]) {
    issues.push({
      path: APP_ENTRY,
      message: `Missing ${APP_ENTRY} — the project must have a main App component with a default export.`,
      fatal: true,
    })
  }

  for (const [path, content] of Object.entries(out)) {
    if (/\.(jsx?|mjs)$/.test(path)) {
      const syntaxIssue = checkSyntax(path, content)
      if (syntaxIssue) {
        issues.push(syntaxIssue)
        continue
      }
      for (const spec of extractImports(content)) {
        if (spec.startsWith(".")) {
          if (!resolveRelative(path, spec, out)) {
            issues.push({
              path,
              message: `Import "${spec}" does not resolve to any file in the project. Create the missing file or fix the import path.`,
              fatal: true,
            })
          }
        } else {
          const pkgName = bareName(spec)
          if (FORBIDDEN_IMPORTS.has(pkgName)) {
            issues.push({
              path,
              message: `Import "${spec}" is not allowed — this is a browser-only React app. Remove it and use browser APIs or a browser-compatible package instead.`,
              fatal: true,
            })
          } else {
            bareImports.add(pkgName)
          }
        }
      }
      if (path === APP_ENTRY && !hasDefaultExport(content)) {
        issues.push({
          path,
          message: `${APP_ENTRY} must have a default export (export default function App() { ... }).`,
          fatal: true,
        })
      }
    } else if (path.endsWith(".json")) {
      try {
        JSON.parse(content)
      } catch (e) {
        issues.push({
          path,
          message: `Invalid JSON: ${(e as Error).message}`,
          fatal: true,
        })
      }
    }
  }

  // Self-heal: ensure every imported bare package is present in package.json.
  if (out["package.json"] && bareImports.size > 0) {
    try {
      const pkg = JSON.parse(out["package.json"])
      const deps: Record<string, string> = pkg.dependencies ?? {}
      const missing: Record<string, string> = {}
      for (const name of bareImports) {
        if (!deps[name]) missing[name] = "latest"
      }
      if (Object.keys(missing).length > 0) {
        out["package.json"] = addDepsToPackageJson(out["package.json"], missing)
      }
    } catch {
      // package.json issue already reported above
    }
  }

  return { issues, files: out }
}

function checkSyntax(path: string, content: string): ValidationIssue | null {
  try {
    parse(content, {
      sourceType: "module",
      plugins: ["jsx"],
      errorRecovery: false,
    })
    return null
  } catch (e) {
    const err = e as { message?: string; loc?: { line: number; column: number } }
    const line = err.loc?.line
    return {
      path,
      message: `Syntax error: ${err.message ?? "unparseable file"}`,
      excerpt: line ? excerptAround(content, line) : undefined,
      fatal: true,
    }
  }
}

function excerptAround(content: string, line: number): string {
  const lines = content.split("\n")
  const start = Math.max(0, line - 3)
  const end = Math.min(lines.length, line + 2)
  return lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1}${start + i + 1 === line ? " >" : "  "} ${l}`)
    .join("\n")
}

function extractImports(content: string): string[] {
  const specs: string[] = []
  const re =
    /(?:^|\n)\s*import\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g
  for (const m of content.matchAll(re)) {
    const spec = m[1] ?? m[2] ?? m[3]
    if (spec) specs.push(spec)
  }
  return specs
}

function bareName(spec: string): string {
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

const RESOLVE_EXTENSIONS = ["", ".js", ".jsx", ".json", ".css", "/index.js", "/index.jsx"]

function resolveRelative(from: string, spec: string, files: FileMap): boolean {
  const dir = from.split("/").slice(0, -1)
  const parts = spec.split("/")
  const stack = [...dir]
  for (const part of parts) {
    if (part === "." || part === "") continue
    else if (part === "..") stack.pop()
    else stack.push(part)
  }
  const base = stack.join("/")
  return RESOLVE_EXTENSIONS.some((ext) => files[base + ext] !== undefined)
}

function hasDefaultExport(content: string): boolean {
  return /export\s+default\s/.test(content) || /export\s*\{\s*\w+\s+as\s+default\s*\}/.test(content)
}
