import { useRef, useState, useEffect, useCallback } from 'react'
import useStudentStore from '../store/studentStore'
import { useVideoEvents } from '../hooks/useVideoEvents'

const DEMO_DURATION = 900 // 15 minutes demo

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function HeatmapScrubber({ duration, confusionBuckets, currentTime, onSeek, onBucketClick }) {
  const totalBuckets = Math.ceil(duration / 5)
  const bucketArr = Array.from({ length: totalBuckets }, (_, i) => i * 5)

  return (
    <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden cursor-pointer group"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const pct = (e.clientX - rect.left) / rect.width
        onSeek(pct * duration)
      }}
    >
      {/* Heatmap segments */}
      {bucketArr.map((bucket) => {
        const count = confusionBuckets[bucket] || 0
        let color = 'transparent'
        let opacity = 0
        if (count >= 6) { color = '#E24B4A'; opacity = 0.75 }
        else if (count >= 3) { color = '#BA7517'; opacity = 0.60 }
        else if (count >= 1) { color = '#1D9E75'; opacity = 0.40 }

        const left = (bucket / duration) * 100
        const width = (5 / duration) * 100

        return (
          <div
            key={bucket}
            className="absolute top-0 h-full hover:opacity-100 transition-opacity"
            style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color, opacity }}
            onClick={(e) => {
              e.stopPropagation()
              if (count > 0) onBucketClick(bucket)
            }}
            title={count > 0 ? `${count} rewinds at ${formatTime(bucket)}` : ''}
          />
        )
      })}

      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 h-full bg-sheryians-orange opacity-60 pointer-events-none"
        style={{ width: `${(currentTime / duration) * 100}%` }}
      />

      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-sheryians-orange rounded-full shadow-lg pointer-events-none"
        style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
      />
    </div>
  )
}

export default function VideoPlayer() {
  const videoRef = useRef(null)
  const seekBeforeRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [showControls, setShowControls] = useState(true)

  const confusionBuckets = useStudentStore((s) => s.confusionBuckets)
  const setAutoChatPrompt = useStudentStore((s) => s.setAutoChatPrompt)
  const { onTimeUpdate, onSeeked } = useVideoEvents()

  // Demo video — use a free sample; in production this would be real lecture URL
  const VIDEO_SRC = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    const t = videoRef.current.currentTime
    setCurrentTime(t)
    onTimeUpdate(t)
  }, [onTimeUpdate])

  const handleSeeking = useCallback(() => {
    if (videoRef.current) {
      seekBeforeRef.current = currentTime
    }
  }, [currentTime])

  const handleSeeked = useCallback(() => {
    if (videoRef.current) {
      onSeeked(videoRef.current.currentTime, seekBeforeRef.current)
    }
  }, [onSeeked])

  const seek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }, [])

  const handleBucketClick = useCallback((bucket) => {
    seek(bucket)
    setAutoChatPrompt(`Explain what was discussed at ${formatTime(bucket)} in the lecture`)
  }, [seek, setAutoChatPrompt])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) videoRef.current.pause()
    else videoRef.current.play()
    setIsPlaying(!isPlaying)
  }

  // Demo: simulate being at 10:00 mark for BST deletion
  useEffect(() => {
    const timer = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 600
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
      {/* Video */}
      <div className="relative aspect-video bg-gray-900 group"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={VIDEO_SRC}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onSeeked={handleSeeked}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          crossOrigin="anonymous"
        />

        {/* Overlay label */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-sheryians-orange text-white text-xs font-bold px-2 py-1 rounded-full">
            LIVE LECTURE
          </span>
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            BST Deletion — Week 7
          </span>
        </div>

        {/* Click to play/pause */}
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          {!isPlaying && (
            <div className="bg-black/50 rounded-full p-5">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 px-4 pt-2 pb-3 space-y-2">
        <HeatmapScrubber
          duration={DEMO_DURATION}
          confusionBuckets={confusionBuckets}
          currentTime={currentTime}
          onSeek={seek}
          onBucketClick={handleBucketClick}
        />

        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-sheryians-orange transition-colors">
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button onClick={() => seek(Math.max(0, currentTime - 10))}
              className="text-gray-400 hover:text-white transition-colors text-xs">⟪ 10s</button>
            <span className="text-white font-mono text-sm">{formatTime(currentTime)}</span>
            <span className="text-gray-500">/</span>
            <span className="font-mono text-sm">{formatTime(DEMO_DURATION)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {Object.values(confusionBuckets).some(v => v > 0) && (
              <span className="text-red-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Confusion detected — click red segments
              </span>
            )}
          </div>
        </div>

        {/* Heatmap legend */}
        <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
          <span>Confusion heatmap:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 opacity-70" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600 opacity-70" /> Medium</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 opacity-75" /> High (click!)</span>
        </div>
      </div>
    </div>
  )
}