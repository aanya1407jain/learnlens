import { useState, useCallback } from 'react'
import useStudentStore from '../store/studentStore'

const API_BASE = 'http://localhost:8000'

export function useStreamingAI() {
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState('')
  const [concepts, setConcepts] = useState([])
  const addMentionedConcepts = useStudentStore((s) => s.addMentionedConcepts)

  const streamAsk = useCallback(async ({ question, mode, timestamp, history, onToken, onDone, onConcepts }) => {
    setStreaming(true)
    setText('')
    setConcepts([])

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          mode,
          current_timestamp_sec: timestamp,
          conversation_history: history || [],
          student_id: 'student_001',
          batch_id: 'DSA-Cohort-7',
        }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'token') {
              fullText += event.text
              setText(fullText)
              onToken?.(event.text, fullText)
            } else if (event.type === 'concepts') {
              setConcepts(event.tags)
              addMentionedConcepts(event.tags)
              onConcepts?.(event.tags)
            } else if (event.type === 'done') {
              onDone?.(fullText)
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Streaming error:', err)
    } finally {
      setStreaming(false)
    }
  }, [addMentionedConcepts])

  const streamCatchup = useCallback(async ({ conceptName, onToken, onDone }) => {
    setStreaming(true)
    setText('')

    try {
      const response = await fetch(`${API_BASE}/catchup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept_name: conceptName, language_pref: 'hinglish', student_id: 'student_001' }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'token') {
              fullText += event.text
              setText(fullText)
              onToken?.(event.text, fullText)
            } else if (event.type === 'done') {
              onDone?.(fullText)
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Catchup streaming error:', err)
    } finally {
      setStreaming(false)
    }
  }, [])

  return { streaming, text, concepts, streamAsk, streamCatchup }
}