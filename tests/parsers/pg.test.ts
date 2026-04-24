import { describe, it, expect } from 'vitest'
import { parsePg } from '../../src/parsers/pg'

const SAMPLE_PG = JSON.stringify([
  {
    Plan: {
      'Node Type': 'Hash Join',
      'Startup Cost': 120.0,
      'Total Cost': 480.5,
      'Plan Rows': 1200,
      'Plan Width': 64,
      'Actual Startup Time': 0.143,
      'Actual Total Time': 312.8,
      'Actual Rows': 1185,
      'Actual Loops': 1,
      'Hash Cond': '(o.user_id = u.id)',
      'Shared Hit Blocks': 8840,
      'Shared Read Blocks': 12,
      'Shared Dirtied Blocks': 0,
      'Shared Written Blocks': 0,
      'Local Hit Blocks': 0,
      'Local Read Blocks': 0,
      'Temp Read Blocks': 0,
      'Temp Written Blocks': 0,
      Plans: [
        {
          'Node Type': 'Seq Scan',
          'Parent Relationship': 'Outer',
          'Relation Name': 'orders',
          Alias: 'o',
          'Startup Cost': 0.0,
          'Total Cost': 88.0,
          'Plan Rows': 1000,
          'Plan Width': 32,
          'Actual Startup Time': 0.021,
          'Actual Total Time': 1.84,
          'Actual Rows': 1000,
          'Actual Loops': 1,
          Filter: "(status = 'active')",
          'Rows Removed by Filter': 240,
          'Shared Hit Blocks': 440,
          'Shared Read Blocks': 0,
          'Shared Dirtied Blocks': 0,
          'Shared Written Blocks': 0,
          'Local Hit Blocks': 0,
          'Local Read Blocks': 0,
          'Temp Read Blocks': 0,
          'Temp Written Blocks': 0,
          Plans: [],
        },
      ],
    },
    'Planning Time': 0.5,
    'Execution Time': 313.2,
  },
])

describe('parsePg', () => {
  it('parses root node type', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.nodeType).toBe('Hash Join')
  })

  it('parses cost fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.startupCost).toBe(120.0)
    expect(root.totalCost).toBe(480.5)
    expect(root.planRows).toBe(1200)
    expect(root.planWidth).toBe(64)
  })

  it('parses actual execution fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.actualStartupTime).toBe(0.143)
    expect(root.actualTotalTime).toBe(312.8)
    expect(root.actualRows).toBe(1185)
    expect(root.actualLoops).toBe(1)
  })

  it('computes derived totalActualTime', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.totalActualTime).toBe(312.8)
  })

  it('computes derived rowEstimateError', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.rowEstimateError).toBeCloseTo(1185 / 1200)
  })

  it('parses buffer fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.sharedHitBlocks).toBe(8840)
    expect(root.sharedReadBlocks).toBe(12)
  })

  it('parses condition fields', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.hashCond).toBe('(o.user_id = u.id)')
  })

  it('parses children recursively', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.children).toHaveLength(1)
    expect(root.children[0].nodeType).toBe('Seq Scan')
    expect(root.children[0].relationName).toBe('orders')
    expect(root.children[0].filter).toBe("(status = 'active')")
    expect(root.children[0].rowsRemovedByFilter).toBe(240)
  })

  it('stores unknown keys in raw', () => {
    const root = parsePg(SAMPLE_PG)
    expect(root.raw).toBeDefined()
  })
})
