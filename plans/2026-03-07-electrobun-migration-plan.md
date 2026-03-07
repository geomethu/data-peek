# Electrobun Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the data-peek desktop app from Electron to Electrobun, starting with a prototype to validate unknowns, then incrementally porting all 92 IPC endpoints, 4 database adapters, and native features.

**Architecture:** Electrobun uses a Zig launcher + Bun worker + system webview three-process model. The Electron `ipcMain`/`ipcRenderer` pattern is replaced by typed bidirectional RPC via `BrowserView.defineRPC()`. Internal storage moves from `electron-store` (JSON) to `bun:sqlite`. Database adapters keep their existing packages (`pg`, `mysql2`, `mssql`) but `better-sqlite3` is replaced by `bun:sqlite`.

**Tech Stack:** Electrobun, Bun, TypeScript, React 19, Vite, TanStack Router, Monaco Editor, Zustand, shadcn/ui, Tailwind CSS 4, bun:sqlite

**Design Doc:** `plans/2026-03-07-electrobun-migration-design.md`

---

## Phase 0: Prototype (Validate Unknowns)

The prototype validates: Monaco on system WebKit, ssh2 on Bun, mssql on Bun, Bun.SQL for PostgreSQL/MySQL, basic RPC round-trip, and shadcn/ui rendering. Everything happens on a feature branch.

---

### Task 0.1: Create Feature Branch

**Files:** None

**Step 1: Create and switch to the feature branch**

Run:
```bash
git checkout -b feat/electrobun-migration
```

**Step 2: Commit the plan**

Run:
```bash
git add plans/2026-03-07-electrobun-migration-plan.md
git commit -m "docs: add Electrobun migration implementation plan"
```

---

### Task 0.2: Scaffold Electrobun Project

**Files:**
- Create: `apps/desktop-electrobun/electrobun.config.ts`
- Create: `apps/desktop-electrobun/src/bun/index.ts`
- Create: `apps/desktop-electrobun/src/shared/rpc-types.ts`
- Create: `apps/desktop-electrobun/src/views/main/index.html`
- Create: `apps/desktop-electrobun/src/views/main/index.ts`
- Create: `apps/desktop-electrobun/package.json`
- Modify: `pnpm-workspace.yaml` (add workspace entry)

We scaffold a **separate** `apps/desktop-electrobun/` directory for the prototype. This lets us validate without touching the existing Electron app. Once the prototype passes, we'll convert `apps/desktop/` in-place.

**Step 1: Install Bun (if not already installed)**

Run:
```bash
which bun || curl -fsSL https://bun.sh/install | bash
bun --version
```
Expected: Bun version >= 1.1.27

**Step 2: Create the project directory**

Run:
```bash
mkdir -p apps/desktop-electrobun
```

**Step 3: Initialize with electrobun**

Run:
```bash
cd apps/desktop-electrobun && bunx electrobun init
```

Review the generated scaffold. If `bunx electrobun init` fails or produces unexpected output, manually create the project structure in the following steps.

**Step 4: Create/update `electrobun.config.ts`**

```typescript
import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'Data Peek',
    identifier: 'dev.datapeek.app',
    version: '0.14.0',
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: 'src/bun/index.ts',
    },
    views: {
      main: {
        entrypoint: 'src/views/main/index.ts',
      },
    },
    copy: {
      'src/views/main/index.html': 'views/main/index.html',
    },
  },
} satisfies ElectrobunConfig
```

**Step 5: Create shared RPC types**

File: `apps/desktop-electrobun/src/shared/rpc-types.ts`

```typescript
import type { RPCSchema } from 'electrobun'

export type DataPeekRPC = {
  bun: RPCSchema<{
    requests: {
      ping: {
        params: { message: string }
        response: { reply: string; timestamp: number }
      }
    }
    messages: {
      log: { msg: string }
    }
  }>
  webview: RPCSchema<{
    requests: {}
    messages: {
      notify: { title: string; body: string }
    }
  }>
}
```

**Step 6: Create Bun entry point**

File: `apps/desktop-electrobun/src/bun/index.ts`

