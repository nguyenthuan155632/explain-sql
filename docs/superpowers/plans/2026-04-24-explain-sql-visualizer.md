# explain-sql Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side React + D3 web app that parses PostgreSQL/MySQL EXPLAIN ANALYZE JSON output and renders it as an interactive collapsible tree with dense node cards, zoom/pan, and PNG/SVG export.

**Architecture:** Four layers — Input (paste textarea) → Parser (pg.ts / mysql.ts → PlanNode tree) → Visualization (D3 layout + React foreignObject node cards in SVG) → Export (offscreen plain-SVG renderer captured by html-to-image). D3 owns x/y positioning only; React owns all rendering.

**Tech Stack:** Vite, React 18, TypeScript, D3 v7, html-to-image, Vitest, @testing-library/react

---

## File Map

| File | Responsibility |
|---|---|
| `src/parsers/types.ts` | `PlanNode` interface |
| `src/parsers/detect.ts` | Auto-detect PG vs MySQL from raw string |
| `src/parsers/pg.ts` | Parse PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` → `PlanNode` |
| `src/parsers/mysql.ts` | Parse MySQL `EXPLAIN FORMAT=JSON` → `PlanNode` |
| `src/utils/nodeColor.ts` | Map node type string → `{ border, background }` colors |
| `src/hooks/useD3Tree.ts` | Run `d3.hierarchy` + `d3.tree` layout → positioned nodes + links |
| `src/hooks/useExport.ts` | Build offscreen SVG and trigger PNG/SVG download |
| `src/components/NodeCard.tsx` | Dense data card rendered as `<foreignObject>` |
| `src/components/NodeCard.module.css` | Card layout styles |
| `src/components/TreeLayout.tsx` | Render SVG edges + positioned `NodeCard`s |
| `src/components/TreeCanvas.tsx` | SVG root with D3 zoom/pan, toolbar |
| `src/components/Legend.tsx` | Color legend bottom-left |
| `src/components/InputPanel.tsx` | Paste textarea, db badge, Visualize + Export buttons |
| `src/components/InputPanel.module.css` | Input panel styles |
| `src/components/App.tsx` | Root layout: left panel + right panel |
| `src/components/App.module.css` | Root layout styles |
| `tests/parsers/pg.test.ts` | PG parser unit tests |
| `tests/parsers/mysql.test.ts` | MySQL parser unit tests |
| `tests/parsers/detect.test.ts` | Auto-detect unit tests |
| `tests/utils/nodeColor.test.ts` | nodeColor unit tests |
| `tests/components/NodeCard.test.tsx` | NodeCard render tests |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd /Users/thuan.nv/workspaces/explain-sql
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?" — choose **No, keep files**.

- [ ] **Step 2: Install dependencies**

```bash
npm install d3 html-to-image
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/d3
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

Replace the generated `vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 4: Create test setup file**

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, ensure `scripts` contains:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify scaffold works**

```bash
npm run dev
```

Expected: Vite dev server starts on `http://localhost:5173`. Open it and confirm the default React page loads. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

## Task 2: PlanNode type definition

**Files:**
- Create: `src/parsers/types.ts`

- [ ] **Step 1: Write `src/parsers/types.ts`**

```typescript
export interface PlanNode {
  // Identity
  nodeType: string
  relationName?: string
  alias?: string
  indexName?: string
  parentRelationship?: string

  // Planner estimates
  startupCost: number
  totalCost: number
  planRows: number
  planWidth: number

  // Actual execution
  actualStartupTime?: number
  actualTotalTime?: number
  actualRows?: number
  actualLoops?: number

  // Derived
  totalActualTime?: number     // actualTotalTime * actualLoops
  rowEstimateError?: number    // actualRows / planRows

  // Buffers
  sharedHitBlocks?: number
  sharedReadBlocks?: number
  sharedDirtiedBlocks?: number
  sharedWrittenBlocks?: number
  localHitBlocks?: number
  localReadBlocks?: number
  tempReadBlocks?: number
  tempWrittenBlocks?: number

  // Conditions
  filter?: string
  rowsRemovedByFilter?: number
  indexCond?: string
  recheckCond?: string
  hashCond?: string
  joinFilter?: string

  // Sort
  sortKey?: string[]
  sortMethod?: string
  sortSpaceUsed?: number
  sortSpaceType?: string

  // Hash / memory
  hashBatches?: number
  originalHashBatches?: number
  peakMemoryUsage?: number

  // Parallel
  workersPlanned?: number
  workersLaunched?: number

  // Tree
  children: PlanNode[]

  // Unknown fields
  raw: Record<string, unknown>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/parsers/types.ts
git commit -m "feat: add PlanNode type definition"
```

---

## Task 3: Auto-detection

**Files:**
- Create: `src/parsers/detect.ts`, `tests/parsers/detect.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/parsers/detect.test.ts
import { describe, it, expect } from 'vitest'
import { detectDb } from '../../src/parsers/detect'

describe('detectDb', () => {
  it('detects PostgreSQL from array JSON', () => {
    const input = JSON.stringify([{ Plan: { 'Node Type': 'Seq Scan' } }])
    expect(detectDb(input)).toBe('pg')
  })

  it('detects MySQL from query_block key', () => {
    const input = JSON.stringify({ query_block: { select_id: 1 } })
    expect(detectDb(input)).toBe('mysql')
  })

  it('detects MySQL from Query Block key', () => {
    const input = JSON.stringify({ 'Query Block': { select_id: 1 } })
    expect(detectDb(input)).toBe('mysql')
  })

  it('returns null for unrecognized input', () => {
    expect(detectDb('not json')).toBeNull()
    expect(detectDb('{}')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/parsers/detect.test.ts
```

Expected: FAIL — `detectDb` not found.

- [ ] **Step 3: Implement `src/parsers/detect.ts`**

```typescript
export type DbType = 'pg' | 'mysql'

export function detectDb(raw: string): DbType | null {
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      ('query_block' in parsed || 'Query Block' in parsed)
    ) {
      return 'mysql'
    }
    if (Array.isArray(parsed) && parsed.length > 0 && 'Plan' in parsed[0]) {
      return 'pg'
    }
    return null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/parsers/detect.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/parsers/detect.ts tests/parsers/detect.test.ts
git commit -m "feat: add database auto-detection"
```

---

## Task 4: PostgreSQL parser

