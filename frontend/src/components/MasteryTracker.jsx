import { useEffect, useState } from 'react'
import useStudentStore from '../store/studentStore'

const API_BASE = 'http://localhost:8000'

function MasteryBar({ concept, mastery, status }) {
  const pct = Math.round(mastery * 100)
  const color = status === 'locked' ? '#4B5563'
    : mastery >= 0.7 ? '#1D9E75'
    : mastery >= 0.4 ? '#BA7517' : '#E24B4A'

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-300 flex items-center gap-1">
          {status === 'locked' && <span>🔒</span>}
          {status === 'mastered' && <span>✅</span>}
          {status === 'in_progress' && <span>⚡</span>}
          {concept}
        </span>
        <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function MasteryTracker() {
  const [nodes, setNodes] = useState([])
  const student = useStudentStore((s) => s.student)

  useEffect(() => {
    const fetch_graph = async () => {
      try {
        const res = await fetch(`${API_BASE}/graph?student_id=${student.id}`)
        const data = await res.json()
        // Only show non-locked nodes + some locked ones for context
        const sorted = [...data.nodes].sort((a, b) => {
          if (a.status === 'locked' && b.status !== 'locked') return 1
          if (a.status !== 'locked' && b.status === 'locked') return -1
          return b.mastery - a.mastery
        })
        setNodes(sorted.slice(0, 10))
      } catch {}
    }
    fetch_graph()
    const interval = setInterval(fetch_graph, 8000)
    return () => clearInterval(interval)
  }, [])

  const mastered = nodes.filter(n => n.status === 'mastered').length
  const inProgress = nodes.filter(n => n.status === 'in_progress').length

  return (
    <div className="bg-sheryians-card rounded-xl border border-sheryians-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Mastery Tracker</h3>
        <div className="flex gap-2 text-xs">
          <span className="bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">{mastered} mastered</span>
          <span className="bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded-full">{inProgress} in progress</span>
        </div>
      </div>
      <div className="space-y-3">
        {nodes.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">Loading mastery data...</div>
        ) : (
          nodes.map(n => (
            <MasteryBar key={n.id} concept={n.id} mastery={n.mastery} status={n.status} />
          ))
        )}
      </div>
    </div>
  )
}