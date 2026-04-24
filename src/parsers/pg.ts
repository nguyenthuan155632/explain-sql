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
