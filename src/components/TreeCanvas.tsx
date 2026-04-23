import { useRef, useEffect, useCallback, useState } from 'react'
import * as d3 from 'd3'
import { TreeLayout } from './TreeLayout'
import { Legend } from './Legend'
import { useD3Tree } from '../hooks/useD3Tree'
import type { PlanNode } from '../parsers/types'
import styles from './TreeCanvas.module.css'

interface Props {
  root: PlanNode | null
}

export function TreeCanvas({ root }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const tree = useD3Tree(root, collapsedIds)

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (e) => {
        d3.select(gRef.current).attr('transform', e.transform.toString())
      })
    svg.call(zoom)
    zoomRef.current = zoom

    if (tree.width > 0 && tree.height > 0) {
      const svgEl = svgRef.current
      const w = svgEl.clientWidth || 800
      const h = svgEl.clientHeight || 600
      const scale = Math.min(w / tree.width, h / tree.height, 1) * 0.9
      const tx = (w - tree.width * scale) / 2
      const ty = 20
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }
  }, [tree.width, tree.height])

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.3)
  }

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.77)
  }

  const handleFit = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || tree.width === 0) return
    const svgEl = svgRef.current
    const w = svgEl.clientWidth || 800
    const h = svgEl.clientHeight || 600
    const scale = Math.min(w / tree.width, h / tree.height, 1) * 0.9
    const tx = (w - tree.width * scale) / 2
    d3.select(svgEl)
      .transition()
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, 20).scale(scale))
  }, [tree.width, tree.height])

  const handleExpandAll = () => setCollapsedIds(new Set())
  const handleCollapseAll = () => {
    const allIds = new Set(tree.nodes.filter((n) => n.data.children.length > 0).map((n) => n.id))
    setCollapsedIds(allIds)
  }

  const handleToggle = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className={styles.container}>
      {root && (
        <div className={styles.toolbar}>
          <button className={styles.toolbarBtn} onClick={handleZoomIn}>+ Zoom</button>
          <button className={styles.toolbarBtn} onClick={handleZoomOut}>− Zoom</button>
          <button className={styles.toolbarBtn} onClick={handleFit}>⊡ Fit</button>
          <button className={styles.toolbarBtn} onClick={handleExpandAll}>⊞ Expand</button>
          <button className={styles.toolbarBtn} onClick={handleCollapseAll}>⊟ Collapse</button>
        </div>
      )}
      {!root && <div className={styles.empty}>Paste EXPLAIN ANALYZE JSON output and click Visualize</div>}
      <svg ref={svgRef} className={styles.svg}>
        <g ref={gRef}>
          {root && <TreeLayout tree={tree} onToggle={handleToggle} />}
        </g>
      </svg>
      {root && <Legend />}
    </div>
  )
}
