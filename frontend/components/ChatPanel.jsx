import { useState, useEffect, useRef } from 'react'
import useStudentStore from '../store/studentStore'
import { useStreamingAI } from '../hooks/useStreamingAI'

const MODES = [
  { id: 'answer', label: 'Answer', icon: '💡', desc: 'Direct answer from lecture' },
  { id: 'socratic', label: 'Socratic', icon: '🤔', desc: 'Guided questions to find answer' },
  { id: 'summary', label: 'Summary', icon: '📝', desc: 'Summarize last 5 minutes' },
  { id: 'interview', label: 'Interview', icon: '🎯', desc: 'FAANG-style interview prep', badge: 'Placement Prep' },
]

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const scoreMatch = msg.content?.match(/Score:\s*(\d+)\/10/)
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
        ${isUser ? 'bg-sheryians-orange text-white' : 'bg-indigo-600 text-white'}`}>
        {isUser ? 'A' : 'AI'}
      </div>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {score !== null && (
          <div className={`text-xs font-bold px-2 py-1 rounded-full self-start
            ${score >= 8 ? 'bg-green-900 text-green-300' : score >= 5 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'}`}>
            Score: {score}/10
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-sheryians-orange text-white rounded-tr-sm'
            : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
          {msg.content}
        </div>
        {msg.concepts && msg.concepts.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {msg.concepts.map(c => (
              <span key={c} className="text-xs bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/40">
                #{c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPanel() {
  const [mode, setMode] = useState('answer')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Namaste! 🙏 Main LearnLens hun — Sheryians ka AI tutor. BST ke baare mein kuch poochho, ya Interview mode try karo placement prep ke liye!', concepts: [] }
  ])
  const [isThinking, setIsThinking] = useState(false)
  const [interviewTimer, setInterviewTimer] = useState(null)
  const [timerSec, setTimerSec] = useState(120)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const currentTimestamp = useStudentStore((s) => s.currentTimestamp)
  const autoChatPrompt = useStudentStore((s) => s.autoChatPrompt)
  const setAutoChatPrompt = useStudentStore((s) => s.setAutoChatPrompt)
  const interviewScores = useStudentStore((s) => s.interviewScores)
  const addInterviewScore = useStudentStore((s) => s.addInterviewScore)
  const setBatchDoubt = useStudentStore((s) => s.setBatchDoubt)

  const { streaming, streamAsk } = useStreamingAI()

  // Auto-fill from heatmap click
  useEffect(() => {
    if (autoChatPrompt) {
      setInput(autoChatPrompt)
      setAutoChatPrompt('')
      inputRef.current?.focus()
    }
  }, [autoChatPrompt, setAutoChatPrompt])

  // Interview timer
  useEffect(() => {
    if (mode === 'interview') {
      setTimerSec(120)
      timerRef.current = setInterval(() => {
        setTimerSec(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [mode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const detectLanguage = (text) => {
    const hindiChars = /[\u0900-\u097F]/
    const hinglishWords = ['bhai', 'kya', 'kaise', 'mein', 'hai', 'aur', 'yeh', 'woh', 'tha', 'ko', 'se', 'ka', 'ki', 'ke']
    if (hindiChars.test(text)) return 'hinglish'
    const lowerText = text.toLowerCase()
    if (hinglishWords.some(w => lowerText.includes(w))) return 'hinglish'
    return 'english'
  }

  const checkBatchDoubt = async (question) => {
    try {
      const res = await fetch('http://localhost:8000/doubts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, student_id: 'student_001', batch_id: 'DSA-Cohort-7' })
      })
      const data = await res.json()
      if (data.similar_found) setBatchDoubt(data)
    } catch {}
  }

  const send = async () => {
    const q = input.trim()
    if (!q || streaming) return
    setInput('')

    const userMsg = { role: 'user', content: q }
    const lang = detectLanguage(q)
    setMessages(prev => [...prev, userMsg])
    setIsThinking(true)

    // Check batch doubts in background
    checkBatchDoubt(q)

    const history = messages.map(m => ({ role: m.role, content: m.content }))

    let assistantMsg = { role: 'assistant', content: '', concepts: [], lang }
    setMessages(prev => [...prev, assistantMsg])
    setIsThinking(false)

    await streamAsk({
      question: q,
      mode,
      timestamp: currentTimestamp,
      history,
      onToken: (_, full) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: full.replace(/\[CONCEPT:[^\]]+\]/g, '').trim(),
            lang
          }
          return updated
        })
      },
      onConcepts: (tags) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], concepts: tags }
          return updated
        })

        // Extract interview score
        if (mode === 'interview') {
          const scoreMatch = messages[messages.length - 1]?.content?.match(/Score:\s*(\d+)\/10/)
          if (scoreMatch) addInterviewScore(parseInt(scoreMatch[1]))
        }
      }
    })
  }

  const avgScore = interviewScores.length > 0
    ? (interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length).toFixed(1)
    : null

  return (
    <div className="flex flex-col h-full bg-sheryians-card rounded-xl border border-sheryians-border overflow-hidden">
      {/* Mode tabs */}
      <div className="flex border-b border-sheryians-border bg-gray-900/50">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 py-2.5 px-1 text-xs font-medium flex flex-col items-center gap-0.5 transition-all relative
              ${mode === m.id
                ? m.id === 'interview'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-sheryians-orange border-b-2 border-sheryians-orange'
                : 'text-gray-500 hover:text-gray-300'}`}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
            {m.badge && mode === m.id && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1 rounded-full">
                PP
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Interview timer */}
      {mode === 'interview' && (
        <div className="px-4 py-2 bg-amber-900/20 border-b border-amber-800/30 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-medium">🎯 Interview Mode — Answer like a FAANG interview</span>
          <span className={`font-mono text-sm font-bold ${timerSec < 30 ? 'text-red-400' : 'text-amber-400'}`}>
            {Math.floor(timerSec / 60)}:{(timerSec % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Interview session summary */}
      {mode === 'interview' && interviewScores.length >= 3 && (
        <div className="px-4 py-2 bg-indigo-900/20 border-b border-indigo-800/30 flex items-center justify-between">
          <span className="text-indigo-300 text-xs">Session avg: <strong>{avgScore}/10</strong></span>
          <button
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded transition-colors"
            onClick={() => {
              const text = `Just scored ${avgScore}/10 on a BST interview simulation on LearnLens built for @SheryiansCodingSchool! 🚀 #DSA #PlacementPrep`
              navigator.clipboard.writeText(text)
              alert('LinkedIn post copied to clipboard!')
            }}
          >
            Share on LinkedIn
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {isThinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm text-white font-bold">AI</div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-sheryians-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={mode === 'interview' ? 'Answer the interview question...' : 'BST ke baare mein kuch poochho...'}
            className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm border border-sheryians-border focus:outline-none focus:border-sheryians-orange transition-colors"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="bg-sheryians-orange hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1"
          >
            {streaming ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : '➤'}
          </button>
        </div>
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className="text-xs text-gray-600">{MODES.find(m => m.id === mode)?.desc}</span>
          <span className="text-xs text-indigo-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Responding in Hinglish
          </span>
        </div>
      </div>
    </div>
  )
}