import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeCard } from '../../src/components/NodeCard'
import type { PlanNode } from '../../src/parsers/types'

const NODE: PlanNode = {
  nodeType: 'Hash Join',
  startupCost: 120,
  totalCost: 480.5,
  planRows: 1200,
  planWidth: 64,
  actualStartupTime: 0.143,
  actualTotalTime: 312.8,
  actualRows: 1185,
  actualLoops: 1,
  totalActualTime: 312.8,
  rowEstimateError: 0.9875,
  sharedHitBlocks: 8840,
  sharedReadBlocks: 12,
  hashCond: '(o.user_id = u.id)',
  children: [],
  raw: {},
}

describe('NodeCard', () => {
  it('renders node type', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText('Hash Join')).toBeInTheDocument()
  })

  it('renders cost range', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/120/)).toBeInTheDocument()
    expect(screen.getByText(/480\.5/)).toBeInTheDocument()
  })

  it('renders actual rows', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/1,185/)).toBeInTheDocument()
  })

  it('renders hash condition', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/o\.user_id = u\.id/)).toBeInTheDocument()
  })

  it('renders shared hit blocks', () => {
    render(<NodeCard node={NODE} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByText(/8,840/)).toBeInTheDocument()
  })
})
