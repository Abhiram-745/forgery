import type { CompletionOptions, CompletionResult, Provider } from "./types"
import { RateLimitedError } from "./types"

/**
 * Offline mock provider, enabled with FORGE_MOCK_AI=1 (or =broken).
 * Lets the whole pipeline — intent, architect, generate, validate, repair,
 * failover, streaming — run end-to-end with no network.
 *
 *   FORGE_MOCK_AI=broken  → the first generation emits a syntax error, and the
 *                           repair prompt returns the fix (exercises repair).
 *   message contains "force429" → the first model attempted gets a 429
 *                           (exercises failover).
 */

class MockProvider implements Provider {
  private brokenPending: boolean
  private served429 = new Set<string>()

  constructor(private mode: string) {
    this.brokenPending = mode === "broken"
  }

  async complete(model: string, opts: CompletionOptions): Promise<CompletionResult> {
    const text = this.respond(model, opts)
    await sleep(80)
    return { text, model: `${model} (mock)` }
  }

  async *stream(model: string, opts: CompletionOptions): AsyncGenerator<string, void, void> {
    const text = this.respond(model, opts)
    // Stream in uneven chunks to exercise the incremental fence scanner.
    let i = 0
    while (i < text.length) {
      const n = 24 + Math.floor(Math.random() * 48)
      yield text.slice(i, i + n)
      i += n
      await sleep(8)
    }
  }

  private respond(model: string, opts: CompletionOptions): string {
    const userMsg = opts.messages[opts.messages.length - 1]?.content ?? ""

    if (/force429/i.test(userMsg) && !this.served429.has(userMsg)) {
      this.served429.add(userMsg)
      throw new RateLimitedError(`mock 429 for ${model}`)
    }

    const sys = opts.system
    if (sys.includes("intent classifier")) return this.classify(userMsg)
    if (sys.includes("planning stage")) return MANIFEST_JSON
    if (sys.includes("fixing errors in generated React code")) return REPAIR_OUTPUT
    if (sys.includes("EXISTING app")) return EDIT_OUTPUT
    if (sys.includes("Build the app the user describes")) {
      if (this.brokenPending) {
        this.brokenPending = false
        return BROKEN_CREATE_OUTPUT
      }
      return CREATE_OUTPUT
    }
    // Chat mode
    return "Got it — I'm here whenever you want to build or change something. Just describe it and I'll take care of the code. (mock reply)"
  }

  private classify(msg: string): string {
    const m = msg.toLowerCase()
    if (/\b(build|create|make)\b/.test(m)) return "CREATE"
    if (/\b(add|change|fix|remove)\b/.test(m)) return "EDIT"
    return "CHAT"
  }
}

const MANIFEST_JSON = `{"appName": "Todo App", "files": [{"path": "src/App.jsx", "purpose": "Main todo application"}, {"path": "src/components/TodoItem.jsx", "purpose": "Single todo row"}, {"path": "src/App.css", "purpose": "Styles"}], "npmDeps": {}}`

const APP_JSX = `import { useState, useEffect } from "react"
import TodoItem from "./components/TodoItem"
import "./App.css"

export default function App() {
  const [todos, setTodos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("todos")) || []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState("")

  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos))
  }, [todos])

  const addTodo = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setTodos([...todos, { id: Date.now(), text, done: false }])
    setInput("")
  }

  const toggle = (id) =>
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  const remove = (id) => setTodos(todos.filter((t) => t.id !== id))

  return (
    <div className="app">
      <header className="header">
        <h1>My Todos</h1>
        <p>{todos.filter((t) => !t.done).length} remaining</p>
      </header>
      <form className="composer" onSubmit={addTodo}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What needs doing?"
        />
        <button type="submit">Add</button>
      </form>
      <ul className="list">
        {todos.map((t) => (
          <TodoItem key={t.id} todo={t} onToggle={toggle} onRemove={remove} />
        ))}
      </ul>
    </div>
  )
}
`

const TODO_ITEM_JSX = `export default function TodoItem({ todo, onToggle, onRemove }) {
  return (
    <li className={todo.done ? "item done" : "item"}>
      <label>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
        />
        <span>{todo.text}</span>
      </label>
      <button className="remove" onClick={() => onRemove(todo.id)}>
        ×
      </button>
    </li>
  )
}
`

const APP_CSS = `.app { max-width: 480px; margin: 0 auto; padding: 3rem 1.5rem; font-family: system-ui, sans-serif; }
.header h1 { font-size: 2rem; margin-bottom: 0.25rem; }
.header p { color: #667; margin-bottom: 1.5rem; }
.composer { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.composer input { flex: 1; padding: 0.6rem 0.9rem; border: 1px solid #ccd; border-radius: 8px; font-size: 1rem; }
.composer button { padding: 0.6rem 1.2rem; border: none; border-radius: 8px; background: #4f46e5; color: white; font-size: 1rem; cursor: pointer; }
.list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.item { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.9rem; border: 1px solid #e2e4ee; border-radius: 8px; }
.item label { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
.item.done span { text-decoration: line-through; color: #99a; }
.remove { border: none; background: none; color: #c66; font-size: 1.2rem; cursor: pointer; }
`

const APP_CSS_PURPLE = APP_CSS.replace(
  ".header h1 { font-size: 2rem;",
  ".header h1 { font-size: 2rem; color: #7c3aed;"
)

const CREATE_OUTPUT = `<summary>Built a todo app with add, toggle, delete and localStorage persistence.</summary>
\`\`\`file:src/App.jsx
${APP_JSX}\`\`\`
\`\`\`file:src/components/TodoItem.jsx
${TODO_ITEM_JSX}\`\`\`
\`\`\`file:src/App.css
${APP_CSS}\`\`\``

// Same app but App.jsx has a syntax error (unclosed JSX tag).
const BROKEN_CREATE_OUTPUT = CREATE_OUTPUT.replace(
  "<header className=\"header\">",
  "<header className=\"header\">\n      <div>"
)

const REPAIR_OUTPUT = `<summary>Fixed the unclosed tag in App.jsx.</summary>
\`\`\`file:src/App.jsx
${APP_JSX}\`\`\``

const EDIT_OUTPUT = `<summary>Made the header title purple.</summary>
\`\`\`file:src/App.css
${APP_CSS_PURPLE}\`\`\``

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

let mock: MockProvider | null = null

export function getMockProvider(mode: string): Provider {
  if (!mock) mock = new MockProvider(mode)
  return mock
}