```typescript
import { BrowserWindow, BrowserView, Electrobun } from 'electrobun/bun'
import type { DataPeekRPC } from '../shared/rpc-types'

const rpc = BrowserView.defineRPC<DataPeekRPC>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      ping: ({ message }) => {
        console.log(`[bun] received ping: ${message}`)
        return { reply: `pong: ${message}`, timestamp: Date.now() }
      },
    },
    messages: {
      log: ({ msg }) => {
        console.log(`[bun] webview log: ${msg}`)
      },
    },
  },
})

const win = new BrowserWindow({
  title: 'Data Peek (Electrobun Prototype)',
  url: 'views://main/index.html',
  frame: {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
  rpc,
})

console.log('[bun] Data Peek prototype started')
```

**Step 7: Create webview HTML**

File: `apps/desktop-electrobun/src/views/main/index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Peek</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.js"></script>
</body>
</html>
```

**Step 8: Create webview entry point**

File: `apps/desktop-electrobun/src/views/main/index.ts`

```typescript
const root = document.getElementById('root')!
root.innerHTML = '<h1>Data Peek - Electrobun Prototype</h1><p>RPC test loading...</p>'

async function testRPC() {
  try {
    // @ts-expect-error - electrobun injects rpc on window
    const result = await window.rpc.request.ping({ message: 'hello from webview' })
    root.innerHTML = `<h1>Data Peek - Electrobun Prototype</h1><pre>${JSON.stringify(result, null, 2)}</pre>`
  } catch (err) {
    root.innerHTML = `<h1>Data Peek - Electrobun Prototype</h1><p style="color: red;">RPC Error: ${err}</p>`
  }
}

testRPC()
```

**Step 9: Build and run**

Run:
```bash
cd apps/desktop-electrobun && electrobun dev
```

Expected: A window opens showing "Data Peek - Electrobun Prototype" with the RPC ping/pong result displayed.

**Step 10: Commit**

Run:
```bash
git add apps/desktop-electrobun/
git commit -m "feat(electrobun): scaffold prototype project with basic RPC"
```

---

### Task 0.3: Validate Monaco Editor on System WebKit

**Files:**
- Modify: `apps/desktop-electrobun/package.json` (add dependencies)
- Modify: `apps/desktop-electrobun/src/views/main/index.html`
- Modify: `apps/desktop-electrobun/src/views/main/index.ts`

**Step 1: Install Monaco and React dependencies**

Run:
```bash
cd apps/desktop-electrobun && bun add react react-dom @monaco-editor/react monaco-editor
```

**Step 2: Update the webview entry to render Monaco**

File: `apps/desktop-electrobun/src/views/main/index.ts`

```typescript
import { createRoot } from 'react-dom/client'
import { createElement, useState } from 'react'
import Editor from '@monaco-editor/react'

function App() {
  const [value, setValue] = useState('SELECT * FROM users\nWHERE id = 1;')
  const [result, setResult] = useState<string | null>(null)

  const handleRun = async () => {
    try {
      // @ts-expect-error - electrobun injects rpc on window
      const res = await window.rpc.request.ping({ message: value })
      setResult(JSON.stringify(res, null, 2))
    } catch (err) {
      setResult(`Error: ${err}`)
    }
  }

  return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100vh' } },
    createElement('div', { style: { flex: 1, minHeight: 0 } },
      createElement(Editor, {
        height: '100%',
        defaultLanguage: 'sql',
        value,
        onChange: (v) => setValue(v || ''),
        theme: 'vs-dark',
        options: {
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
        },
      })
    ),
    createElement('button', { onClick: handleRun, style: { padding: '8px 16px', margin: '8px' } }, 'Run Query (RPC Test)'),
    result && createElement('pre', { style: { padding: '8px', background: '#1e1e1e', color: '#d4d4d4', margin: '8px', maxHeight: '200px', overflow: 'auto' } }, result)
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(createElement(App))
```

**Step 3: Build and run**

Run:
```bash
cd apps/desktop-electrobun && electrobun dev
```

**Step 4: Validate Monaco**

Check the following in the running app:
- [ ] Monaco editor renders with SQL syntax highlighting
- [ ] Typing works (no IME issues)
- [ ] Scrolling works smoothly
- [ ] Dark theme renders correctly
- [ ] Copy/paste works (Cmd+C, Cmd+V)
- [ ] Multi-cursor works (Cmd+D or Alt+Click)

