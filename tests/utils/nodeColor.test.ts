import { describe, it, expect } from 'vitest'
import { nodeColor } from '../../src/utils/nodeColor'

describe('nodeColor', () => {
  it('colors join nodes red', () => {
    expect(nodeColor('Hash Join').border).toBe('#f78166')
    expect(nodeColor('Merge Join').border).toBe('#f78166')
    expect(nodeColor('Nested Loop').border).toBe('#f78166')
  })

  it('colors scan nodes blue', () => {
    expect(nodeColor('Seq Scan').border).toBe('#388bfd')
    expect(nodeColor('Tid Scan').border).toBe('#388bfd')
    expect(nodeColor('Function Scan').border).toBe('#388bfd')
  })

  it('colors index nodes green', () => {
    expect(nodeColor('Index Scan').border).toBe('#3fb950')
    expect(nodeColor('Index Only Scan').border).toBe('#3fb950')
    expect(nodeColor('Bitmap Heap Scan').border).toBe('#3fb950')
  })

  it('colors sort/agg nodes purple', () => {
    expect(nodeColor('Sort').border).toBe('#d2a8ff')
    expect(nodeColor('Aggregate').border).toBe('#d2a8ff')
    expect(nodeColor('Incremental Sort').border).toBe('#d2a8ff')
    expect(nodeColor('Group').border).toBe('#d2a8ff')
  })

  it('colors Hash node yellow', () => {
    expect(nodeColor('Hash').border).toBe('#e3b341')
  })

  it('colors unknown nodes grey', () => {
    expect(nodeColor('Unknown Node').border).toBe('#8b949e')
  })

  it('returns background color for each category', () => {
    expect(nodeColor('Hash Join').background).toBeDefined()
    expect(nodeColor('Seq Scan').background).toBeDefined()
  })
})
