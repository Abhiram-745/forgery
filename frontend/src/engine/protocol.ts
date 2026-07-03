import type { FileOp, ParsedOutput } from "./types"
import { PROTECTED_PATHS } from "./scaffold"

/**
 * Output protocol parser.
 *
 * The canonical format the prompts ask for:
 *
 *   <summary>One or two sentences about what was built/changed.</summary>
 *   ```file:src/App.jsx
 *   ...complete file content...
 *   ```
 *   ```delete:src/Old.jsx
 *   ```
 *
 * Free models are sloppy, so the parser accepts many drifted variants:
 *   - language-tagged fences:        ```jsx file:src/App.jsx
 *   - FILE: prefix / quoted paths:   ```FILE: "src/App.jsx"
 *   - path-only fences:              ```src/App.jsx
 *   - XML-ish blocks:                <file path="src/App.jsx">...</file>
 *   - heading-then-fence:            **src/App.jsx**\n```jsx
 *   - unterminated final fence (model hit its token limit)
 *
 * Only fences at the start of a line that carry a recognizable path open a
 * file block, so fenced code nested inside file content survives.
 */

const MAX_FILES = 40
const MAX_FILE_BYTES = 200_000

const PATH_RE = /^[\w@][\w@./-]*\.[a-z0-9]{1,8}$/i

