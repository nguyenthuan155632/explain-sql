# explain-sql — Query Plan Visualizer: Design Spec

**Date:** 2026-04-24  
**Status:** Approved

---

## Overview

A client-side web application that accepts `EXPLAIN ANALYZE` output from PostgreSQL or MySQL, parses it into a normalized plan tree, and renders it as an interactive D3.js collapsible tree. Each node displays all available execution data in a dense card layout. Users can export the visualization as PNG or SVG.

No backend. No saving. No sharing links. Purely client-side.

---

## Stack

| Layer | Choice |
|---|---|
| Build | Vite |
| UI framework | React 18 + TypeScript |
| Tree layout & zoom/pan | D3.js (layout only — React renders) |
| Export | html-to-image |
| Styling | CSS Modules (dark theme, monospace-first) |

---

## Architecture

Four layers, each with a single responsibility:

```
Input Layer       → user pastes raw EXPLAIN ANALYZE text/JSON
Parser Layer      → normalizes to PlanNode tree (PG or MySQL)
Visualization     → D3 computes x/y; React renders node cards as SVG foreignObject
Export Layer      → html-to-image captures SVG → PNG or SVG download
```

### D3 + React integration

D3 owns **positioning only**: hierarchy construction, tree layout (x/y coordinates), edge path generation, zoom/pan transform. React owns **all rendering**: node cards, labels, controls, export buttons. This avoids the React/D3 DOM ownership conflict.

Node cards render as `<foreignObject>` inside the SVG, allowing full HTML/CSS layout (CSS grid for the data fields) within the D3-managed coordinate space.

---

## Data Model

Both parsers normalize to a single `PlanNode` interface. PostgreSQL input must be in JSON format (`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`). MySQL input must be in JSON format (`EXPLAIN FORMAT=JSON`).

```typescript
interface PlanNode {
  // Identity
  nodeType: string
  relationName?: string
  alias?: string
  indexName?: string
  parentRelationship?: string   // "Inner" | "Outer" | "Subquery"

  // Planner estimates
  startupCost: number
  totalCost: number
  planRows: number
  planWidth: number

  // Actual execution (from ANALYZE)
  actualStartupTime?: number
  actualTotalTime?: number
  actualRows?: number
  actualLoops?: number

  // Derived (computed by parser, not present in raw output)
  totalActualTime?: number      // actualTotalTime * actualLoops
  rowEstimateError?: number     // actualRows / planRows (ratio)

  // Buffers (from BUFFERS option)
  sharedHitBlocks?: number
  sharedReadBlocks?: number
  sharedDirtiedBlocks?: number
  sharedWrittenBlocks?: number
  localHitBlocks?: number
  localReadBlocks?: number
  tempReadBlocks?: number
  tempWrittenBlocks?: number

  // Conditions & filters
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

  // Parallel query
  workersPlanned?: number
  workersLaunched?: number

  // Tree
  children: PlanNode[]

  // Escape hatch: every unknown key from the raw output
  raw: Record<string, unknown>
}
```

The `raw` field preserves every unparsed key from the original JSON so nothing is silently dropped. The UI renders unknown fields from `raw` as a fallback section in the node card.

---

## Parsers

### Auto-detection (`detect.ts`)

Inspect the raw input string:
- Contains `"Query Block"` or `"query_block"` → MySQL
- Otherwise → PostgreSQL
- If detection is ambiguous, show a toggle in the UI to let the user override

### PostgreSQL parser (`pg.ts`)

- Input: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output (a JSON array with one element)
- Walk the `Plans` array recursively to build the `PlanNode` tree
- Compute `totalActualTime = actualTotalTime * actualLoops`
- Compute `rowEstimateError = actualRows / planRows`
- Map all known PostgreSQL keys to typed fields; store remainder in `raw`

### MySQL parser (`mysql.ts`)

- Input: `EXPLAIN FORMAT=JSON` output (JSON object with `query_block` root)
- Walk nested objects (`nested_loop`, `ordering_operation`, `grouping_operation`, etc.) recursively
- Map MySQL-specific keys (`cost_info`, `rows_examined_per_scan`, `filtered`, etc.) to the normalized interface where equivalents exist
- Store MySQL-specific fields with no PostgreSQL equivalent in `raw`

