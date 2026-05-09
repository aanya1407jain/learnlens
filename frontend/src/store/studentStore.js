import { create } from 'zustand'

const useStudentStore = create((set, get) => ({
  // Student info
  student: {
    id: 'student_001',
    name: 'Aanya',
    batchId: 'DSA-Cohort-7',
    lectureId: 'lecture_007',
    languagePref: 'hinglish',
  },

  // Video state
  currentTimestamp: 0,
  setCurrentTimestamp: (t) => set({ currentTimestamp: t }),

  // Confusion heatmap: bucket_5s -> count
  confusionBuckets: {},
  addConfusionEvent: (timestampSec) => {
    const bucket = Math.floor(timestampSec / 5) * 5
    set((state) => ({
      confusionBuckets: {
        ...state.confusionBuckets,
        [bucket]: (state.confusionBuckets[bucket] || 0) + 1,
      },
    }))
  },

  // Mastery / concepts
  masteredConcepts: new Set(['Arrays', 'Time Complexity', 'Big-O Notation', 'BST Basics', 'BST Insert']),
  watchedConcepts: ['Arrays', 'Time Complexity', 'Big-O Notation', 'BST Basics', 'BST Insert'],
  addWatchedConcept: (concept) =>
    set((state) => ({
      watchedConcepts: [...new Set([...state.watchedConcepts, concept])],
      masteredConcepts: new Set([...state.masteredConcepts, concept]),
    })),

  // Concept tags from AI responses
  mentionedConcepts: [],
  addMentionedConcepts: (tags) =>
    set((state) => ({
      mentionedConcepts: [...new Set([...state.mentionedConcepts, ...tags])],
    })),

  // Prereq alerts - dismissed per session
  dismissedAlerts: new Set(),
  dismissAlert: (concept) =>
    set((state) => ({
      dismissedAlerts: new Set([...state.dismissedAlerts, concept]),
    })),
  isAlertDismissed: (concept) => get().dismissedAlerts.has(concept),

  // Active prereq gap
  activePrereqGap: null,
  setActivePrereqGap: (gap) => set({ activePrereqGap: gap }),
  clearPrereqGap: () => set({ activePrereqGap: null }),

  // Chat history
  chatHistory: [],
  addChatMessage: (msg) =>
    set((state) => ({ chatHistory: [...state.chatHistory, msg] })),

  // Interview mode session
  interviewScores: [],
  addInterviewScore: (score) =>
    set((state) => ({ interviewScores: [...state.interviewScores, score] })),

  // Batch doubt thread
  batchDoubt: null,
  setBatchDoubt: (doubt) => set({ batchDoubt: doubt }),
  clearBatchDoubt: () => set({ batchDoubt: null }),

  // Knowledge graph data
  graphData: null,
  setGraphData: (data) => set({ graphData: data }),

  // Auto chat prompt (from heatmap click)
  autoChatPrompt: '',
  setAutoChatPrompt: (prompt) => set({ autoChatPrompt: prompt }),
}))

export default useStudentStore