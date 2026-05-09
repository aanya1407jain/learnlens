import { useState, useEffect } from 'react'
import { useStreamingAI } from '../hooks/useStreamingAI'
import useStudentStore from '../store/studentStore'

export default function CatchupCard({ concept, weekNumber, onDone, onSnooze }) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  const { streamCatchup, streaming } = useStreamingAI()
  const addWatchedConcept = useStudentStore((s) => s.addWatchedConcept)
  const student = useStudentStore((s) => s.student)

  useEffect(() => {
    streamCatchup({
      conceptName: concept,
      onToken: (_, full) => setText(full),
      onDone: () => setDone(true)
    })
  }, [concept])

  const handleMarkDone = async () => {
    addWatchedConcept(concept)
    try {
      await fetch(`http://localhost:8000/catchup/mark-done?student_id=${student.id}&concept=${encodeURIComponent(concept)}&week_number=${weekNumber}`, {
        method: 'POST'
      })
    } catch {}
    onDone?.()
  }

  return (
    <div className="mb-3 bg-indigo-900/20 border border-indigo-600/40 rounded-xl overflow-hidden animate-in slide-in-from-top duration-300">
      <div className="px-4 py-3 bg-indigo-900/30 border-b border-indigo-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-indigo-300 font-semibold text-sm">⚡ 30-Second Catch-up</span>
          <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-indigo-500/30">
            {concept} — Week {weekNumber}
          </span>
        </div>
        {streaming && (
          <div className="flex items-center gap-1 text-xs text-indigo-400">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            Generating...
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="text-gray-200 text-sm leading-relaxed min-h-[60px]">
          {text || <span className="text-gray-500 animate-pulse">Explanation aa rahi hai...</span>}
          {streaming && <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />}
        </div>

        {done && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleMarkDone}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              ✅ Samajh gaya! Mark as Done
            </button>
            <button
              onClick={onSnooze}
              className="text-gray-400 hover:text-gray-200 text-sm px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
            >
              Baad mein dekhna
            </button>
          </div>
        )}
      </div>
    </div>
  )
}