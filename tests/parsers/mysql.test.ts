import { describe, it, expect } from 'vitest'
import { parseMysql } from '../../src/parsers/mysql'

const SAMPLE_MYSQL = JSON.stringify({
  query_block: {
    select_id: 1,
    cost_info: { query_cost: '480.50' },
    nested_loop: [
      {
        table: {
          table_name: 'orders',
          access_type: 'ALL',
          rows_examined_per_scan: 1000,
          rows_produced_per_join: 1000,
          filtered: '100.00',
          cost_info: {
            read_cost: '50.00',
            eval_cost: '100.00',
            prefix_cost: '150.00',
          },
        },
      },
      {
        table: {
          table_name: 'users',
          access_type: 'eq_ref',
          key: 'PRIMARY',
          rows_examined_per_scan: 1,
          rows_produced_per_join: 1000,
          filtered: '100.00',
          cost_info: {
            read_cost: '250.00',
            eval_cost: '100.00',
            prefix_cost: '500.00',
          },
        },
      },
    ],
  },
})

describe('parseMysql', () => {
  it('parses root node type from nested_loop', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.nodeType).toBe('Nested Loop')
  })

  it('parses total cost from query_cost', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.totalCost).toBe(480.5)
    expect(root.startupCost).toBe(0)
  })

  it('has no actual timing (FORMAT JSON only has estimates)', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.actualTotalTime).toBeUndefined()
    expect(root.actualRows).toBeUndefined()
  })

  it('parses children for each nested_loop table', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.children).toHaveLength(2)
    expect(root.children[0].nodeType).toBe('ALL')
    expect(root.children[0].relationName).toBe('orders')
    expect(root.children[0].planRows).toBe(1000)
    expect(root.children[1].nodeType).toBe('eq_ref')
    expect(root.children[1].relationName).toBe('users')
    expect(root.children[1].indexName).toBe('PRIMARY')
  })

  it('stores unknown keys in raw', () => {
    const root = parseMysql(SAMPLE_MYSQL)
    expect(root.raw).toBeDefined()
  })

  it('throws on invalid input', () => {
    expect(() => parseMysql('{}')).toThrow()
    expect(() => parseMysql('not json')).toThrow()
  })
})
