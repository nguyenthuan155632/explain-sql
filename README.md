# explain-sql

A client-side web app for visualizing PostgreSQL and MySQL `EXPLAIN ANALYZE` query execution plans as interactive D3.js trees.

Paste your plan JSON, explore the tree, export as PNG or SVG.

![Dark tree visualization with dense node cards showing cost, timing, buffers, and conditions](.superpowers/brainstorm/18802-1776956687/content/ui-layout.html)

## Features

- **Interactive tree** — collapsible nodes, zoom/pan, fit-to-screen
- **Dense node cards** — every field from the plan: costs, actual timing, row estimates, buffer hits/reads, filters, sort info, hash batches, parallel workers
- **Row estimate error** — highlights when actual rows diverge from planner estimates by >10×
- **Color-coded node types** — joins (red), scans (blue), index (green), sort/agg (purple), hash (yellow)
- **PostgreSQL + MySQL** — auto-detects from JSON structure
- **Export** — PNG and SVG via offscreen renderer (no foreignObject issues)

## Usage

### PostgreSQL

Run your query with full options:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ...
```

Paste the JSON output into the app and click **Visualize**.

### MySQL

```sql
EXPLAIN FORMAT=JSON
SELECT ...
```

> **Note:** MySQL `EXPLAIN FORMAT=JSON` provides planner estimates only — no actual rows or timing. For actual timing, MySQL 8.0.18+ supports `EXPLAIN ANALYZE` (text format), which is not yet supported in v1.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Running Tests

```bash
npm test
```

## Stack

| Layer | Technology |
|---|---|
| Build | Vite |
| UI | React 18 + TypeScript |
| Tree layout | D3.js v7 (layout only — React renders) |
| Export | html-to-image + offscreen SVG renderer |
| Tests | Vitest + @testing-library/react |
| Styles | CSS Modules, dark theme |

## Architecture

```
Input (paste textarea)
  → Parser (pg.ts / mysql.ts → PlanNode)
  → Visualization (D3 layout + React foreignObject node cards)
  → Export (offscreen plain-SVG renderer → PNG / SVG download)
```

D3 owns x/y positioning only. React renders all node cards as `<foreignObject>` in SVG for rich CSS grid layout. Export uses a separate offscreen SVG with plain `<text>` and `<rect>` elements to avoid foreignObject cross-browser issues.

## Node Card Fields

Each node shows all available fields from the plan:

| Field | Description |
|---|---|
| `cost` | Planner startup → total cost |
| `rows` | Planner row estimate |
| `actual` | Actual startup → total time (ms) |
| `actual rows` | Actual rows returned |
| `loops` | Loop count |
| `total time` | `actual time × loops` |
| `est.error` | `actual rows / plan rows` — red if >10× or <0.1× |
| `sh.hit` | Shared buffer hits |
| `sh.read` | Shared buffer reads (disk I/O — shown in red) |
| `sh.dirt` | Shared buffers dirtied |
| `sh.write` | Shared buffers written |
| `tmp.read` | Temp block reads |
| `tmp.write` | Temp block writes |
| `removed` | Rows removed by filter |
| `mem` | Peak memory usage (kB) |
| `hash batches` | Hash batches (>1 means spilled to disk — red) |
| `workers` | Parallel workers launched / planned |
| `sort method` | Sort algorithm used |
| `sort mem` | Sort memory usage (kB) |
| conditions | `Hash Cond`, `Index Cond`, `Filter`, `Join Filter`, `Recheck Cond` |
| unknown fields | Any unrecognized keys from the raw JSON |

## Project Structure

```
src/
├── parsers/
│   ├── types.ts       # PlanNode interface
│   ├── detect.ts      # Auto-detect PG vs MySQL
│   ├── pg.ts          # PostgreSQL JSON parser
│   └── mysql.ts       # MySQL JSON parser
├── components/
│   ├── App.tsx
│   ├── InputPanel.tsx
│   ├── TreeCanvas.tsx
│   ├── TreeLayout.tsx
│   ├── NodeCard.tsx
│   └── Legend.tsx
├── hooks/
│   ├── useD3Tree.ts   # D3 hierarchy + layout
│   └── useExport.ts   # PNG/SVG export
└── utils/
    └── nodeColor.ts   # Node type → color mapping
```
