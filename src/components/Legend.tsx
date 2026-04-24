import { nodeColor } from '../utils/nodeColor'

const ENTRIES = [
  { label: 'Join', type: 'Hash Join' },
  { label: 'Scan', type: 'Seq Scan' },
  { label: 'Index', type: 'Index Scan' },
  { label: 'Sort/Agg', type: 'Sort' },
  { label: 'Hash', type: 'Hash' },
  { label: 'Other', type: 'Unknown' },
]

export function Legend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        display: 'flex',
        gap: 12,
        fontFamily: 'monospace',
        fontSize: 9,
        pointerEvents: 'none',
      }}
    >
      {ENTRIES.map(({ label, type }) => (
        <span key={label} style={{ color: nodeColor(type).border }}>
          ■ {label}
        </span>
      ))}
    </div>
  )
}