If any of these fail on macOS WebKit, document the issue and consider toggling to CEF.

**Step 5: Commit**

Run:
```bash
git add -A apps/desktop-electrobun/
git commit -m "feat(electrobun): validate Monaco editor on system webview"
```

---

### Task 0.4: Validate Database Drivers on Bun

**Files:**
- Create: `apps/desktop-electrobun/src/bun/validate-drivers.ts`

This task validates that `pg`, `mysql2`, `mssql`, and `bun:sqlite` work on the Bun runtime. Run each test against a real database if available, or just verify imports and basic construction don't crash.

**Step 1: Install database dependencies**

Run:
```bash
cd apps/desktop-electrobun && bun add pg mysql2 mssql
```

**Step 2: Create driver validation script**

File: `apps/desktop-electrobun/src/bun/validate-drivers.ts`

```typescript
import { Database } from 'bun:sqlite'

async function validateSQLite() {
  console.log('[sqlite] Testing bun:sqlite...')
  const db = new Database(':memory:')
  db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
  db.run("INSERT INTO test (name) VALUES ('hello')")
  const rows = db.query('SELECT * FROM test').all()
  console.log('[sqlite] Result:', rows)
  db.close()
  console.log('[sqlite] PASSED')
}

async function validatePostgres() {
  console.log('[pg] Testing pg import...')
  const { Client } = await import('pg')
  const client = new Client()
  console.log('[pg] Client constructor works')
  // Connect test requires a running PostgreSQL instance
  // Uncomment to test: await client.connect(); const res = await client.query('SELECT 1'); console.log(res.rows)
  console.log('[pg] PASSED (import only)')
}

async function validateMySQL() {
  console.log('[mysql2] Testing mysql2 import...')
  const mysql = await import('mysql2/promise')
  console.log('[mysql2] Module loaded')
  // Connect test requires a running MySQL instance
  console.log('[mysql2] PASSED (import only)')
}

async function validateMSSQL() {
  console.log('[mssql] Testing mssql import...')
  const sql = await import('mssql')
  console.log('[mssql] Module loaded')
  // Connect test requires a running MSSQL instance
  console.log('[mssql] PASSED (import only)')
}

async function main() {
  console.log('=== Database Driver Validation ===\n')

  await validateSQLite()
  console.log()

  await validatePostgres()
  console.log()

  await validateMySQL()
  console.log()

  try {
    await validateMSSQL()
  } catch (err) {
    console.log('[mssql] FAILED:', err)
  }

  console.log('\n=== Validation Complete ===')
}

main()
```

**Step 3: Run validation**

Run:
```bash
cd apps/desktop-electrobun && bun run src/bun/validate-drivers.ts
```

Expected: All four drivers import successfully. SQLite runs a full round-trip. If `mssql` fails on import, document the error — this confirms the known Bun compatibility issue.

**Step 4: (Optional) Test with real databases**

If you have PostgreSQL/MySQL/MSSQL running locally, uncomment the connect tests and run again with connection details:

Run:
```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=test bun run src/bun/validate-drivers.ts
```

**Step 5: Commit**

Run:
```bash
git add apps/desktop-electrobun/src/bun/validate-drivers.ts
git commit -m "feat(electrobun): validate database drivers on Bun runtime"
```

---

### Task 0.5: Validate ssh2 on Bun

**Files:**
- Create: `apps/desktop-electrobun/src/bun/validate-ssh2.ts`

**Step 1: Install ssh2**

Run:
```bash
cd apps/desktop-electrobun && bun add ssh2
bun add -D @types/ssh2
```

**Step 2: Create ssh2 validation script**

File: `apps/desktop-electrobun/src/bun/validate-ssh2.ts`

