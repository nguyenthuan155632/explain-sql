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