---

## Component Structure

```
src/
├── parsers/
│   ├── types.ts
│   ├── detect.ts
│   ├── pg.ts
│   └── mysql.ts
│
├── components/
│   ├── App.tsx           # Root: left panel + right panel layout
│   ├── InputPanel.tsx    # Textarea, db badge, Visualize button, export buttons
│   ├── TreeCanvas.tsx    # SVG root with D3 zoom/pan behavior
│   ├── TreeLayout.tsx    # Renders edges (SVG path) + positions NodeCards
│   ├── NodeCard.tsx      # foreignObject card: all PlanNode fields in CSS grid
│   └── Legend.tsx        # Node type color legend
│
├── hooks/
│   ├── useD3Tree.ts      # d3.hierarchy + d3.tree layout → positioned nodes
│   └── useExport.ts      # html-to-image PNG/SVG capture and download
│
└── utils/
    └── nodeColor.ts      # nodeType string → { border, background } colors
```

---

## UI Layout

**Left panel (300px fixed):**
- Header: "EXPLAIN ANALYZE" label + auto-detected database badge (PostgreSQL / MySQL)
- Textarea: raw input, monospace, syntax-highlighted (node types, numbers, keywords colored)
- Footer: "Visualize" primary button + "Export PNG" / "Export SVG" secondary buttons

**Right panel (flex-fill):**
- Background: near-black (`#010409`)
- Toolbar (top-right): Zoom In, Zoom Out, Fit to Screen, Expand All / Collapse All
- D3 SVG canvas: pan by drag, zoom by scroll wheel
- Legend (bottom-left): node type → color mapping

**Node card fields (rendered as CSS grid inside foreignObject):**

| Field | Label |
|---|---|
| startupCost → totalCost | `cost` |
| planRows | `rows` |
| actualStartupTime → actualTotalTime | `actual` |
| actualRows | `actual rows` |
| actualLoops | `loops` |
| planWidth | `width` |
| sharedHitBlocks | `sh.hit` |
| sharedReadBlocks | `sh.read` |
| sharedDirtiedBlocks | `sh.dirt` |
| sharedWrittenBlocks | `sh.write` |
| tempReadBlocks | `tmp.read` |
| tempWrittenBlocks | `tmp.write` |
| rowsRemovedByFilter | `removed` |
| rowEstimateError | `est.error` (highlighted red if > 10x) |
| totalActualTime | `total time` |
| peakMemoryUsage | `mem` |
| hashBatches | `hash batches` |
| workersLaunched / workersPlanned | `workers` |
| filter / indexCond / hashCond / joinFilter | rendered below the grid as monospace text |
| unknown `raw` fields | rendered as key: value below conditions |

**Node type color coding:**

| Category | Types | Border color |
|---|---|---|
| Join | Hash Join, Merge Join, Nested Loop | `#f78166` (red) |
| Scan | Seq Scan, Tid Scan, Function Scan | `#388bfd` (blue) |
| Index | Index Scan, Index Only Scan, Bitmap Heap Scan | `#3fb950` (green) |
| Sort / Agg | Sort, Incremental Sort, Aggregate, Group | `#d2a8ff` (purple) |
| Hash | Hash | `#e3b341` (yellow) |
| Other | everything else | `#8b949e` (grey) |

---

## Export

`useExport.ts` uses `html-to-image`:
- **PNG**: `toPng(svgContainerRef.current)` → triggers browser download
- **SVG**: `toSvg(svgContainerRef.current)` → triggers browser download
- File named `plan-{timestamp}.png` / `plan-{timestamp}.svg`

---

## Error Handling

- Paste area: if parsing fails, show an inline error below the textarea with the parse error message and a hint ("Did you use FORMAT JSON?")
- Auto-detection failure: show a manual toggle (PostgreSQL / MySQL) so the user can override
- Export failure: show a transient toast error

---

## Out of Scope

- Backend, persistence, or shareable URLs
- Text-format EXPLAIN parsing (JSON format required)
- EXPLAIN without ANALYZE (no actual rows/time data)
- Query editing or re-running queries against a live database
- Mobile layout
