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
