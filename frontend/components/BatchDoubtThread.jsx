import { useState } from 'react'
import useStudentStore from '../store/studentStore'

export default function BatchDoubtThread() {
  const [expanded, setExpanded] = useState({})
  const batchDoubt = useStudentStore((s) => s.batchDoubt)
  const clearBatchDoubt = useStudentStore((s) => s.clearBatchDoubt)

  if (!batchDoubt || !batchDoubt.similar_found) return null

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const markHelpful = async (id) => {
    try {
      await fetch('http://localhost:8000/doubts/mark-helpful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: id })
      })
    } catch {}
  }

  return (
    <div className="bg-sheryians-card border border-sheryians-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-purple-900/20 border-b border-purple-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">👥</span>
          <div>
            <p className="text-purple-300 font-semibold text-sm">
              Tumhare {batchDoubt.count} batchmates ne bhi yahi poocha!
            </p>
            <p className="text-purple-400/60 text-xs">Similar doubts from your batch</p>
          </div>
        </div>
        <button onClick={clearBatchDoubt} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
      </div>

      <div className="divide-y divide-sheryians-border">
        {(batchDoubt.top_answers || []).slice(0, 2).map((item, i) => (
          <div key={item.id || i} className="p-4">
            <p className="text-gray-300 text-sm font-medium mb-1">"{item.question}"</p>
            <p className="text-gray-500 text-xs leading-relaxed mb-2">
              {expanded[item.id || i] ? item.answer_preview : (item.answer_preview || '').slice(0, 120) + '...'}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleExpand(item.id || i)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {expanded[item.id || i] ? 'Collapse ↑' : 'Full answer dekhna ↓'}
              </button>
              <button
                onClick={() => markHelpful(item.id)}
                className="text-xs text-gray-500 hover:text-green-400 transition-colors flex items-center gap-1"
              >
                👍 Helpful tha? <span className="text-gray-600">({item.helpful_count || 0})</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}