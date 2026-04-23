export interface PlanNode {
  nodeType: string
  relationName?: string
  alias?: string
  indexName?: string
  parentRelationship?: string

  startupCost: number
  totalCost: number
  planRows: number
  planWidth: number

  actualStartupTime?: number
  actualTotalTime?: number
  actualRows?: number
  actualLoops?: number

  totalActualTime?: number
  rowEstimateError?: number

  sharedHitBlocks?: number
  sharedReadBlocks?: number
  sharedDirtiedBlocks?: number
  sharedWrittenBlocks?: number
  localHitBlocks?: number
  localReadBlocks?: number
  tempReadBlocks?: number
  tempWrittenBlocks?: number

  filter?: string
  rowsRemovedByFilter?: number
  indexCond?: string
  recheckCond?: string
  hashCond?: string
  joinFilter?: string

  sortKey?: string[]
  sortMethod?: string
  sortSpaceUsed?: number
  sortSpaceType?: string

  hashBatches?: number
  originalHashBatches?: number
  peakMemoryUsage?: number

  workersPlanned?: number
  workersLaunched?: number

  children: PlanNode[]

  raw: Record<string, unknown>
}