**Files:**
- Create: `src/parsers/pg.ts`, `tests/parsers/pg.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/parsers/pg.test.ts
import { describe, it, expect } from 'vitest'
import { parsePg } from '../../src/parsers/pg'

const SAMPLE_PG = JSON.stringify([
  {
    Plan: {
      'Node Type': 'Hash Join',
      'Startup Cost': 120.0,
      'Total Cost': 480.5,
      'Plan Rows': 1200,
      'Plan Width': 64,
      'Actual Startup Time': 0.143,
      'Actual Total Time': 312.8,
      'Actual Rows': 1185,
      'Actual Loops': 1,
      'Hash Cond': '(o.user_id = u.id)',
      'Shared Hit Blocks': 8840,
      'Shared Read Blocks': 12,
      'Shared Dirtied Blocks': 0,
      'Shared Written Blocks': 0,
      'Local Hit Blocks': 0,
      'Local Read Blocks': 0,
      'Temp Read Blocks': 0,
      'Temp Written Blocks': 0,
      Plans: [
        {
          'Node Type': 'Seq Scan',
          'Parent Relationship': 'Outer',
          'Relation Name': 'orders',
          Alias: 'o',
          'Startup Cost': 0.0,
          'Total Cost': 88.0,
          'Plan Rows': 1000,
          'Plan Width': 32,
          'Actual Startup Time': 0.021,
          'Actual Total Time': 1.84,
          'Actual Rows': 1000,
          'Actual Loops': 1,
          Filter: "(status = 'active')",
          'Rows Removed by Filter': 240,
          'Shared Hit Blocks': 440,
          'Shared Read Blocks': 0,
          'Shared Dirtied Blocks': 0,
          'Shared Written Blocks': 0,
          'Local Hit Blocks': 0,
          'Local Read Blocks': 0,
          'Temp Read Blocks': 0,
          'Temp Written Blocks': 0,
          Plans: [],
        },
      ],
    },
    'Planning Time': 0.5,
    'Execution Time': 313.2,
  },
])

describe('parsePg', () => {
  it('parses root node type', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.nodeType).toBe('Hash Join')
  })

  it('parses cost fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.startupCost).toBe(120.0)
    expect(root.totalCost).toBe(480.5)
    expect(root.planRows).toBe(1200)
    expect(root.planWidth).toBe(64)
  })

  it('parses actual execution fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.actualStartupTime).toBe(0.143)
    expect(root.actualTotalTime).toBe(312.8)
    expect(root.actualRows).toBe(1185)
    expect(root.actualLoops).toBe(1)
  })

  it('computes derived totalActualTime', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.totalActualTime).toBe(312.8) // 312.8 * 1
  })

  it('computes derived rowEstimateError', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.rowEstimateError).toBeCloseTo(1185 / 1200)
  })

  it('parses buffer fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.sharedHitBlocks).toBe(8840)
    expect(root.sharedReadBlocks).toBe(12)
  })

  it('parses condition fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.hashCond).toBe('(o.user_id = u.id)')
  })

  it('parses children recursively', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.children).toHaveLength(1)
    expect(root.children[0].nodeType).toBe('Seq Scan')
    expect(root.children[0].relationName).toBe('orders')
    expect(root.children[0].filter).toBe("(status = 'active')")
    expect(root.children[0].rowsRemovedByFilter).toBe(240)
  })

  it('stores unknown keys in raw', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.raw).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/parsers/pg.test.ts
```

Expected: FAIL — `parsePg` not found.

- [ ] **Step 3: Implement `src/parsers/pg.ts`**

```typescript
import type { PlanNode } from './types'

const KNOWN_KEYS = new Set([
  'Node Type', 'Relation Name', 'Alias', 'Index Name', 'Parent Relationship',
  'Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width',
  'Actual Startup Time', 'Actual Total Time', 'Actual Rows', 'Actual Loops',
  'Shared Hit Blocks', 'Shared Read Blocks', 'Shared Dirtied Blocks', 'Shared Written Blocks',
  'Local Hit Blocks', 'Local Read Blocks', 'Temp Read Blocks', 'Temp Written Blocks',
  'Filter', 'Rows Removed by Filter', 'Index Cond', 'Recheck Cond',
  'Hash Cond', 'Join Filter', 'Sort Key', 'Sort Method',
  'Sort Space Used', 'Sort Space Type', 'Hash Batches', 'Original Hash Batches',
  'Peak Memory Usage', 'Workers Planned', 'Workers Launched', 'Plans',
])

function parseNode(raw: Record<string, unknown>): PlanNode {
  const loops = (raw['Actual Loops'] as number | undefined) ?? 1
  const actualTotalTime = raw['Actual Total Time'] as number | undefined
  const actualRows = raw['Actual Rows'] as number | undefined
  const planRows = raw['Plan Rows'] as number

  const rawUnknown: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) rawUnknown[key] = raw[key]
  }

  const plans = (raw['Plans'] as Record<string, unknown>[] | undefined) ?? []

  return {
    nodeType: raw['Node Type'] as string,
    relationName: raw['Relation Name'] as string | undefined,
    alias: raw['Alias'] as string | undefined,
    indexName: raw['Index Name'] as string | undefined,
    parentRelationship: raw['Parent Relationship'] as string | undefined,

    startupCost: raw['Startup Cost'] as number,
    totalCost: raw['Total Cost'] as number,
    planRows,
    planWidth: raw['Plan Width'] as number,

    actualStartupTime: raw['Actual Startup Time'] as number | undefined,
    actualTotalTime,
    actualRows,
    actualLoops: raw['Actual Loops'] as number | undefined,

    totalActualTime: actualTotalTime !== undefined ? actualTotalTime * loops : undefined,
    rowEstimateError: actualRows !== undefined && planRows > 0 ? actualRows / planRows : undefined,

    sharedHitBlocks: raw['Shared Hit Blocks'] as number | undefined,
    sharedReadBlocks: raw['Shared Read Blocks'] as number | undefined,
    sharedDirtiedBlocks: raw['Shared Dirtied Blocks'] as number | undefined,
    sharedWrittenBlocks: raw['Shared Written Blocks'] as number | undefined,
    localHitBlocks: raw['Local Hit Blocks'] as number | undefined,
    localReadBlocks: raw['Local Read Blocks'] as number | undefined,
    tempReadBlocks: raw['Temp Read Blocks'] as number | undefined,
    tempWrittenBlocks: raw['Temp Written Blocks'] as number | undefined,

    filter: raw['Filter'] as string | undefined,
    rowsRemovedByFilter: raw['Rows Removed by Filter'] as number | undefined,
    indexCond: raw['Index Cond'] as string | undefined,
    recheckCond: raw['Recheck Cond'] as string | undefined,
    hashCond: raw['Hash Cond'] as string | undefined,
    joinFilter: raw['Join Filter'] as string | undefined,

    sortKey: raw['Sort Key'] as string[] | undefined,
    sortMethod: raw['Sort Method'] as string | undefined,
    sortSpaceUsed: raw['Sort Space Used'] as number | undefined,
    sortSpaceType: raw['Sort Space Type'] as string | undefined,

    hashBatches: raw['Hash Batches'] as number | undefined,
    originalHashBatches: raw['Original Hash Batches'] as number | undefined,
    peakMemoryUsage: raw['Peak Memory Usage'] as number | undefined,

    workersPlanned: raw['Workers Planned'] as number | undefined,
    workersLaunched: raw['Workers Launched'] as number | undefined,

    children: plans.map((p) => parseNode(p)),
    raw: rawUnknown,
  }
}

export function parsePg(input: string): PlanNode {
  const parsed = JSON.parse(input)
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0].Plan) {
    throw new Error('Invalid PostgreSQL EXPLAIN FORMAT JSON output')
  }
  return parseNode(parsed[0].Plan as Record<string, unknown>)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/parsers/pg.test.ts
```

Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/parsers/pg.ts tests/parsers/pg.test.ts
git commit -m "feat: add PostgreSQL EXPLAIN JSON parser"
```

---

## Task 5: MySQL parser

**Files:**
- Create: `src/parsers/mysql.ts`, `tests/parsers/mysql.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/parsers/mysql.test.ts
import { describe, it, expect } from 'vitest'
import { parseMysql } from '../../src/parsers/mysql'