```typescript
async function validateSSH2() {
  console.log('[ssh2] Testing ssh2 import on Bun...')

  const { Client } = await import('ssh2')
  console.log('[ssh2] Client constructor imported')

  const client = new Client()
  console.log('[ssh2] Client instance created')

  // Test that event listeners can be attached
  client.on('ready', () => {
    console.log('[ssh2] Ready event would fire')
  })

  client.on('error', (err: Error) => {
    console.log('[ssh2] Error event handler works:', err.message)
  })

  console.log('[ssh2] Event listeners attached')

  // Test net module (used by ssh-tunnel-service)
  const net = await import('net')
  const server = net.createServer()
  console.log('[ssh2] net.createServer() works')
  server.close()

  console.log('[ssh2] PASSED (import + construction)')
  console.log('[ssh2] Note: Full tunnel test requires an SSH server')
}

validateSSH2().catch((err) => {
  console.error('[ssh2] FAILED:', err)
  process.exit(1)
})
```

**Step 3: Run validation**

Run:
```bash
cd apps/desktop-electrobun && bun run src/bun/validate-ssh2.ts
```

Expected: ssh2 imports, Client constructs, event listeners attach, `net.createServer()` works.

**Step 4: Commit**

Run:
```bash
git add apps/desktop-electrobun/src/bun/validate-ssh2.ts
git commit -m "feat(electrobun): validate ssh2 compatibility on Bun"
```

---

### Task 0.6: Validate shadcn/ui + Tailwind CSS 4 on System Webview

**Files:**
- Modify: `apps/desktop-electrobun/package.json` (add Tailwind + shadcn deps)
- Create: `apps/desktop-electrobun/src/views/main/global.css`
- Modify: `apps/desktop-electrobun/src/views/main/index.ts`

**Step 1: Install Tailwind and UI dependencies**

Run:
```bash
cd apps/desktop-electrobun && bun add tailwindcss @tailwindcss/vite class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot
```

**Step 2: Create global CSS with Tailwind**

File: `apps/desktop-electrobun/src/views/main/global.css`

```css
@import 'tailwindcss';
```

**Step 3: Update webview entry to use Tailwind classes and a shadcn-style button**

File: `apps/desktop-electrobun/src/views/main/index.ts`

Replace the existing App component to include Tailwind-styled elements:

```typescript
import './global.css'
import { createRoot } from 'react-dom/client'
import { createElement, useState } from 'react'
import Editor from '@monaco-editor/react'

function App() {
  const [value, setValue] = useState('SELECT * FROM users\nWHERE id = 1;')
  const [result, setResult] = useState<string | null>(null)

  const handleRun = async () => {
    try {
      // @ts-expect-error - electrobun injects rpc on window
      const res = await window.rpc.request.ping({ message: value })
      setResult(JSON.stringify(res, null, 2))
    } catch (err) {
      setResult(`Error: ${err}`)
    }
  }

  return createElement('div', { className: 'flex flex-col h-screen bg-zinc-950 text-zinc-100' },
    createElement('div', { className: 'flex items-center justify-between px-4 py-2 border-b border-zinc-800' },
      createElement('h1', { className: 'text-sm font-medium' }, 'Data Peek — Electrobun Prototype'),
      createElement('button', {
        onClick: handleRun,
        className: 'inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-colors'
      }, 'Run Query')
    ),
    createElement('div', { className: 'flex-1 min-h-0' },
      createElement(Editor, {
        height: '100%',
        defaultLanguage: 'sql',
        value,
        onChange: (v: string | undefined) => setValue(v || ''),
        theme: 'vs-dark',
        options: { minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' as const },
      })
    ),
    result && createElement('div', { className: 'border-t border-zinc-800 max-h-48 overflow-auto' },
      createElement('pre', { className: 'p-3 text-xs text-zinc-300 font-mono' }, result)
    )
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(createElement(App))
```

**Step 4: Build and verify**

Run:
```bash
cd apps/desktop-electrobun && electrobun dev
```

Check:
- [ ] Tailwind utility classes apply correctly (flex, bg-zinc-950, rounded-md, etc.)
- [ ] Hover transitions work
- [ ] Border rendering is crisp
- [ ] Font rendering looks native

**Step 5: Commit**

Run:
```bash
git add -A apps/desktop-electrobun/
git commit -m "feat(electrobun): validate Tailwind CSS 4 + shadcn patterns on system webview"
```

---

### Task 0.7: Prototype PostgreSQL Query Execution via RPC

