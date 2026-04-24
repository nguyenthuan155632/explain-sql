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
