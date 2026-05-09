import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import useStudentStore from '../store/studentStore'

const API_BASE = 'http://localhost:8000'

function getMasteryColor(mastery, status) {
  if (status === 'locked') return '#4B5563'
  if (mastery >= 0.7) return '#1D9E75'
  if (mastery >= 0.4) return '#BA7517'
  return '#E24B4A'
}

function getMasteryRadius(mastery, status) {
  if (status === 'locked') return 12
  return 12 + mastery * 18
}

export default function KnowledgeGraph() {
  const svgRef = useRef(null)
  const [graphData, setGraphData] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [newlyUnlocked, setNewlyUnlocked] = useState([])
  const student = useStudentStore((s) => s.student)
  const setGraphDataStore = useStudentStore((s) => s.setGraphData)

  const fetchGraph = async () => {
    try {
      const res = await fetch(`${API_BASE}/graph?student_id=${student.id}`)
      const data = await res.json()
      setGraphData(data)
      setGraphDataStore(data)
    } catch (err) {
      console.error('Graph fetch error:', err)
    }
  }

  useEffect(() => {
    fetchGraph()
    const interval = setInterval(fetchGraph, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!graphData || !svgRef.current) return

    const container = svgRef.current.parentElement
    const width = container.clientWidth || 400
    const height = 320

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Week cluster backgrounds
    const weekGroups = {}
    graphData.nodes.forEach(n => {
      if (!weekGroups[n.week_number]) weekGroups[n.week_number] = []
      weekGroups[n.week_number].push(n)
    })

    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.edges)
        .id(d => d.id)
        .distance(70))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getMasteryRadius(d.mastery, d.status) + 8))

    // Defs for glow
    const defs = svg.append('defs')
    const glow = defs.append('filter').attr('id', 'glow')
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = glow.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Links
    const link = svg.append('g')
      .selectAll('line')
      .data(graphData.edges)
      .enter().append('line')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => {
        const target = graphData.nodes.find(n => n.id === (d.target.id || d.target))
        return target?.status === 'locked' ? '4,4' : null
      })

    // Nodes
    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .on('click', (event, d) => setSelectedNode(d))
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )

    // Week number label (background)
    nodeGroup.append('text')
      .attr('dy', d => -getMasteryRadius(d.mastery, d.status) - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6B7280')
      .attr('font-size', '9px')
      .text(d => `W${d.week_number}`)

    // Circle
    nodeGroup.append('circle')
      .attr('r', d => getMasteryRadius(d.mastery, d.status))
      .attr('fill', d => getMasteryColor(d.mastery, d.status))
      .attr('stroke', d => newlyUnlocked.includes(d.id) ? '#FBBF24' : 'rgba(255,255,255,0.1)')
      .attr('stroke-width', d => newlyUnlocked.includes(d.id) ? 3 : 1)
      .attr('opacity', d => d.status === 'locked' ? 0.5 : 1)
      .attr('filter', d => d.mastery >= 0.7 ? 'url(#glow)' : null)

    // Lock icon for locked nodes
    nodeGroup.filter(d => d.status === 'locked')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .text('🔒')

    // Label
    nodeGroup.filter(d => d.status !== 'locked')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .text(d => d.id.length > 8 ? d.id.slice(0, 8) + '…' : d.id)

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      nodeGroup.attr('transform', d => `translate(${
        Math.max(25, Math.min(width - 25, d.x))
      },${
        Math.max(20, Math.min(height - 20, d.y))
      })`)
    })

  }, [graphData, newlyUnlocked])

  if (!graphData) {
    return (
      <div className="bg-sheryians-card rounded-xl border border-sheryians-border p-4 flex items-center justify-center h-48">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sheryians-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Loading knowledge graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-sheryians-card rounded-xl border border-sheryians-border overflow-hidden">
      <div className="px-4 py-3 border-b border-sheryians-border flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Knowledge Graph</h3>
          <p className="text-gray-500 text-xs mt-0.5">Sheryians DSA Domination Cohort</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sheryians-green" /> Mastered</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sheryians-amber" /> In Progress</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-600" /> Locked</span>
        </div>
      </div>

      <div className="relative">
        <svg ref={svgRef} className="w-full" />
      </div>

      {selectedNode && (
        <div className="mx-4 mb-3 p-3 bg-gray-800/60 rounded-lg border border-sheryians-border">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-white font-semibold text-sm">{selectedNode.id}</span>
              <span className="text-gray-500 text-xs ml-2">Week {selectedNode.week_number}</span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Mastery</span>
              <span>{Math.round(selectedNode.mastery * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${selectedNode.mastery * 100}%`,
                  backgroundColor: getMasteryColor(selectedNode.mastery, selectedNode.status)
                }} />
            </div>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${selectedNode.status === 'mastered' ? 'bg-green-900 text-green-300'
                : selectedNode.status === 'in_progress' ? 'bg-amber-900 text-amber-300'
                : 'bg-gray-700 text-gray-400'}`}>
              {selectedNode.status === 'locked' ? '🔒 Locked' : selectedNode.status === 'mastered' ? '✅ Mastered' : '⚡ In Progress'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}