import { useEffect, useState } from 'react'
import VideoPlayer from './components/VideoPlayer'
import ChatPanel from './components/ChatPanel'
import KnowledgeGraph from './components/KnowledgeGraph'
import MasteryTracker from './components/MasteryTracker'
import SpacedQuiz from './components/SpacedQuiz'
import PrereqToast from './components/PrereqToast'
import CatchupCard from './components/CatchupCard'
import BatchDoubtThread from './components/BatchDoubtThread'
import MentorDashboard from './components/MentorDashboard'
import useStudentStore from './store/studentStore'
import { usePrereqPoller } from './hooks/usePrereqPoller'

const API_BASE = 'http://localhost:8000'

export default function App() {
  const [activeTab, setActiveTab] = useState('learn')  // 'learn' | 'quiz' | 'mentor'
  const [showCatchup, setShowCatchup] = useState(false)
  const [catchupConcept, setCatchupConcept] = useState('')

  const student = useStudentStore((s) => s.student)
  const activePrereqGap = useStudentStore((s) => s.activePrereqGap)
  const clearPrereqGap = useStudentStore((s) => s.clearPrereqGap)
  const dismissAlert = useStudentStore((s) => s.dismissAlert)
  const batchDoubt = useStudentStore((s) => s.batchDoubt)

  // Start prereq polling
  usePrereqPoller()

  // Load knowledge graph on mount
  const setGraphData = useStudentStore((s) => s.setGraphData)
  useEffect(() => {
    fetch(`${API_BASE}/graph?student_id=${student.id}`)
      .then(r => r.json())
      .then(data => setGraphData(data))
      .catch(() => {})
  }, [student.id, setGraphData])

  const handleCatchupOpen = (concept) => {
    setCatchupConcept(concept)
    setShowCatchup(true)
    clearPrereqGap()
    dismissAlert(concept)
  }

  const handleCatchupClose = () => {
    setShowCatchup(false)
    setCatchupConcept('')
  }

  return (
    <div className="min-h-screen bg-sheryians-dark text-white font-sans">
      {/* Header */}
      <header className="bg-sheryians-card border-b border-sheryians-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sheryians-orange rounded-lg flex items-center justify-center text-white font-bold text-sm">
            LL
          </div>
          <div>
            <span className="font-bold text-white text-lg">LearnLens</span>
            <span className="text-gray-400 text-sm ml-2">by Sheryians</span>
          </div>
          <span className="hidden md:block bg-sheryians-border text-gray-300 text-xs px-2 py-0.5 rounded-full ml-2">
            DSA Domination — Week 7
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Nav tabs */}
          <nav className="flex gap-1 bg-sheryians-dark rounded-lg p-1">
            {[
              { key: 'learn', label: '🎓 Learn' },
              { key: 'quiz',  label: '⚡ Quiz' },
              { key: 'mentor', label: '📊 Mentor' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-sheryians-orange text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Student badge */}
          <div className="flex items-center gap-2 bg-sheryians-dark rounded-full px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-sheryians-orange flex items-center justify-center text-xs font-bold">
              {student.name[0]}
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{student.name}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 lg:p-6 max-w-screen-2xl mx-auto">

        {/* LEARN TAB */}
        {activeTab === 'learn' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
            {/* Left column: Video + Mastery */}
            <div className="xl:col-span-2 flex flex-col gap-4">
              <VideoPlayer />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MasteryTracker />
                <KnowledgeGraph />
              </div>
            </div>

            {/* Right column: Chat */}
            <div className="xl:col-span-1 flex flex-col gap-4">
              <ChatPanel />
              {batchDoubt && <BatchDoubtThread />}
            </div>
          </div>
        )}

        {/* QUIZ TAB */}
        {activeTab === 'quiz' && (
          <div className="max-w-2xl mx-auto">
            <SpacedQuiz />
          </div>
        )}

        {/* MENTOR TAB */}
        {activeTab === 'mentor' && (
          <MentorDashboard />
        )}
      </main>

      {/* Floating overlays */}
      {activePrereqGap?.gap_detected && (
        <PrereqToast
          gap={activePrereqGap}
          onCatchup={() => handleCatchupOpen(activePrereqGap.missing_concept)}
          onDismiss={() => {
            dismissAlert(activePrereqGap.missing_concept)
            clearPrereqGap()
          }}
        />
      )}

      {showCatchup && (
        <CatchupCard
          conceptName={catchupConcept}
          onClose={handleCatchupClose}
        />
      )}
    </div>
  )
}