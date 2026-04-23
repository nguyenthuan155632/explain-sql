import * as d3 from 'd3'
import { useMemo } from 'react'
import type { PlanNode } from '../parsers/types'

export interface PositionedNode {
  data: PlanNode
  x: number
  y: number
  id: string
  collapsed: boolean
}

export interface TreeLink {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface D3TreeResult {
  nodes: PositionedNode[]
  links: TreeLink[]
  width: number
  height: number
}

const NODE_WIDTH = 290
const NODE_HEIGHT = 210
const H_GAP = 40
const V_GAP = 80

function assignIds(node: PlanNode, prefix = '0'): PlanNode & { _id: string } {
  return {
    ...node,
    _id: prefix,
    children: node.children.map((c, i) =>
      assignIds(c, `${prefix}-${i}`)
    ),
  } as PlanNode & { _id: string }
}

export function useD3Tree(
  root: PlanNode | null,
  collapsedIds: Set<string>
): D3TreeResult {
  return useMemo(() => {
    if (!root) return { nodes: [], links: [], width: 0, height: 0 }

    const withIds = assignIds(root)

    const hierarchy = d3.hierarchy<PlanNode & { _id: string }>(withIds, (d) => {
      if (collapsedIds.has(d._id)) return []
      return d.children as Array<PlanNode & { _id: string }>
    })

    const treeLayout = d3
      .tree<PlanNode & { _id: string }>()
      .nodeSize([NODE_WIDTH + H_GAP, NODE_HEIGHT + V_GAP])

    const layoutRoot = treeLayout(hierarchy)

    const allNodes = layoutRoot.descendants()
    const allLinks = layoutRoot.links()

    const minX = Math.min(...allNodes.map((n) => n.x)) - NODE_WIDTH / 2
    const maxX = Math.max(...allNodes.map((n) => n.x)) + NODE_WIDTH / 2
    const maxY = Math.max(...allNodes.map((n) => n.y)) + NODE_HEIGHT

    const offsetX = -minX + 40

    const nodes: PositionedNode[] = allNodes.map((n) => ({
      data: n.data,
      x: n.x + offsetX,
      y: n.y + 40,
      id: n.data._id,
      collapsed: collapsedIds.has(n.data._id),
    }))

    const links: TreeLink[] = allLinks.map((l) => ({
      sourceX: l.source.x + offsetX,
      sourceY: l.source.y + 40 + NODE_HEIGHT,
      targetX: l.target.x + offsetX,
      targetY: l.target.y + 40,
    }))

    return {
      nodes,
      links,
      width: maxX - minX + 80,
      height: maxY + 80,
    }
  }, [root, collapsedIds])
}