**Files:**
- Modify: `apps/desktop-electrobun/src/shared/rpc-types.ts`
- Modify: `apps/desktop-electrobun/src/bun/index.ts`
- Modify: `apps/desktop-electrobun/src/views/main/index.ts`

This is the key integration test: connect to a real PostgreSQL database from Bun, execute a query, and display results in the webview via RPC.

**Step 1: Expand RPC types for database queries**

File: `apps/desktop-electrobun/src/shared/rpc-types.ts`

```typescript
import type { RPCSchema } from 'electrobun'

export interface QueryField {
  name: string
  dataType: string
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  fields: QueryField[]
  rowCount: number
  durationMs: number
}

export interface ConnectionParams {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export type DataPeekRPC = {
  bun: RPCSchema<{
    requests: {
      ping: {
        params: { message: string }
        response: { reply: string; timestamp: number }
      }
      dbConnect: {
        params: ConnectionParams
        response: { success: boolean; error?: string }
      }
      dbQuery: {
        params: { sql: string }
        response: QueryResult
      }
      dbDisconnect: {
        params: {}
        response: { success: boolean }
      }
    }
    messages: {
      log: { msg: string }
    }
  }>
  webview: RPCSchema<{
    requests: {}
    messages: {
      notify: { title: string; body: string }
    }
  }>
}
```

**Step 2: Implement database RPC handlers in Bun**

File: `apps/desktop-electrobun/src/bun/index.ts`

```typescript
import { BrowserWindow, BrowserView, Electrobun } from 'electrobun/bun'
import { Client } from 'pg'
import type { DataPeekRPC, ConnectionParams } from '../shared/rpc-types'

let pgClient: Client | null = null

const rpc = BrowserView.defineRPC<DataPeekRPC>({
  maxRequestTime: 30000,
  handlers: {
    requests: {
      ping: ({ message }) => {
        return { reply: `pong: ${message}`, timestamp: Date.now() }
      },

      dbConnect: async (params: ConnectionParams) => {
        try {
          if (pgClient) {
            await pgClient.end()
          }
          pgClient = new Client({
            host: params.host,
            port: params.port,
            database: params.database,
            user: params.user,
            password: params.password,
          })
          await pgClient.connect()
          return { success: true }
        } catch (err) {
          return { success: false, error: String(err) }
        }
      },

      dbQuery: async ({ sql }) => {
        if (!pgClient) {
          throw new Error('Not connected to a database')
        }
        const start = performance.now()
        const result = await pgClient.query(sql)
        const durationMs = Math.round(performance.now() - start)

        return {
          rows: result.rows,
          fields: result.fields.map((f) => ({
            name: f.name,
            dataType: String(f.dataTypeID),
          })),
          rowCount: result.rowCount ?? 0,
          durationMs,
        }
      },

      dbDisconnect: async () => {
        if (pgClient) {
          await pgClient.end()
          pgClient = null
        }
        return { success: true }
      },
    },
    messages: {
      log: ({ msg }) => console.log(`[webview] ${msg}`),
    },
  },
})

const win = new BrowserWindow({
  title: 'Data Peek (Electrobun Prototype)',
  url: 'views://main/index.html',
  frame: {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
  rpc,
})

console.log('[bun] Data Peek prototype started')
```

**Step 3: Update webview to include connection form + results table**

File: `apps/desktop-electrobun/src/views/main/index.ts`

