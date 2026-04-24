import { describe, it, expect } from 'vitest'
import { detectDb } from '../../src/parsers/detect'

describe('detectDb', () => {
  it('detects PostgreSQL from array JSON', () => {
    const input = JSON.stringify([{ Plan: { 'Node Type': 'Seq Scan' } }])
    expect(detectDb(input)).toBe('pg')
  })

  it('detects MySQL from query_block key', () => {
    const input = JSON.stringify({ query_block: { select_id: 1 } })
    expect(detectDb(input)).toBe('mysql')
  })

  it('detects MySQL from Query Block key', () => {
    const input = JSON.stringify({ 'Query Block': { select_id: 1 } })
    expect(detectDb(input)).toBe('mysql')
  })

  it('returns null for unrecognized input', () => {
    expect(detectDb('not json')).toBeNull()
    expect(detectDb('{}')).toBeNull()
  })
})
