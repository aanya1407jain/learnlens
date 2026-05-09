import { useRef, useCallback } from 'react'
import useStudentStore from '../store/studentStore'

const API_BASE = 'http://localhost:8000'

export function useVideoEvents() {
  const prevTimeRef = useRef(0)
  const pendingEventsRef = useRef([])
  const flushTimerRef = useRef(null)
  const addConfusionEvent = useStudentStore((s) => s.addConfusionEvent)
  const student = useStudentStore((s) => s.student)
  const setCurrentTimestamp = useStudentStore((s) => s.setCurrentTimestamp)

  const flushEvents = useCallback(async () => {
    if (pendingEventsRef.current.length === 0) return
    const events = [...pendingEventsRef.current]
    pendingEventsRef.current = []

    for (const ts of events) {
      try {
        await fetch(`${API_BASE}/mentor/confusion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: student.id,
            batch_id: student.batchId,
            lecture_id: student.lectureId,
            timestamp_sec: ts,
          }),
        })
      } catch {}
    }
  }, [student])

  const onTimeUpdate = useCallback((currentTime) => {
    setCurrentTimestamp(Math.floor(currentTime))

    // Detect rewind: current < previous - 2
    if (prevTimeRef.current > 0 && currentTime < prevTimeRef.current - 2) {
      const ts = Math.floor(prevTimeRef.current)
      addConfusionEvent(ts)
      pendingEventsRef.current.push(ts)

      // Debounce flush
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = setTimeout(flushEvents, 30000)
    }

    prevTimeRef.current = currentTime
  }, [addConfusionEvent, flushEvents, setCurrentTimestamp])

  const onSeeked = useCallback((currentTime, previousTime) => {
    if (previousTime > 0 && currentTime < previousTime - 2) {
      const ts = Math.floor(previousTime)
      addConfusionEvent(ts)
      pendingEventsRef.current.push(ts)
    }
  }, [addConfusionEvent])

  return { onTimeUpdate, onSeeked }
}