```typescript
import './global.css'
import { createRoot } from 'react-dom/client'
import { createElement, useState } from 'react'
import Editor from '@monaco-editor/react'

function App() {
  const [connParams, setConnParams] = useState({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
  })
  const [connected, setConnected] = useState(false)
  const [sql, setSql] = useState('SELECT 1 AS test;')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    setLoading(true)
    setError(null)
    try {
      // @ts-expect-error - electrobun injects rpc
      const res = await window.rpc.request.dbConnect(connParams)
      if (res.success) {
        setConnected(true)
      } else {
        setError(res.error || 'Connection failed')
      }
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  const runQuery = async () => {
    setLoading(true)
    setError(null)
    try {
      // @ts-expect-error - electrobun injects rpc
      const res = await window.rpc.request.dbQuery({ sql })
      setResult(res)
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  const input = (label: string, key: string, type = 'text') =>
    createElement('div', { className: 'flex flex-col gap-1' },
      createElement('label', { className: 'text-xs text-zinc-400' }, label),
      createElement('input', {
        type,
        value: (connParams as any)[key],
        onChange: (e: any) => setConnParams({ ...connParams, [key]: type === 'number' ? Number(e.target.value) : e.target.value }),
        className: 'h-8 px-2 rounded border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 outline-none focus:border-zinc-500',
      })
    )

  if (!connected) {
    return createElement('div', { className: 'flex items-center justify-center h-screen bg-zinc-950 text-zinc-100' },
      createElement('div', { className: 'flex flex-col gap-3 w-80' },
        createElement('h1', { className: 'text-lg font-medium mb-2' }, 'Connect to PostgreSQL'),
        input('Host', 'host'),
        input('Port', 'port', 'number'),
        input('Database', 'database'),
        input('User', 'user'),
        input('Password', 'password', 'password'),
        error && createElement('p', { className: 'text-xs text-red-400' }, error),
        createElement('button', {
          onClick: connect,
          disabled: loading,
          className: 'h-9 rounded bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50',
        }, loading ? 'Connecting...' : 'Connect')
      )
    )
  }

  return createElement('div', { className: 'flex flex-col h-screen bg-zinc-950 text-zinc-100' },
    createElement('div', { className: 'flex items-center justify-between px-4 py-2 border-b border-zinc-800' },
      createElement('h1', { className: 'text-sm font-medium' }, `Connected to ${connParams.database}`),
      createElement('div', { className: 'flex gap-2' },
        createElement('span', { className: 'text-xs text-zinc-400 self-center' },
          result ? `${result.rowCount} rows in ${result.durationMs}ms` : ''
        ),
        createElement('button', {
          onClick: runQuery,
          disabled: loading,
          className: 'h-8 px-3 rounded bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50',
        }, loading ? 'Running...' : 'Run')
      )
    ),
    createElement('div', { className: 'h-48 border-b border-zinc-800' },
      createElement(Editor, {
        height: '100%',
        defaultLanguage: 'sql',
        value: sql,
        onChange: (v: string | undefined) => setSql(v || ''),
        theme: 'vs-dark',
        options: { minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' as const },
      })
    ),
    error && createElement('div', { className: 'px-4 py-2 bg-red-950 text-red-300 text-xs' }, error),
    result && createElement('div', { className: 'flex-1 min-h-0 overflow-auto' },
      createElement('table', { className: 'w-full text-xs' },
        createElement('thead', {},
          createElement('tr', { className: 'border-b border-zinc-800' },
            ...result.fields.map((f: any) =>
              createElement('th', { key: f.name, className: 'px-3 py-2 text-left text-zinc-400 font-medium sticky top-0 bg-zinc-950' }, f.name)
            )
          )
        ),
        createElement('tbody', {},
          ...result.rows.map((row: any, i: number) =>
            createElement('tr', { key: i, className: 'border-b border-zinc-900 hover:bg-zinc-900/50' },
              ...result.fields.map((f: any) =>
                createElement('td', { key: f.name, className: 'px-3 py-1.5 text-zinc-300 font-mono' },
                  row[f.name] === null ? createElement('span', { className: 'text-zinc-600 italic' }, 'NULL') : String(row[f.name])
                )
              )
            )
          )
        )
      )
    )
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(createElement(App))
```

**Step 4: Build and test with a real PostgreSQL database**

Run:
```bash
cd apps/desktop-electrobun && electrobun dev
```

Test:
- [ ] Connection form renders
- [ ] Can connect to a local PostgreSQL instance
- [ ] Can run `SELECT * FROM pg_catalog.pg_tables LIMIT 10;`
- [ ] Results display in the table with correct column names and values
- [ ] Duration and row count display correctly
- [ ] NULL values render distinctly

**Step 5: Commit**

Run:
```bash
git add -A apps/desktop-electrobun/
git commit -m "feat(electrobun): prototype PostgreSQL query execution via RPC"
```

---

### Task 0.8: Evaluate Prototype and Document Findings

**Files:**
- Create: `plans/2026-03-07-prototype-findings.md`

