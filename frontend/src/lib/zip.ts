import JSZip from "jszip"

/** Bundle the project file map into a ZIP and trigger a browser download. */
export async function downloadProjectZip(
  files: Record<string, string>,
  name: string
): Promise<void> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }
  zip.file(
    "README.md",
    `# ${name}\n\nBuilt with Forge AI.\n\n## Run locally\n\nThis is a plain React app. The quickest way to run it:\n\n\`\`\`bash\nnpm create vite@latest my-app -- --template react\n# copy src/ and index.html over the template, merge package.json dependencies\nnpm install\nnpm run dev\n\`\`\`\n`
  )
  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${slug(name)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "forge-app"
  )
}
