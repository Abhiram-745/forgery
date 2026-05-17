export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

const tools = new Map<string, ToolDefinition>()

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool)
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name)
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values())
}

export function buildToolSchema(): Array<{
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}> {
  return Array.from(tools.values()).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}