const SAMPLE_MYSQL = JSON.stringify({
  query_block: {
    select_id: 1,
    cost_info: { query_cost: '480.50' },
    nested_loop: [
      {
        table: {
          table_name: 'orders',
          access_type: 'ALL',
          rows_examined_per_scan: 1000,
          rows_produced_per_join: 1000,
          filtered: '100.00',
          cost_info: {
            read_cost: '50.00',
            eval_cost: '100.00',
            prefix_cost: '150.00',
          },
        },
      },
      {
        table: {
          table_name: 'users',
          access_type: 'eq_ref',
          key: 'PRIMARY',
          rows_examined_per_scan: 1,
          rows_produced_per_join: 1000,
          filtered: '100.00',
          cost_info: {
            read_cost: '250.00',
            eval_cost: '100.00',
            prefix_cost: '500.00',
          },
        },
      },
    ],
  },
})

describe('parseMysql', () => {
  it('parses root node type from nested_loop', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.nodeType).toBe('Nested Loop')
  })

  it('parses total cost from query_cost', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.totalCost).toBe(480.5)
    expect(root.startupCost).toBe(0)
  })

  it('has no actual timing (FORMAT JSON only has estimates)', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.actualTotalTime).toBeUndefined()
    expect(root.actualRows).toBeUndefined()
  })

  it('parses children for each nested_loop table', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.children).toHaveLength(2)
    expect(root.children[0].nodeType).toBe('ALL')
    expect(root.children[0].relationName).toBe('orders')
    expect(root.children[0].planRows).toBe(1000)
    expect(root.children[1].nodeType).toBe('eq_ref')
    expect(root.children[1].relationName).toBe('users')
    expect(root.children[1].indexName).toBe('PRIMARY')
  })

  it('stores unknown keys in raw', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.raw).toBeDefined()
  })

  it('throws on invalid input', () => {
    expect(() => parseMysql('{}')).toThrow()
    expect(() => parseMysql('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/parsers/mysql.test.ts
```

Expected: FAIL — `parseMysql` not found.

- [ ] **Step 3: Implement `src/parsers/mysql.ts`**

```typescript
import type { PlanNode } from './types'

type MysqlTable = Record<string, unknown>

function tableToNode(table: MysqlTable): PlanNode {
  const cost = table['cost_info'] as Record<string, string> | undefined
  const totalCost = cost?.['prefix_cost'] ? parseFloat(cost['prefix_cost']) : 0
  const raw: Record<string, unknown> = {}
  const knownKeys = new Set([
    'table_name', 'access_type', 'key', 'rows_examined_per_scan',
    'rows_produced_per_join', 'filtered', 'cost_info',
  ])
  for (const k of Object.keys(table)) {
    if (!knownKeys.has(k)) raw[k] = table[k]
  }

  return {
    nodeType: table['access_type'] as string ?? 'table',
    relationName: table['table_name'] as string | undefined,
    indexName: table['key'] as string | undefined,
    startupCost: 0,
    totalCost,
    planRows: (table['rows_examined_per_scan'] as number) ?? 0,
    planWidth: 0,
    children: [],
    raw,
  }
}

function parseQueryBlock(block: Record<string, unknown>): PlanNode {
  const cost = block['cost_info'] as Record<string, string> | undefined
  const totalCost = cost?.['query_cost'] ? parseFloat(cost['query_cost']) : 0

  if ('nested_loop' in block) {
    const tables = block['nested_loop'] as Array<{ table: MysqlTable }>
    return {
      nodeType: 'Nested Loop',
      startupCost: 0,
      totalCost,
      planRows: 0,
      planWidth: 0,
      children: tables.map((t) => tableToNode(t.table)),
      raw: {},
    }
  }

  if ('table' in block) {
    return tableToNode(block['table'] as MysqlTable)
  }

  throw new Error('Unrecognized MySQL query block structure')
}

export function parseMysql(input: string): PlanNode {
  const parsed = JSON.parse(input)
  const block =
    (parsed as Record<string, unknown>)['query_block'] ??
    (parsed as Record<string, unknown>)['Query Block']
  if (!block) throw new Error('Invalid MySQL EXPLAIN FORMAT JSON output')
  return parseQueryBlock(block as Record<string, unknown>)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/parsers/mysql.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/parsers/mysql.ts tests/parsers/mysql.test.ts
git commit -m "feat: add MySQL EXPLAIN FORMAT JSON parser"
```

---

## Task 6: nodeColor utility

**Files:**
- Create: `src/utils/nodeColor.ts`, `tests/utils/nodeColor.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/utils/nodeColor.test.ts
import { describe, it, expect } from 'vitest'
import { nodeColor } from '../../src/utils/nodeColor'

describe('nodeColor', () => {
  it('colors join nodes red', () => {
    expect(nodeColor('Hash Join').border).toBe('#f78166')
    expect(nodeColor('Merge Join').border).toBe('#f78166')
    expect(nodeColor('Nested Loop').border).toBe('#f78166')
  })

  it('colors scan nodes blue', () => {
    expect(nodeColor('Seq Scan').border).toBe('#388bfd')
    expect(nodeColor('Tid Scan').border).toBe('#388bfd')
    expect(nodeColor('Function Scan').border).toBe('#388bfd')
  })

  it('colors index nodes green', () => {
    expect(nodeColor('Index Scan').border).toBe('#3fb950')
    expect(nodeColor('Index Only Scan').border).toBe('#3fb950')
    expect(nodeColor('Bitmap Heap Scan').border).toBe('#3fb950')
  })

  it('colors sort/agg nodes purple', () => {
    expect(nodeColor('Sort').border).toBe('#d2a8ff')
    expect(nodeColor('Aggregate').border).toBe('#d2a8ff')
    expect(nodeColor('Incremental Sort').border).toBe('#d2a8ff')
    expect(nodeColor('Group').border).toBe('#d2a8ff')
  })

  it('colors Hash node yellow', () => {
    expect(nodeColor('Hash').border).toBe('#e3b341')
  })

  it('colors unknown nodes grey', () => {
    expect(nodeColor('Unknown Node').border).toBe('#8b949e')
  })

  it('returns background color for each category', () => {
    expect(nodeColor('Hash Join').background).toBeDefined()
    expect(nodeColor('Seq Scan').background).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/utils/nodeColor.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/utils/nodeColor.ts`**

```typescript
export interface NodeColors {
  border: string
  background: string
}

const JOINS = new Set(['Hash Join', 'Merge Join', 'Nested Loop'])
const SCANS = new Set(['Seq Scan', 'Tid Scan', 'Function Scan', 'Values Scan', 'CTE Scan', 'ALL'])
const INDEXES = new Set(['Index Scan', 'Index Only Scan', 'Bitmap Heap Scan', 'Bitmap Index Scan', 'eq_ref', 'ref', 'range'])
const SORT_AGG = new Set(['Sort', 'Incremental Sort', 'Aggregate', 'Group', 'HashAggregate', 'GroupAggregate', 'WindowAgg'])

export function nodeColor(nodeType: string): NodeColors {
  if (JOINS.has(nodeType)) return { border: '#f78166', background: '#1a0f0e' }
  if (SCANS.has(nodeType)) return { border: '#388bfd', background: '#0c1626' }
  if (INDEXES.has(nodeType)) return { border: '#3fb950', background: '#0c1a0f' }
  if (SORT_AGG.has(nodeType)) return { border: '#d2a8ff', background: '#160f26' }
  if (nodeType === 'Hash') return { border: '#e3b341', background: '#1a1500' }
  return { border: '#8b949e', background: '#161b22' }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/utils/nodeColor.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/nodeColor.ts tests/utils/nodeColor.test.ts
git commit -m "feat: add node type color mapping utility"
```

---

## Task 7: useD3Tree hook

**Files:**
- Create: `src/hooks/useD3Tree.ts`

- [ ] **Step 1: Write `src/hooks/useD3Tree.ts`**

No DOM interaction here — this hook computes layout positions from the PlanNode tree and returns them. It can be unit-tested by checking that every node gets x/y coordinates.

```typescript
import * as d3 from 'd3'
import { useMemo } from 'react'
import type { PlanNode } from '../parsers/types'

export interface PositionedNode {
  data: PlanNode
  x: number
  y: number
  id: string
  collapsed: boolean
}

export interface TreeLink {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface D3TreeResult {
  nodes: PositionedNode[]
  links: TreeLink[]
  width: number
  height: number
}

const NODE_WIDTH = 290
const NODE_HEIGHT = 210
const H_GAP = 40
const V_GAP = 80

function assignIds(node: PlanNode, prefix = '0'): PlanNode & { _id: string } {
  return {
    ...node,
    _id: prefix,
    children: node.children.map((c, i) =>
      assignIds(c, `${prefix}-${i}`)
    ),
  } as PlanNode & { _id: string }
}

export function useD3Tree(
  root: PlanNode | null,
  collapsedIds: Set<string>
): D3TreeResult {
  return useMemo(() => {
    if (!root) return { nodes: [], links: [], width: 0, height: 0 }

    const withIds = assignIds(root)

    const hierarchy = d3.hierarchy<PlanNode & { _id: string }>(withIds, (d) => {
      if (collapsedIds.has(d._id)) return []
      return d.children as Array<PlanNode & { _id: string }>
    })

    const treeLayout = d3
      .tree<PlanNode & { _id: string }>()
      .nodeSize([NODE_WIDTH + H_GAP, NODE_HEIGHT + V_GAP])

    const layoutRoot = treeLayout(hierarchy)

    const allNodes = layoutRoot.descendants()
    const allLinks = layoutRoot.links()

    const minX = Math.min(...allNodes.map((n) => n.x)) - NODE_WIDTH / 2
    const maxX = Math.max(...allNodes.map((n) => n.x)) + NODE_WIDTH / 2
    const maxY = Math.max(...allNodes.map((n) => n.y)) + NODE_HEIGHT

    const offsetX = -minX + 40

    const nodes: PositionedNode[] = allNodes.map((n) => ({
      data: n.data,
      x: n.x + offsetX,
      y: n.y + 40,
      id: n.data._id,
      collapsed: collapsedIds.has(n.data._id),
    }))

    const links: TreeLink[] = allLinks.map((l) => ({
      sourceX: l.source.x + offsetX,
      sourceY: l.source.y + 40 + NODE_HEIGHT,
      targetX: l.target.x + offsetX,
      targetY: l.target.y + 40,
    }))

    return {
      nodes,
      links,
      width: maxX - minX + 80,
      height: maxY + 80,
    }
  }, [root, collapsedIds])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useD3Tree.ts
git commit -m "feat: add D3 tree layout hook"
```

---

## Task 8: NodeCard component

**Files:**
- Create: `src/components/NodeCard.tsx`, `src/components/NodeCard.module.css`, `tests/components/NodeCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/NodeCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeCard } from '../../src/components/NodeCard'
import type { PlanNode } from '../../src/parsers/types'

const NODE: PlanNode = {
  nodeType: 'Hash Join',
  startupCost: 120,
  totalCost: 480.5,
  planRows: 1200,
  planWidth: 64,
  actualStartupTime: 0.143,
  actualTotalTime: 312.8,
  actualRows: 1185,
  actualLoops: 1,
  totalActualTime: 312.8,
  rowEstimateError: 0.9875,
  sharedHitBlocks: 8840,
  sharedReadBlocks: 12,
  hashCond: '(o.user_id = u.id)',
  children: [],
  raw: {},
}

describe('NodeCard', () => {
  it('renders node type', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText('Hash Join')).toBeInTheDocument()
  })

  it('renders cost range', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/120/)).toBeInTheDocument()
    expect(screen.getByText(/480\.5/)).toBeInTheDocument()
  })

  it('renders actual rows', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/1185/)).toBeInTheDocument()
  })

  it('renders hash condition', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/o\.user_id = u\.id/)).toBeInTheDocument()
  })

  it('renders shared hit blocks', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/8840/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/components/NodeCard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/NodeCard.module.css`**

```css
.card {
  width: 290px;
  border-radius: 6px;
  border-width: 1px;
  border-style: solid;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 10px;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px 5px;
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: inherit;
}

.nodeType {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.relation {
  font-size: 9px;
  opacity: 0.6;
  margin-top: 2px;
}

.chevron {
  font-size: 10px;
  opacity: 0.5;
  flex-shrink: 0;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 10px;
  padding: 7px 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #484f58;
}

.value {
  color: #c9d1d9;
}

.value.warn {
  color: #ff7b72;
}

.value.muted {
  color: #8b949e;
}

.value.accent {
  color: #3fb950;
}

.value.blue {
  color: #79c0ff;
}

.value.yellow {
  color: #e3b341;
}

.conditions {
  padding: 0 10px 7px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cond {
  font-size: 9px;
  color: #484f58;
  word-break: break-all;
}

.cond span {
  color: #ffa657;
}

.rawFields {
  padding: 0 10px 7px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rawField {
  font-size: 9px;
  color: #484f58;
}

.rawField span {
  color: #8b949e;
}
```

- [ ] **Step 4: Write `src/components/NodeCard.tsx`**

```typescript
import type { PlanNode } from '../parsers/types'
import { nodeColor } from '../utils/nodeColor'
import styles from './NodeCard.module.css'

interface Props {
  node: PlanNode
  collapsed: boolean
  onToggle: () => void
}

function fmt(n: number | undefined, decimals = 2): string {
  if (n === undefined) return '—'
  return n.toFixed(decimals)
}

function fmtInt(n: number | undefined): string {
  if (n === undefined) return '—'
  return n.toLocaleString()
}

export function NodeCard({ node, collapsed, onToggle }: Props) {
  const colors = nodeColor(node.nodeType)
  const hasChildren = node.children.length > 0

  const rowErrorWarn =
    node.rowEstimateError !== undefined &&
    (node.rowEstimateError > 10 || node.rowEstimateError < 0.1)

  const conditions = [
    node.hashCond && ['Hash Cond', node.hashCond],
    node.indexCond && ['Index Cond', node.indexCond],
    node.joinFilter && ['Join Filter', node.joinFilter],
    node.filter && ['Filter', node.filter],
    node.recheckCond && ['Recheck Cond', node.recheckCond],
  ].filter(Boolean) as [string, string][]

  const rawEntries = Object.entries(node.raw)

  return (
    <div
      className={styles.card}
      style={{ borderColor: colors.border, backgroundColor: colors.background }}
      onClick={onToggle}
    >
      <div className={styles.header} style={{ borderBottomColor: colors.border + '55' }}>
        <div>
          <div className={styles.nodeType} style={{ color: colors.border }}>
            {node.nodeType}
          </div>
          {(node.relationName || node.alias) && (
            <div className={styles.relation}>
              {node.relationName}
              {node.alias && node.alias !== node.relationName ? ` (${node.alias})` : ''}
              {node.indexName ? ` · ${node.indexName}` : ''}
            </div>
          )}
        </div>
        {hasChildren && (
          <div className={styles.chevron}>{collapsed ? '▶' : '▼'}</div>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.label}>cost</span>
          <span className={`${styles.value} ${styles.yellow}`}>
            {fmt(node.startupCost)}→{fmt(node.totalCost)}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>rows</span>
          <span className={`${styles.value} ${styles.blue}`}>{fmtInt(node.planRows)}</span>
        </div>

        {node.actualTotalTime !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>actual</span>
            <span className={`${styles.value} ${styles.accent}`}>
              {fmt(node.actualStartupTime)}→{fmt(node.actualTotalTime)}ms
            </span>
          </div>
        )}
        {node.actualRows !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>actual rows</span>
            <span className={`${styles.value} ${styles.accent}`}>{fmtInt(node.actualRows)}</span>
          </div>
        )}

        {node.actualLoops !== undefined && node.actualLoops !== 1 && (
          <div className={styles.field}>
            <span className={styles.label}>loops</span>
            <span className={`${styles.value} ${styles.blue}`}>{node.actualLoops}</span>
          </div>
        )}
        {node.totalActualTime !== undefined && node.actualLoops !== undefined && node.actualLoops > 1 && (
          <div className={styles.field}>
            <span className={styles.label}>total time</span>
            <span className={`${styles.value} ${styles.accent}`}>{fmt(node.totalActualTime)}ms</span>
          </div>
        )}

        {node.rowEstimateError !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>est.error</span>
            <span className={`${styles.value} ${rowErrorWarn ? styles.warn : styles.muted}`}>
              ×{fmt(node.rowEstimateError, 2)}
            </span>
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.label}>width</span>
          <span className={`${styles.value} ${styles.muted}`}>{node.planWidth}</span>
        </div>

        {node.sharedHitBlocks !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>sh.hit</span>
            <span className={`${styles.value} ${styles.blue}`}>{fmtInt(node.sharedHitBlocks)}</span>
          </div>
        )}
        {node.sharedReadBlocks !== undefined && node.sharedReadBlocks > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>sh.read</span>
            <span className={`${styles.value} ${styles.warn}`}>{fmtInt(node.sharedReadBlocks)}</span>
          </div>
        )}
        {node.sharedDirtiedBlocks !== undefined && node.sharedDirtiedBlocks > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>sh.dirt</span>
            <span className={`${styles.value} ${styles.muted}`}>{fmtInt(node.sharedDirtiedBlocks)}</span>
          </div>
        )}
        {node.sharedWrittenBlocks !== undefined && node.sharedWrittenBlocks > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>sh.write</span>
            <span className={`${styles.value} ${styles.warn}`}>{fmtInt(node.sharedWrittenBlocks)}</span>
          </div>
        )}
        {node.tempReadBlocks !== undefined && node.tempReadBlocks > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>tmp.read</span>
            <span className={`${styles.value} ${styles.warn}`}>{fmtInt(node.tempReadBlocks)}</span>
          </div>
        )}
        {node.tempWrittenBlocks !== undefined && node.tempWrittenBlocks > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>tmp.write</span>
            <span className={`${styles.value} ${styles.warn}`}>{fmtInt(node.tempWrittenBlocks)}</span>
          </div>
        )}
        {node.rowsRemovedByFilter !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>removed</span>
            <span className={`${styles.value} ${styles.warn}`}>{fmtInt(node.rowsRemovedByFilter)}</span>
          </div>
        )}
        {node.peakMemoryUsage !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>mem</span>
            <span className={`${styles.value} ${styles.muted}`}>{node.peakMemoryUsage}kB</span>
          </div>
        )}
        {node.hashBatches !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>hash batches</span>
            <span className={`${styles.value} ${node.hashBatches > 1 ? styles.warn : styles.muted}`}>
              {node.hashBatches}
            </span>
          </div>
        )}
        {node.workersLaunched !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>workers</span>
            <span className={`${styles.value} ${styles.blue}`}>
              {node.workersLaunched}/{node.workersPlanned}
            </span>
          </div>
        )}
        {node.sortMethod && (
          <div className={styles.field}>
            <span className={styles.label}>sort method</span>
            <span className={`${styles.value} ${styles.muted}`}>{node.sortMethod}</span>
          </div>
        )}
        {node.sortSpaceUsed !== undefined && (
          <div className={styles.field}>
            <span className={styles.label}>sort mem</span>
            <span className={`${styles.value} ${styles.muted}`}>{node.sortSpaceUsed}kB</span>
          </div>
        )}
      </div>

      {conditions.length > 0 && (
        <div className={styles.conditions}>
          {conditions.map(([label, val]) => (
            <div key={label} className={styles.cond}>
              {label}: <span>{val}</span>
            </div>
          ))}
        </div>
      )}

      {rawEntries.length > 0 && (
        <div className={styles.rawFields}>
          {rawEntries.map(([k, v]) => (
            <div key={k} className={styles.rawField}>
              {k}: <span>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test tests/components/NodeCard.test.tsx
```

Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/NodeCard.tsx src/components/NodeCard.module.css tests/components/NodeCard.test.tsx
git commit -m "feat: add NodeCard component with dense data grid"
```

---

## Task 9: TreeLayout + TreeCanvas components

**Files:**
- Create: `src/components/TreeLayout.tsx`, `src/components/TreeCanvas.tsx`, `src/components/TreeCanvas.module.css`

- [ ] **Step 1: Write `src/components/TreeLayout.tsx`**

Renders SVG edges and positions `NodeCard` as `<foreignObject>` elements.

```typescript
import { NodeCard } from './NodeCard'
import type { D3TreeResult } from '../hooks/useD3Tree'

const NODE_WIDTH = 290
const NODE_HEIGHT = 210

interface Props {
  tree: D3TreeResult
  onToggle: (id: string) => void
}

export function TreeLayout({ tree, onToggle }: Props) {
  return (
    <>
      {tree.links.map((link, i) => (
        <path
          key={i}
          d={`M ${link.sourceX} ${link.sourceY} C ${link.sourceX} ${(link.sourceY + link.targetY) / 2}, ${link.targetX} ${(link.sourceY + link.targetY) / 2}, ${link.targetX} ${link.targetY}`}
          fill="none"
          stroke="#30363d"
          strokeWidth={1.5}
        />
      ))}
      {tree.nodes.map((node) => (
        <foreignObject
          key={node.id}
          x={node.x - NODE_WIDTH / 2}
          y={node.y}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          style={{ overflow: 'visible' }}
        >
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: NODE_WIDTH }}>
            <NodeCard
              node={node.data}
              collapsed={node.collapsed}
              onToggle={() => onToggle(node.id)}
            />
          </div>
        </foreignObject>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Write `src/components/TreeCanvas.module.css`**

```css
.container {
  flex: 1;
  background: #010409;
  position: relative;
  overflow: hidden;
}

.toolbar {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 10;
}

.toolbarBtn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #8b949e;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
  cursor: pointer;
}

.toolbarBtn:hover {
  background: #30363d;
  color: #c9d1d9;
}

.svg {
  width: 100%;
  height: 100%;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #484f58;
  font-family: monospace;
  font-size: 13px;
}
```

- [ ] **Step 3: Write `src/components/TreeCanvas.tsx`**

```typescript
import { useRef, useEffect, useCallback, useState } from 'react'
import * as d3 from 'd3'
import { TreeLayout } from './TreeLayout'
import { Legend } from './Legend'
import { useD3Tree } from '../hooks/useD3Tree'
import type { PlanNode } from '../parsers/types'
import styles from './TreeCanvas.module.css'

interface Props {
  root: PlanNode | null
}

export function TreeCanvas({ root }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const tree = useD3Tree(root, collapsedIds)

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (e) => {
        d3.select(gRef.current).attr('transform', e.transform.toString())
      })
    svg.call(zoom)
    zoomRef.current = zoom

    // Initial fit
    if (tree.width > 0 && tree.height > 0) {
      const svgEl = svgRef.current
      const w = svgEl.clientWidth || 800
      const h = svgEl.clientHeight || 600
      const scale = Math.min(w / tree.width, h / tree.height, 1) * 0.9
      const tx = (w - tree.width * scale) / 2
      const ty = 20
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }
  }, [tree.width, tree.height])

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.3)
  }

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.77)
  }

  const handleFit = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || tree.width === 0) return
    const svgEl = svgRef.current
    const w = svgEl.clientWidth || 800
    const h = svgEl.clientHeight || 600
    const scale = Math.min(w / tree.width, h / tree.height, 1) * 0.9
    const tx = (w - tree.width * scale) / 2
    d3.select(svgEl)
      .transition()
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, 20).scale(scale))
  }, [tree.width, tree.height])

  const handleExpandAll = () => setCollapsedIds(new Set())
  const handleCollapseAll = () => {
    const allIds = new Set(tree.nodes.filter((n) => n.data.children.length > 0).map((n) => n.id))
    setCollapsedIds(allIds)
  }

  const handleToggle = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className={styles.container}>
      {root && (
        <div className={styles.toolbar}>
          <button className={styles.toolbarBtn} onClick={handleZoomIn}>+ Zoom</button>
          <button className={styles.toolbarBtn} onClick={handleZoomOut}>− Zoom</button>
          <button className={styles.toolbarBtn} onClick={handleFit}>⊡ Fit</button>
          <button className={styles.toolbarBtn} onClick={handleExpandAll}>⊞ Expand</button>
          <button className={styles.toolbarBtn} onClick={handleCollapseAll}>⊟ Collapse</button>
        </div>
      )}
      {!root && <div className={styles.empty}>Paste EXPLAIN ANALYZE JSON output and click Visualize</div>}
      <svg ref={svgRef} className={styles.svg}>
        <g ref={gRef}>
          {root && <TreeLayout tree={tree} onToggle={handleToggle} />}
        </g>
      </svg>
      {root && <Legend />}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TreeLayout.tsx src/components/TreeCanvas.tsx src/components/TreeCanvas.module.css
