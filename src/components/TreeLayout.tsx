import { NodeCard } from './NodeCard'
import type { D3TreeResult } from '../hooks/useD3Tree'

const NODE_WIDTH = 290
const NODE_HEIGHT = 210

interface Props {
  tree: D3TreeResult
  onToggle: (id: string) => void
}

export function TreeLayout({ tree, onToggle }: Props) {
  return (
    <>
      {tree.links.map((link, i) => (
        <path
          key={i}
          d={`M ${link.sourceX} ${link.sourceY} C ${link.sourceX} ${(link.sourceY + link.targetY) / 2}, ${link.targetX} ${(link.sourceY + link.targetY) / 2}, ${link.targetX} ${link.targetY}`}
          fill="none"
          stroke="#30363d"
          strokeWidth={1.5}
        />
      ))}
      {tree.nodes.map((node) => (
        <foreignObject
          key={node.id}
          x={node.x - NODE_WIDTH / 2}
          y={node.y}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          style={{ overflow: 'visible' }}
        >
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: NODE_WIDTH }}>
            <NodeCard
              node={node.data}
              collapsed={node.collapsed}
              onToggle={() => onToggle(node.id)}
            />
          </div>
        </foreignObject>
      ))}
    </>
  )
}
