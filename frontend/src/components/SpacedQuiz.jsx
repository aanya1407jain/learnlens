import { useState, useEffect, useRef } from 'react'
import useStudentStore from '../store/studentStore'

const API_BASE = 'http://localhost:8000'

export default function SpacedQuiz({ onClose }) {
  const [quizItem, setQuizItem] = useState(null)
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [timerSec, setTimerSec] = useState(120)
  const [dueCount, setDueCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const timerRef = useRef(null)
  const student = useStudentStore((s) => s.student)

  const fetchDue = async () => {
    try {
      const res = await fetch(`${API_BASE}/quiz/due?student_id=${student.id}`)
      const data = await res.json()
      setDueCount(data.count || 0)
      return data
    } catch { return { count: 0, items: [] } }
  }

  const generateQuiz = async () => {
    setLoading(true)
    setSelected(null)
    setResult(null)
    setTimerSec(120)
    try {
      const res = await fetch(`${API_BASE}/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, batch_id: student.batchId })
      })
      const data = await res.json()
      setQuizItem(data)
    } catch { }
    setLoading(false)
  }

  useEffect(() => {
    fetchDue()
    generateQuiz()
  }, [])

  useEffect(() => {
    if (!quizItem || result) return
    timerRef.current = setInterval(() => {
      setTimerSec(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [quizItem, result])

  const handleAnswer = async (idx) => {
    if (result) return
    setSelected(idx)
    clearInterval(timerRef.current)

    try {
      const res = await fetch(`${API_BASE}/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 0,
          selected_idx: idx,
          student_id: student.id,
          ef: 2.5,
          interval_days: 1,
          correct_idx: quizItem.correct_index
        })
      })
      const data = await res.json()
      setResult(data)
      setCompletedCount(c => c + 1)
    } catch { }
  }

  return (
    <div className="bg-sheryians-card border border-sheryians-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-sheryians-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🃏</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Spaced Repetition Quiz</h3>
            {dueCount > 0 && (
              <p className="text-amber-400 text-xs">Aaj {dueCount} cheezein revise karni hain!</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quizItem && !result && (
            <span className={`font-mono text-sm font-bold ${timerSec < 30 ? 'text-red-400' : 'text-gray-400'}`}>
              {Math.floor(timerSec / 60)}:{(timerSec % 60).toString().padStart(2, '0')}
            </span>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-sheryians-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Question generate ho raha hai...</p>
          </div>
        ) : quizItem ? (
          <>
            <div className="mb-4">
              <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/40 mb-2 inline-block">
                {quizItem.concept}
              </span>
              <p className="text-white text-sm font-medium leading-relaxed">{quizItem.question}</p>
            </div>

            <div className="space-y-2 mb-4">
              {(quizItem.options || []).map((opt, i) => {
                let btnClass = 'w-full text-left px-4 py-3 rounded-lg text-sm border transition-all '
                if (result) {
                  if (i === quizItem.correct_index) btnClass += 'bg-green-900/40 border-green-600 text-green-300'
                  else if (i === selected) btnClass += 'bg-red-900/40 border-red-600 text-red-300'
                  else btnClass += 'bg-gray-800/30 border-gray-700 text-gray-500'
                } else if (selected === i) {
                  btnClass += 'bg-indigo-900/40 border-indigo-500 text-indigo-200'
                } else {
                  btnClass += 'bg-gray-800/40 border-sheryians-border text-gray-300 hover:border-indigo-500 hover:bg-indigo-900/20'
                }
                return (
                  <button key={i} className={btnClass} onClick={() => handleAnswer(i)} disabled={!!result}>
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                )
              })}
            </div>

            {result && (
              <div className={`p-3 rounded-lg border text-sm mb-3 ${result.correct
                ? 'bg-green-900/20 border-green-700/40 text-green-300'
                : 'bg-red-900/20 border-red-700/40 text-red-300'}`}>
                <p className="font-medium mb-1">{result.correct ? '✅ Sahi jawab!' : '❌ Galat jawab'}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{quizItem.explanation}</p>
                <p className="text-xs mt-2 opacity-80">{result.feedback}</p>
              </div>
            )}

            {result && (
              <div className="flex gap-2">
                <button
                  onClick={generateQuiz}
                  className="flex-1 bg-sheryians-orange hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Next Question →
                </button>
              </div>
            )}

            {completedCount >= 3 && (
              <div className="mt-3 p-3 bg-indigo-900/20 border border-indigo-700/40 rounded-lg text-center">
                <p className="text-indigo-300 text-sm font-medium">
                  🏆 Ek baar aur! Placement ke liye ready ho rahe ho!
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">No quiz items available</p>
        )}
      </div>
    </div>
  )
}