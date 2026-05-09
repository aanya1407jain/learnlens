import { useEffect, useRef } from 'react'
import useStudentStore from '../store/studentStore'

const API_BASE = 'http://localhost:8000'
const POLL_INTERVAL = 60000 // 60 seconds

export function usePrereqPoller() {
  const timerRef = useRef(null)
  const currentTimestamp = useStudentStore((s) => s.currentTimestamp)
  const watchedConcepts = useStudentStore((s) => s.watchedConcepts)
  const student = useStudentStore((s) => s.student)
  const isAlertDismissed = useStudentStore((s) => s.isAlertDismissed)
  const setActivePrereqGap = useStudentStore((s) => s.setActivePrereqGap)
  const activePrereqGap = useStudentStore((s) => s.activePrereqGap)

  const checkPrereqs = async () => {
    if (activePrereqGap) return // Already showing an alert

    try {
      const res = await fetch(`${API_BASE}/prereq-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_timestamp_sec: currentTimestamp,
          student_id: student.id,
          batch_id: student.batchId,
          watched_concepts: watchedConcepts,
        }),
      })
      const data = await res.json()

      if (data.gap_detected && data.missing_concept) {
        if (!isAlertDismissed(data.missing_concept)) {
          setActivePrereqGap(data)
        }
      }
    } catch (err) {
      console.error('Prereq check failed:', err)
    }
  }

  useEffect(() => {
    // Initial check after 15s (for demo)
    const initialTimer = setTimeout(checkPrereqs, 15000)

    timerRef.current = setInterval(checkPrereqs, POLL_INTERVAL)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(timerRef.current)
    }
  }, [currentTimestamp, watchedConcepts])

  return { checkPrereqs }
}