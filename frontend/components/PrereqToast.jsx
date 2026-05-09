import { useState } from 'react'
import useStudentStore from '../store/studentStore'
import CatchupCard from './CatchupCard'

export default function PrereqToast() {
  const activePrereqGap = useStudentStore((s) => s.activePrereqGap)
  const clearPrereqGap = useStudentStore((s) => s.clearPrereqGap)
  const dismissAlert = useStudentStore((s) => s.dismissAlert)
  const student = useStudentStore((s) => s.student)
  const [showCatchup, setShowCatchup] = useState(false)

  if (!activePrereqGap) return null

  const isHinglish = student.languagePref === 'hinglish'
  const message = isHinglish ? activePrereqGap.message_hi : activePrereqGap.message_en

  const handleSkip = () => {
    dismissAlert(activePrereqGap.missing_concept)
    clearPrereqGap()
  }

  const handleCatchup = () => {
    setShowCatchup(true)
  }

  return (
    <>
      {showCatchup ? (
        <CatchupCard
          concept={activePrereqGap.missing_concept}
          weekNumber={activePrereqGap.week_number}
          onDone={() => {
            setShowCatchup(false)
            dismissAlert(activePrereqGap.missing_concept)
            clearPrereqGap()
          }}
          onSnooze={() => {
            setShowCatchup(false)
            clearPrereqGap()
          }}
        />
      ) : (
        <div className="mx-0 mb-3 animate-in slide-in-from-top duration-300">
          <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center text-lg">
                ⚠️
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-400 font-semibold text-sm">Prerequisite Gap Detected!</span>
                  <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
                    Week {activePrereqGap.week_number} concept
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activePrereqGap.severity === 'high'
                      ? 'bg-red-900/50 text-red-400 border border-red-700/30'
                      : 'bg-amber-900/50 text-amber-400 border border-amber-700/30'
                  }`}>
                    {activePrereqGap.severity} priority
                  </span>
                </div>
                <p className="text-amber-200 text-sm leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 ml-11">
              <button
                onClick={handleCatchup}
                className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                ⚡ 30 Second Catch-up
              </button>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-gray-200 text-sm px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Skip karo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}