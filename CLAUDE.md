# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Type-check + Vite production build
npm test          # Run all tests once (Vitest)
npm run test:watch  # Vitest in watch mode
```

Run a single test file:
```bash
npx vitest run tests/parsers/pg.test.ts
```

## Architecture

The app is a pure client-side React + Vite SPA with no backend. Data flows in one direction:

```
InputPanel (textarea)
  → detectDb() → pg.ts | mysql.ts → PlanNode tree
  → App state (useState<PlanNode | null>)
  → TreeCanvas → useD3Tree (D3 layout only) → TreeLayout (React renders nodes)
  → Export: useExport builds an offscreen plain-SVG (no foreignObject) → PNG/SVG download
```

**Key design decisions:**
- D3 is used only for `d3.hierarchy` + `d3.tree` layout math (x/y coordinates). React renders all SVG elements including node cards via `<foreignObject>`.
- Export bypasses `<foreignObject>` by building a separate offscreen SVG with plain `<text>` and `<rect>` elements (`useExport.ts`), avoiding cross-browser rendering issues.
- Node collapse state lives in `TreeCanvas` as a `Set<string>` of node IDs. IDs are path-based strings assigned by `assignIds()` in `useD3Tree.ts`.

**Parser contract:** Both `pg.ts` and `mysql.ts` must return a `PlanNode` (defined in `src/parsers/types.ts`). The `raw` field carries the original JSON object for any fields not explicitly mapped. `detect.ts` sniffs the DB type from JSON structure before parsing.

**Node coloring:** `src/utils/nodeColor.ts` maps node type keywords to `{ background, border }` color pairs. The same logic is used by both the live SVG and the export renderer.

## Testing

Tests live in `tests/` mirroring `src/` structure. Vitest runs in jsdom. The setup file is `tests/setup.ts` (imports `@testing-library/jest-dom`).

Parser tests (`pg.test.ts`, `mysql.test.ts`) are the most critical — they guard the `PlanNode` contract that the rest of the app depends on.

## Linting & Type Checking

```bash
npm run build    # Runs `tsc -b` before Vite build — catches type errors
```

ESLint is configured with TypeScript, React Hooks, and React Refresh rules. No separate lint command is exposed; errors are caught by `tsc -b` during build.

## Known Limitations

- **MySQL EXPLAIN ANALYZE JSON format** (v1) — MySQL `EXPLAIN FORMAT=JSON` provides planner estimates only. For actual execution timing, MySQL 8.0.18+ has `EXPLAIN ANALYZE`, but its output is text-only and not yet supported. Future versions may add support.
- **ForeignObject export** — Export uses a separate offscreen SVG with plain `<text>` and `<rect>` elements instead of foreignObject. This avoids cross-browser rendering issues with `html-to-image` and foreignObject-based SVG.

## Dependencies

- **D3.js** — Layout and math only (hierarchy, tree layout, link generation). React renders all DOM.
- **html-to-image** — Used for PNG and SVG export of the offscreen renderer.
- **React 18 + TypeScript** — Modern types, no legacy class component patterns.
- **Vite** — Fast dev server and production bundler.
- **Vitest + @testing-library/react** — Unit and component tests in jsdom.
