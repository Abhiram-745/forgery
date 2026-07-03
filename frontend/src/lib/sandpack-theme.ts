import type { SandpackTheme } from "@codesandbox/sandpack-react"

/**
 * Sandpack theme matching the Forge dark design system
 * (see globals.css :root HSL tokens — pure monochrome dark).
 */
export const forgeSandpackTheme: SandpackTheme = {
  colors: {
    surface1: "hsl(0, 0%, 3%)", // --card
    surface2: "hsl(0, 0%, 15%)", // --border
    surface3: "hsl(0, 0%, 10%)", // --muted
    clickable: "hsl(0, 0%, 55%)", // --muted-foreground
    base: "hsl(0, 0%, 98%)", // --foreground
    disabled: "hsl(0, 0%, 35%)",
    hover: "hsl(0, 0%, 98%)",
    accent: "hsl(0, 0%, 98%)", // --primary
    error: "hsl(0, 70%, 65%)",
    errorSurface: "hsl(0, 40%, 12%)",
  },
  syntax: {
    plain: "hsl(0, 0%, 90%)",
    comment: { color: "hsl(0, 0%, 45%)", fontStyle: "italic" },
    keyword: "hsl(270, 60%, 75%)",
    tag: "hsl(200, 70%, 70%)",
    punctuation: "hsl(0, 0%, 60%)",
    definition: "hsl(35, 80%, 70%)",
    property: "hsl(200, 70%, 70%)",
    static: "hsl(150, 50%, 65%)",
    string: "hsl(150, 50%, 65%)",
  },
  font: {
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    size: "13px",
    lineHeight: "1.6",
  },
}