**Step 1: Run all validation checks and document results**

Create a findings document:

```markdown
# Electrobun Prototype Findings

**Date:** YYYY-MM-DD

## Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Monaco on system WebKit (macOS) | PASS/FAIL | |
| Monaco on WebView2 (Windows) | PASS/FAIL/UNTESTED | |
| RPC round-trip | PASS/FAIL | |
| PostgreSQL via `pg` on Bun | PASS/FAIL | |
| MySQL via `mysql2` on Bun | PASS/FAIL | |
| MSSQL via `mssql` on Bun | PASS/FAIL | |
| SQLite via `bun:sqlite` | PASS/FAIL | |
| `ssh2` import on Bun | PASS/FAIL | |
| Tailwind CSS 4 rendering | PASS/FAIL | |
| shadcn/ui patterns rendering | PASS/FAIL | |

## Blockers Found

(List any issues that would prevent proceeding with the full migration)

## Decision

- [ ] Proceed with full migration (Phase 1-7)
- [ ] Proceed with modifications (list changes to plan)
- [ ] Abort migration (list reasons)
```

**Step 2: Commit**

Run:
```bash
git add plans/2026-03-07-prototype-findings.md
git commit -m "docs: document Electrobun prototype validation findings"
```

---

## Phase 1-7: Full Migration (Post-Prototype)

The following phases execute only after Phase 0 validates successfully. Each phase is outlined at a high level here. Detailed task breakdowns will be written after prototype validation, since findings may change the approach.

---

### Phase 1: Project Scaffold (In-Place Conversion)

After prototype validation, convert `apps/desktop/` in-place:

1. **Remove Electron deps** — Remove `electron`, `electron-vite`, `electron-builder`, `electron-updater`, `electron-store`, `electron-log`, `@electron-toolkit/*` from `package.json`
2. **Add Electrobun deps** — Add `electrobun` and configure `electrobun.config.ts`
3. **Restructure directories** — Move `src/main/` → `src/bun/`, remove `src/preload/` (RPC replaces it)
4. **Configure Vite for renderer** — Set up Vite config for `src/views/` (renderer bundle only)
5. **Verify React app loads** — Get the existing React app rendering in Electrobun webview
6. **Path aliases** — Configure `@/*` and `@shared/*` in the new build setup
7. **Hot reload** — Verify `electrobun dev` provides hot reload for the renderer

### Phase 2: Internal Storage

1. **SQLite schema** — Design tables for connections, settings, saved queries, snippets, scheduled queries, dashboards, AI config
2. **Storage service** — Implement `BunStorage` class wrapping `bun:sqlite` with same interface as `DpStorage`
3. **Secure storage** — Platform keychain integration for encryption keys (replacing `safeStorage`)
4. **Data migration** — Utility to read old `electron-store` JSON files and migrate to SQLite
5. **Logger** — Replace `electron-log` with file-based logger using `Bun.file()`

### Phase 3: Database Adapters + Query RPC

1. **Adapter interface** — Port `DatabaseAdapter` interface (no changes needed)
2. **PostgreSQL adapter** — Port from `pg`, evaluate `Bun.SQL` as alternative
3. **MySQL adapter** — Port from `mysql2`, evaluate `Bun.SQL` as alternative
4. **MSSQL adapter** — Port from `mssql` (keep as-is)
5. **SQLite adapter** — Replace `better-sqlite3` with `bun:sqlite`
6. **RPC type definitions** — Define all 11 query handler types in shared RPC schema
7. **RPC handlers** — Implement all query handlers
8. **Query tracker** — Port cancellation mechanism
9. **Schema cache** — Port caching logic

### Phase 4: Connection + CRUD RPC

1. **Connection RPC** — 4 handlers + broadcast to all windows
2. **DDL RPC** — 7 handlers
3. **Saved queries RPC** — 5 handlers
4. **Snippets RPC** — 4 handlers
5. **File dialog** — Replace `dialog.showOpenDialog` with `Utils.openFileDialog`
6. **Renderer updates** — Update all `window.api.*` calls to use RPC

### Phase 5: Native Features