export function parseModelOutput(raw: string): ParsedOutput {
  const text = raw.replace(/\r\n/g, "\n")
  const ops: FileOp[] = []
  const consumedRanges: [number, number][] = []

  // Pass 1: XML-ish <file path="...">...</file> blocks.
  const xmlRe = /<file\s+(?:path|name)\s*=\s*["']?([^"'>\s]+)["']?\s*>\n?([\s\S]*?)<\/file>/gi
  for (const m of text.matchAll(xmlRe)) {
    const path = normalizePath(m[1])
    if (!path) continue
    pushOp(ops, { op: "write", path, content: stripInnerFence(m[2]) })
    consumedRanges.push([m.index!, m.index! + m[0].length])
  }

  // Pass 2: fenced blocks, scanned line by line.
  const lines = text.split("\n")
  // Byte offsets of each line start, so we can respect consumedRanges.
  const offsets: number[] = []
  let acc = 0
  for (const line of lines) {
    offsets.push(acc)
    acc += line.length + 1
  }

  let i = 0
  let pendingHeadingPath: string | null = null
  while (i < lines.length) {
    const line = lines[i]
    const offset = offsets[i]
    if (inRanges(offset, consumedRanges)) {
      i++
      continue
    }

    const fence = matchFenceOpen(line)
    if (!fence) {
      // Remember "**src/App.jsx**" / "### src/App.jsx" style headings so a
      // pathless fence on the next non-empty line can adopt the path.
      const heading = matchHeadingPath(line)
      if (heading) pendingHeadingPath = heading
      else if (line.trim() !== "") pendingHeadingPath = null
      i++
      continue
    }

    let { path, op } = fence
    if (!path && pendingHeadingPath) {
      path = pendingHeadingPath
      op = "write"
    }
    pendingHeadingPath = null

    if (!path) {
      // Plain code fence with no path: skip to its closing fence so its
      // contents can't be misread as file blocks.
      i = skipPlainFence(lines, i + 1)
      continue
    }

    // Collect content until a line-start closing fence. A nested fence inside
    // the file only closes the block if what follows the close is another
    // file-opening fence, a heading, or end of output — heuristic: we close on
    // the LAST unindented ``` before the next file fence or EOF... simpler and
    // robust: close on a bare ``` line; nested fences in generated app code
    // are rare because prompts forbid markdown inside files.
    const content: string[] = []
    let j = i + 1
    let closed = false
    while (j < lines.length) {
      if (/^```\s*$/.test(lines[j])) {
        closed = true
        break
      }
      // A new file fence opening while we're inside means the close fence was
      // dropped by the model — end this block here.
      const next = matchFenceOpen(lines[j])
      if (next && next.path) break
      content.push(lines[j])
      j++
    }

    pushOp(ops, {
      op,
      path,
      content: op === "delete" ? "" : content.join("\n").replace(/\s+$/, "") + "\n",
    })
    i = closed ? j + 1 : j
  }

  const summary = extractSummary(text)
  return { summary, ops: ops.slice(0, MAX_FILES) }
}

/** Match a line-start fence that opens a file or delete block. */
function matchFenceOpen(
  line: string
): { path: string | null; op: "write" | "delete" } | null {
  const m = line.match(/^```+(.*)$/)
  if (!m) return null
  const tag = m[1].trim()
  if (!tag) return { path: null, op: "write" }

  // delete:path
  const del = tag.match(/^(?:\w+\s+)?delete\s*:\s*["']?([^\s"']+)["']?/i)
  if (del) {
    const path = normalizePath(del[1])
    return path ? { path, op: "delete" } : { path: null, op: "write" }
  }

  // [lang ]file:path  |  [lang ]FILE: path  |  filename=path | path=path
  const file = tag.match(/(?:file(?:name)?|path)\s*[:=]\s*["']?([^\s"']+)["']?/i)
  if (file) {
    const path = normalizePath(file[1])
    return path ? { path, op: "write" } : { path: null, op: "write" }
  }

  // ```src/App.jsx  (path-only fence) or ```jsx src/App.jsx
  const parts = tag.split(/\s+/)
  for (const part of parts) {
    const cleaned = part.replace(/^["'(]+|["')]+$/g, "")
    if (cleaned.includes("/") || PATH_RE.test(cleaned)) {
      const path = normalizePath(cleaned)
      // Guard against bare language tags like "js" matching PATH_RE — require
      // an extension-bearing name that isn't itself a known language token.
      if (path && !isLanguageToken(cleaned)) return { path, op: "write" }
    }
  }

  return { path: null, op: "write" }
}

const LANGUAGE_TOKENS = new Set([
  "js", "jsx", "ts", "tsx", "css", "html", "json", "javascript", "typescript",
  "markdown", "md", "bash", "sh", "text", "txt", "plaintext",
])

function isLanguageToken(s: string): boolean {
  return LANGUAGE_TOKENS.has(s.toLowerCase())
}

/** "**src/App.jsx**", "### src/App.jsx", "// src/App.jsx", "File: src/App.jsx" */
function matchHeadingPath(line: string): string | null {
  const m = line.match(
    /^(?:#{1,6}\s*|\*\*|\/\/\s*|(?:file(?:name)?)\s*[:=]\s*)["'`]*([\w@][\w@./-]*\.[a-z0-9]{1,8})["'`*]*\s*$/i
  )
  if (!m) return null
  return normalizePath(m[1])
}

function skipPlainFence(lines: string[], start: number): number {
  for (let j = start; j < lines.length; j++) {
    if (/^```\s*$/.test(lines[j])) return j + 1
  }
  return lines.length
}

function pushOp(ops: FileOp[], op: FileOp) {
  if (op.content.length > MAX_FILE_BYTES) op.content = op.content.slice(0, MAX_FILE_BYTES)
  if (PROTECTED_PATHS.has(op.path)) return
  // Last write wins for duplicate paths (models sometimes re-emit a file).
  const idx = ops.findIndex((o) => o.path === op.path)
  if (idx >= 0) ops[idx] = op
  else ops.push(op)
}

export function normalizePath(raw: string): string | null {
  let p = raw.trim().replace(/^["'`]+|["'`]+$/g, "")
  p = p.replace(/^\.\//, "").replace(/^\/+/, "")
  if (!p || p.includes("..") || p.includes("\\") || p.length > 200) return null
  if (!/^[\w@][\w@ ./-]*$/.test(p)) return null
  if (!/\.[a-z0-9]{1,8}$/i.test(p)) return null
  return p
}

function extractSummary(text: string): string {
  const tag = text.match(/<summary>([\s\S]*?)<\/summary>/i)
  if (tag) return collapse(tag[1])
  // Unterminated <summary>
  const open = text.match(/<summary>([\s\S]*?)(?:\n```|$)/i)
  if (open) return collapse(open[1]).slice(0, 500)
  // Fall back to prose before the first fence / xml file block.
  const cut = text.search(/^```|<file\s/m)
  const prose = (cut >= 0 ? text.slice(0, cut) : text).trim()
  return collapse(prose).slice(0, 500)
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function inRanges(offset: number, ranges: [number, number][]): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end)
}

/** Strip a single wrapping markdown fence if the model nested one inside XML tags. */
function stripInnerFence(s: string): string {
  const m = s.trim().match(/^```[^\n]*\n([\s\S]*?)\n?```$/)
  const body = m ? m[1] : s
  return body.replace(/^\n+/, "").replace(/\s+$/, "") + "\n"
}
