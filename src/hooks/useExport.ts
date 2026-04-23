import { toPng, toSvg } from 'html-to-image'
import type { D3TreeResult } from './useD3Tree'
import type { PlanNode } from '../parsers/types'
import { nodeColor } from '../utils/nodeColor'

const NODE_W = 290
const NODE_H = 210
const FONT = 'monospace'

function renderNodeToSvg(
  svg: SVGSVGElement,
  node: PlanNode,
  x: number,
  y: number
) {
  const colors = nodeColor(node.nodeType)

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(NODE_W))
  rect.setAttribute('height', String(NODE_H))
  rect.setAttribute('rx', '6')
  rect.setAttribute('fill', colors.background)
  rect.setAttribute('stroke', colors.border)
  svg.appendChild(rect)

  const fields: [string, string][] = [
    ['type', node.nodeType],
    ['cost', `${node.startupCost.toFixed(2)}→${node.totalCost.toFixed(2)}`],
    ['rows', String(node.planRows)],
  ]
  if (node.actualTotalTime !== undefined)
    fields.push(['actual', `${node.actualTotalTime.toFixed(2)}ms`])
  if (node.actualRows !== undefined)
    fields.push(['act.rows', String(node.actualRows)])
  if (node.sharedHitBlocks !== undefined)
    fields.push(['sh.hit', String(node.sharedHitBlocks)])
  if (node.sharedReadBlocks !== undefined && node.sharedReadBlocks > 0)
    fields.push(['sh.read', String(node.sharedReadBlocks)])

  fields.forEach(([label, value], i) => {
    const ty = y + 20 + i * 16
    const tLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    tLabel.setAttribute('x', String(x + 8))
    tLabel.setAttribute('y', String(ty))
    tLabel.setAttribute('fill', '#484f58')
    tLabel.setAttribute('font-size', '9')
    tLabel.setAttribute('font-family', FONT)
    tLabel.textContent = label + ':'
    svg.appendChild(tLabel)

    const tVal = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    tVal.setAttribute('x', String(x + 80))
    tVal.setAttribute('y', String(ty))
    tVal.setAttribute('fill', colors.border)
    tVal.setAttribute('font-size', '9')
    tVal.setAttribute('font-family', FONT)
    tVal.textContent = value
    svg.appendChild(tVal)
  })
}

function buildOffscreenSvg(treeResult: D3TreeResult): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', String(treeResult.width + 80))
  svg.setAttribute('height', String(treeResult.height + 80))
  svg.style.background = '#010409'

  treeResult.links.forEach((link) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const mx = (link.sourceX + link.targetX) / 2
    const my = (link.sourceY + link.targetY) / 2
    path.setAttribute(
      'd',
      `M ${link.sourceX} ${link.sourceY} C ${link.sourceX} ${my}, ${link.targetX} ${my}, ${link.targetX} ${link.targetY}`
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#30363d')
    path.setAttribute('stroke-width', '1.5')
    svg.appendChild(path)
  })

  treeResult.nodes.forEach((node) => {
    renderNodeToSvg(svg, node.data, node.x - NODE_W / 2, node.y)
  })

  return svg
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function useExport(treeResult: D3TreeResult) {
  const timestamp = () => Date.now()

  const exportPng = async () => {
    const svg = buildOffscreenSvg(treeResult)
    document.body.appendChild(svg)
    try {
      const dataUrl = await toPng(svg)
      triggerDownload(dataUrl, `plan-${timestamp()}.png`)
    } finally {
      document.body.removeChild(svg)
    }
  }

  const exportSvg = async () => {
    const svg = buildOffscreenSvg(treeResult)
    document.body.appendChild(svg)
    try {
      const dataUrl = await toSvg(svg)
      triggerDownload(dataUrl, `plan-${timestamp()}.svg`)
    } finally {
      document.body.removeChild(svg)
    }
  }

  return { exportPng, exportSvg }
}
