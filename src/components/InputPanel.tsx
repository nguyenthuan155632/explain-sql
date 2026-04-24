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
