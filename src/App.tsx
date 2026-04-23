import { useState, useMemo } from 'react'
import { InputPanel } from './components/InputPanel'
import { TreeCanvas } from './components/TreeCanvas'
import { useD3Tree } from './hooks/useD3Tree'
import type { PlanNode } from './parsers/types'
import styles from './components/App.module.css'

export default function App() {
  const [plan, setPlan] = useState<PlanNode | null>(null)
  const emptyCollapsed = useMemo(() => new Set<string>(), [])
  const treeResult = useD3Tree(plan, emptyCollapsed)

  return (
    <div className={styles.app}>
      <InputPanel onPlan={setPlan} treeResult={treeResult} />
      <TreeCanvas root={plan} />
    </div>
  )
}