1. **Application menu** — Port `menu.ts` to `ApplicationMenu.setApplicationMenu()`
2. **Context menu** — Port `context-menu.ts` to `ContextMenu.showContextMenu()`
3. **Window management** — Port `window-manager.ts` to Electrobun `BrowserWindow`
4. **Window state** — Port `window-state.ts` (persist/restore bounds)
5. **Auto-updater** — Port to Electrobun `Updater` API
6. **Notifications** — Port `Notification` usage in scheduler service
7. **Shell open** — Replace `shell.openExternal` with Bun equivalent

### Phase 6: Advanced Features

1. **SSH tunneling** — Port `ssh-tunnel-service.ts` (uses `ssh2` + `net`)
2. **Scheduled queries** — Port `scheduler-service.ts` (uses `node-cron`)
3. **Dashboards** — Port `dashboard-service.ts` (18 RPC handlers)
4. **AI service** — Port `ai-service.ts` (20 RPC handlers, Vercel AI SDK)
5. **License service** — Port `license-service.ts` (HTTP + device fingerprint)
6. **Telemetry** — Port `telemetry-collector.ts` + `performance-analyzer.ts`
7. **SQL/DDL builders** — Port `sql-builder.ts` + `ddl-builder.ts` (pure logic, no Electron deps)

### Phase 7: Build, Package, Distribute

1. **Build pipeline** — Configure `electrobun build` for stable/canary channels
2. **Code signing** — macOS notarization via build lifecycle hooks
3. **Windows packaging** — `.exe` / `.zip` output
4. **Linux packaging** — `.tar.gz` for Ubuntu
5. **Auto-update hosting** — Set up static file hosting for update patches
6. **CI/CD** — Update GitHub Actions workflows
7. **Homebrew** — Update Cask formula for new binary format
8. **Migration guide** — Document for existing users upgrading from Electron version

---

## Appendix: Key Electrobun API Reference

### RPC Type Definition Pattern
```typescript
import type { RPCSchema } from 'electrobun'

export type MyRPC = {
  bun: RPCSchema<{
    requests: { fnName: { params: { ... }; response: { ... } } }
    messages: { msgName: { ... } }
  }>
  webview: RPCSchema<{
    requests: { ... }
    messages: { ... }
  }>
}
```

### BrowserWindow Creation
```typescript
import { BrowserWindow, BrowserView } from 'electrobun/bun'
const rpc = BrowserView.defineRPC<MyRPC>({ handlers: { ... } })
const win = new BrowserWindow({ title: '...', url: 'views://viewname/index.html', frame: { width, height, x, y }, rpc })
```

### Application Menu
```typescript
import { ApplicationMenu, Electrobun } from 'electrobun/bun'
ApplicationMenu.setApplicationMenu([{ submenu: [{ label: 'Quit', role: 'quit' }] }, ...])
Electrobun.events.on('application-menu-clicked', (e) => { /* e.data.action */ })
```

### Context Menu
```typescript
import { ContextMenu, Electrobun } from 'electrobun/bun'
ContextMenu.showContextMenu([{ role: 'copy' }, { label: 'Custom', action: 'my-action' }])
Electrobun.events.on('context-menu-clicked', (e) => { /* e.data.action */ })
```

### File Dialog
```typescript
import { Utils } from 'electrobun/bun'
const paths = await Utils.openFileDialog({ startingFolder: '~', canChooseFiles: true, allowsMultipleSelection: false })
```

### Paths
```typescript
import { Utils } from 'electrobun/bun'
Utils.paths.home       // home directory
Utils.paths.userData   // app-scoped data directory
Utils.paths.downloads  // downloads directory
```

### Auto-Updater
```typescript
import { Updater } from 'electrobun/bun'
const info = await Updater.getLocalInfo()
const update = await Updater.checkForUpdate()
await Updater.downloadUpdate()
await Updater.applyUpdate() // relaunches app
```

### Global Shortcuts
```typescript
import { GlobalShortcut } from 'electrobun/bun'
GlobalShortcut.register('CommandOrControl+Shift+Space', () => { ... })
```

### Clipboard
```typescript
import { Utils } from 'electrobun/bun'
Utils.clipboardWriteText('text')
const text = Utils.clipboardReadText()
```
