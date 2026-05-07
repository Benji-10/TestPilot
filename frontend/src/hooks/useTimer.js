import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer({ durationSeconds, onExpire, autoSubmit }) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const [paused, setPaused] = useState(false)
  const [expired, setExpired] = useState(false)
  const intervalRef = useRef(null)
  const timeLeftRef = useRef(durationSeconds)

  useEffect(() => {
    timeLeftRef.current = timeLeft
  }, [timeLeft])

  useEffect(() => {
    if (paused || expired) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setExpired(true)
          if (autoSubmit) onExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [paused, expired])

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])
  const reset = useCallback((secs) => {
    setTimeLeft(secs ?? durationSeconds)
    setExpired(false)
    setPaused(false)
  }, [durationSeconds])

  // Persist timer state on page hide
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pause])

  const pct = durationSeconds ? (timeLeft / durationSeconds) * 100 : 0

  return { timeLeft, paused, expired, pct, pause, resume, reset }
}