git commit -m "feat: add TreeLayout and TreeCanvas with D3 zoom/pan"
```

---

## Task 10: Legend component

**Files:**
- Create: `src/components/Legend.tsx`

- [ ] **Step 1: Write `src/components/Legend.tsx`**

```typescript
import { nodeColor } from '../utils/nodeColor'

const ENTRIES = [
  { label: 'Join', type: 'Hash Join' },
  { label: 'Scan', type: 'Seq Scan' },
  { label: 'Index', type: 'Index Scan' },
  { label: 'Sort/Agg', type: 'Sort' },
  { label: 'Hash', type: 'Hash' },
  { label: 'Other', type: 'Unknown' },
]

export function Legend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        display: 'flex',
        gap: 12,
        fontFamily: 'monospace',
        fontSize: 9,
        pointerEvents: 'none',
      }}
    >
      {ENTRIES.map(({ label, type }) => (
        <span key={label} style={{ color: nodeColor(type).border }}>
          ■ {label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Legend.tsx
git commit -m "feat: add Legend component"
```

---

## Task 11: useExport hook

**Files:**
- Create: `src/hooks/useExport.ts`

- [ ] **Step 1: Write `src/hooks/useExport.ts`**

The export builds an offscreen SVG using plain `<text>` and `<rect>` elements (no foreignObject) to avoid `html-to-image` + foreignObject cross-browser issues. It then uses `html-to-image`'s `toSvg` on that offscreen SVG for SVG export, and `toPng` for PNG.

```typescript
import { toPng, toSvg } from 'html-to-image'
import type { D3TreeResult } from './useD3Tree'
import type { PlanNode } from '../parsers/types'
import { nodeColor } from '../utils/nodeColor'

const NODE_W = 290
const NODE_H = 210
const FONT = 'monospace'

function renderNodeToSvg(
  svg: SVGSVGElement,
  node: PlanNode,
  x: number,
  y: number
) {
  const colors = nodeColor(node.nodeType)

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(NODE_W))
  rect.setAttribute('height', String(NODE_H))
  rect.setAttribute('rx', '6')
  rect.setAttribute('fill', colors.background)
  rect.setAttribute('stroke', colors.border)
  svg.appendChild(rect)

  const fields: [string, string][] = [
    ['type', node.nodeType],
    ['cost', `${node.startupCost.toFixed(2)}→${node.totalCost.toFixed(2)}`],
    ['rows', String(node.planRows)],
  ]
  if (node.actualTotalTime !== undefined)
    fields.push(['actual', `${node.actualTotalTime.toFixed(2)}ms`])
  if (node.actualRows !== undefined)
    fields.push(['act.rows', String(node.actualRows)])
  if (node.sharedHitBlocks !== undefined)
    fields.push(['sh.hit', String(node.sharedHitBlocks)])
  if (node.sharedReadBlocks !== undefined && node.sharedReadBlocks > 0)
    fields.push(['sh.read', String(node.sharedReadBlocks)])

  fields.forEach(([label, value], i) => {
    const ty = y + 20 + i * 16
    const tLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    tLabel.setAttribute('x', String(x + 8))
    tLabel.setAttribute('y', String(ty))
    tLabel.setAttribute('fill', '#484f58')
    tLabel.setAttribute('font-size', '9')
    tLabel.setAttribute('font-family', FONT)
    tLabel.textContent = label + ':'
    svg.appendChild(tLabel)

    const tVal = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    tVal.setAttribute('x', String(x + 80))
    tVal.setAttribute('y', String(ty))
    tVal.setAttribute('fill', colors.border)
    tVal.setAttribute('font-size', '9')
    tVal.setAttribute('font-family', FONT)
    tVal.textContent = value
    svg.appendChild(tVal)
  })
}

function buildOffscreenSvg(treeResult: D3TreeResult): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', String(treeResult.width + 80))
  svg.setAttribute('height', String(treeResult.height + 80))
  svg.style.background = '#010409'

  treeResult.links.forEach((link) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const mx = (link.sourceX + link.targetX) / 2
    const my = (link.sourceY + link.targetY) / 2
    path.setAttribute(
      'd',
      `M ${link.sourceX} ${link.sourceY} C ${link.sourceX} ${my}, ${link.targetX} ${my}, ${link.targetX} ${link.targetY}`
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#30363d')
    path.setAttribute('stroke-width', '1.5')
    svg.appendChild(path)
  })

  treeResult.nodes.forEach((node) => {
    renderNodeToSvg(svg, node.data, node.x - NODE_W / 2, node.y)
  })

  return svg
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function useExport(treeResult: D3TreeResult) {
  const timestamp = () => Date.now()

  const exportPng = async () => {
    const svg = buildOffscreenSvg(treeResult)
    document.body.appendChild(svg)
    try {
      const dataUrl = await toPng(svg)
      triggerDownload(dataUrl, `plan-${timestamp()}.png`)
    } finally {
      document.body.removeChild(svg)
    }
  }

  const exportSvg = async () => {
    const svg = buildOffscreenSvg(treeResult)
    document.body.appendChild(svg)
    try {
      const dataUrl = await toSvg(svg)
      triggerDownload(dataUrl, `plan-${timestamp()}.svg`)
    } finally {
      document.body.removeChild(svg)
    }
  }

  return { exportPng, exportSvg }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useExport.ts
git commit -m "feat: add export hook with offscreen SVG renderer"
```

---

## Task 12: InputPanel component

**Files:**
- Create: `src/components/InputPanel.tsx`, `src/components/InputPanel.module.css`

- [ ] **Step 1: Write `src/components/InputPanel.module.css`**

```css
.panel {
  width: 300px;
  min-width: 300px;
  background: #0d1117;
  border-right: 1px solid #21262d;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 12px 16px;
  border-bottom: 1px solid #21262d;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
  font-family: monospace;
}

.badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-family: monospace;
}

.badgePg {
  background: #1f3a1f;
  color: #3fb950;
}

.badgeMysql {
  background: #2a1f0a;
  color: #e3b341;
}

.badgeUnknown {
  background: #21262d;
  color: #8b949e;
}

.textareaWrap {
  flex: 1;
  padding: 12px;
  min-height: 0;
}

.textarea {
  width: 100%;
  height: 100%;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10px;
  color: #8b949e;
  resize: none;
  box-sizing: border-box;
  outline: none;
}

.textarea:focus {
  border-color: #388bfd;
}

.textarea::placeholder {
  color: #484f58;
}

.error {
  margin: 0 12px 8px;
  padding: 8px 10px;
  background: #2d1010;
  border: 1px solid #f78166;
  border-radius: 4px;
  font-family: monospace;
  font-size: 10px;
  color: #f78166;
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid #21262d;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btnPrimary {
  background: #238636;
  border: none;
  color: #fff;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: monospace;
  width: 100%;
}

.btnPrimary:hover {
  background: #2ea043;
}

.btnRow {
  display: flex;
  gap: 6px;
}

.btnSecondary {
  flex: 1;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 6px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  font-family: monospace;
}

.btnSecondary:hover {
  background: #30363d;
}

.btnSecondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Write `src/components/InputPanel.tsx`**

```typescript
import { useState, useCallback } from 'react'
import { detectDb } from '../parsers/detect'
import { parsePg } from '../parsers/pg'
import { parseMysql } from '../parsers/mysql'
import type { PlanNode } from '../parsers/types'
import type { D3TreeResult } from '../hooks/useD3Tree'
import { useExport } from '../hooks/useExport'
import styles from './InputPanel.module.css'

interface Props {
  onPlan: (plan: PlanNode) => void
  treeResult: D3TreeResult
}

export function InputPanel({ onPlan, treeResult }: Props) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dbOverride, setDbOverride] = useState<'pg' | 'mysql' | null>(null)
  const { exportPng, exportSvg } = useExport(treeResult)

  const detected = detectDb(raw)
  const db = dbOverride ?? detected

  const badgeClass =
    db === 'pg' ? styles.badgePg : db === 'mysql' ? styles.badgeMysql : styles.badgeUnknown
  const badgeLabel =
    db === 'pg' ? 'PostgreSQL' : db === 'mysql' ? 'MySQL' : 'Unknown'

  const handleVisualize = useCallback(() => {
    setError(null)
    try {
      const dbType = db
      if (!dbType) throw new Error('Could not detect database type. Is this FORMAT JSON output?')
      const plan = dbType === 'pg' ? parsePg(raw) : parseMysql(raw)
      onPlan(plan)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [raw, db, onPlan])

  const hasTree = treeResult.nodes.length > 0

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>EXPLAIN ANALYZE</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {detected === null && raw.length > 0 && (
            <>
              <button
                className={styles.btnSecondary}
                style={{ padding: '2px 6px', fontSize: 9 }}
                onClick={() => setDbOverride(dbOverride === 'pg' ? 'mysql' : 'pg')}
              >
                {dbOverride ? `Switch to ${dbOverride === 'pg' ? 'MySQL' : 'PG'}` : 'Set PG'}
              </button>
            </>
          )}
          <span className={`${styles.badge} ${badgeClass}`}>{badgeLabel}</span>
        </div>
      </div>

      <div className={styles.textareaWrap}>
        <textarea
          className={styles.textarea}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setDbOverride(null) }}
          placeholder={`Paste EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) output here...\n\nFor PostgreSQL:\n  EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)\n  SELECT ...\n\nFor MySQL:\n  EXPLAIN FORMAT=JSON\n  SELECT ...`}
          spellCheck={false}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.footer}>
        <button className={styles.btnPrimary} onClick={handleVisualize}>
          ▶ Visualize
        </button>
        <div className={styles.btnRow}>
          <button
            className={styles.btnSecondary}
            onClick={exportPng}
            disabled={!hasTree}
          >
            Export PNG
          </button>
          <button
            className={styles.btnSecondary}
            onClick={exportSvg}
            disabled={!hasTree}
          >
            Export SVG
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InputPanel.tsx src/components/InputPanel.module.css
git commit -m "feat: add InputPanel with parse, detect, and export controls"
```

---

## Task 13: App component + wiring

**Files:**
- Modify: `src/App.tsx` (replace generated content)
- Create: `src/components/App.module.css`
- Modify: `src/main.tsx` (remove StrictMode default styles)
- Create: `src/index.css`

- [ ] **Step 1: Write `src/components/App.module.css`**

```css
.app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #010409;
}
```

- [ ] **Step 2: Write `src/App.tsx`**

```typescript
import { useState, useMemo } from 'react'
import { InputPanel } from './components/InputPanel'
import { TreeCanvas } from './components/TreeCanvas'
import { useD3Tree } from './hooks/useD3Tree'
import type { PlanNode } from './parsers/types'
import styles from './components/App.module.css'

export default function App() {
  const [plan, setPlan] = useState<PlanNode | null>(null)
  // Export always uses the full uncollapsed tree — stable empty set avoids useMemo churn
  const emptyCollapsed = useMemo(() => new Set<string>(), [])
  const treeResult = useD3Tree(plan, emptyCollapsed)

  return (
    <div className={styles.app}>
      <InputPanel onPlan={setPlan} treeResult={treeResult} />
      <TreeCanvas root={plan} />
    </div>
  )
}
```

- [ ] **Step 3: Write `src/index.css`**

```css
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: #010409;
  color: #c9d1d9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #161b22;
}

::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 3px;
}
```

- [ ] **Step 4: Update `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/App.module.css src/index.css src/main.tsx
git commit -m "feat: wire App root component"
```

---

## Task 14: End-to-end smoke test

**Files:**
- No new files — run the dev server and verify the full flow manually

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

- [ ] **Step 3: Paste the following PostgreSQL EXPLAIN JSON and click Visualize**

```json
[{"Plan":{"Node Type":"Hash Join","Startup Cost":120.0,"Total Cost":480.5,"Plan Rows":1200,"Plan Width":64,"Actual Startup Time":0.143,"Actual Total Time":312.8,"Actual Rows":1185,"Actual Loops":1,"Hash Cond":"(o.user_id = u.id)","Shared Hit Blocks":8840,"Shared Read Blocks":12,"Shared Dirtied Blocks":0,"Shared Written Blocks":0,"Local Hit Blocks":0,"Local Read Blocks":0,"Temp Read Blocks":0,"Temp Written Blocks":0,"Plans":[{"Node Type":"Seq Scan","Parent Relationship":"Outer","Relation Name":"orders","Alias":"o","Startup Cost":0.0,"Total Cost":88.0,"Plan Rows":1000,"Plan Width":32,"Actual Startup Time":0.021,"Actual Total Time":1.84,"Actual Rows":1000,"Actual Loops":1,"Filter":"(status = 'active')","Rows Removed by Filter":240,"Shared Hit Blocks":440,"Shared Read Blocks":0,"Shared Dirtied Blocks":0,"Shared Written Blocks":0,"Local Hit Blocks":0,"Local Read Blocks":0,"Temp Read Blocks":0,"Temp Written Blocks":0,"Plans":[]},{"Node Type":"Hash","Parent Relationship":"Inner","Startup Cost":12.0,"Total Cost":12.0,"Plan Rows":200,"Plan Width":32,"Actual Startup Time":0.05,"Actual Total Time":0.05,"Actual Rows":0,"Actual Loops":1,"Hash Batches":1,"Original Hash Batches":1,"Peak Memory Usage":32,"Shared Hit Blocks":10,"Shared Read Blocks":0,"Shared Dirtied Blocks":0,"Shared Written Blocks":0,"Local Hit Blocks":0,"Local Read Blocks":0,"Temp Read Blocks":0,"Temp Written Blocks":0,"Plans":[{"Node Type":"Index Scan","Parent Relationship":"Outer","Relation Name":"users","Alias":"u","Index Name":"idx_users_id","Startup Cost":0.0,"Total Cost":12.0,"Plan Rows":200,"Plan Width":32,"Actual Startup Time":0.01,"Actual Total Time":0.04,"Actual Rows":198,"Actual Loops":1,"Index Cond":"(u.id = o.user_id)","Shared Hit Blocks":396,"Shared Read Blocks":0,"Shared Dirtied Blocks":0,"Shared Written Blocks":0,"Local Hit Blocks":0,"Local Read Blocks":0,"Temp Read Blocks":0,"Temp Written Blocks":0,"Plans":[]}]}]},"Planning Time":0.5,"Execution Time":313.2}]
```

Expected:
- Badge shows "PostgreSQL"
- Tree renders with 4 nodes: Hash Join → Seq Scan + Hash → Index Scan
- Node cards show cost, actual time, buffers, conditions
- Zoom/pan works
- Click a node with children → it collapses

- [ ] **Step 4: Test export**

Click "Export PNG" — confirm a `.png` file downloads and opens correctly.

- [ ] **Step 5: Test MySQL input**

Paste the following and click Visualize:

```json
{"query_block":{"select_id":1,"cost_info":{"query_cost":"480.50"},"nested_loop":[{"table":{"table_name":"orders","access_type":"ALL","rows_examined_per_scan":1000,"rows_produced_per_join":1000,"filtered":"100.00","cost_info":{"read_cost":"50.00","eval_cost":"100.00","prefix_cost":"150.00"}}},{"table":{"table_name":"users","access_type":"eq_ref","key":"PRIMARY","rows_examined_per_scan":1,"rows_produced_per_join":1000,"filtered":"100.00","cost_info":{"read_cost":"250.00","eval_cost":"100.00","prefix_cost":"500.00"}}}]}}
```

Expected: Badge shows "MySQL", tree renders with Nested Loop root → 2 table children.

- [ ] **Step 6: Test error handling**

Paste `{"not": "valid"}` and click Visualize. Expected: red error message appears below textarea.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete explain-sql visualizer — all layers wired"
```
