/**
 * Advanced Audio Recorder Component
 * 
 * This component provides a comprehensive audio recording experience with:
 * - Real-time waveform visualization
 * - Voice activity detection and auto-stop
 * - Audio quality monitoring and feedback
 * - Modern, accessible UI with animations
 * - Multiple recording modes and settings
 * 
 * Author: AI Assistant
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Settings, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'

// ====================== TYPES AND INTERFACES ======================

interface AudioRecorderProps {
  /** Callback when recording starts */
  onRecordingStart?: () => void
  /** Callback when recording stops with audio data and analytics */
  onRecordingStop?: (audioBlob: Blob, analytics: AudioAnalytics) => void
  /** Callback for real-time audio level updates */
  onAudioLevel?: (level: number) => void
  /** Recording configuration */
  config?: AudioConfig
  /** Whether the recorder is disabled */
  disabled?: boolean
  /** Visual theme */
  theme?: 'light' | 'dark'
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
  /** Additional CSS classes */
  className?: string
}

interface AudioConfig {
  maxDuration: number        // Maximum recording duration in seconds
  enableVAD: boolean        // Voice Activity Detection
  silenceThreshold: number  // Threshold for silence detection (0-1)
  silenceDuration: number   // Silence duration before auto-stop (seconds)
  autoGain: boolean         // Enable automatic gain control
  noiseSuppression: boolean // Enable noise suppression
  sampleRate: number        // Audio sample rate
  showWaveform: boolean     // Show real-time waveform
  showTimer: boolean        // Show recording timer
  showQualityMeter: boolean // Show audio quality indicators
}

interface AudioAnalytics {
  duration: number
  averageLevel: number
  maxLevel: number
  silenceRatio: number
  qualityScore: number
  voiceActivityRatio: number
}

interface AudioVisualizationData {
  levels: number[]
  peaks: number[]
  frequency: number[]
}

// ====================== DEFAULT CONFIGURATION ======================

const DEFAULT_CONFIG: AudioConfig = {
  maxDuration: 300,         // 5 minutes
  enableVAD: true,
  silenceThreshold: 0.03,
  silenceDuration: 3,
  autoGain: true,
  noiseSuppression: true,
  sampleRate: 44100,
  showWaveform: true,
  showTimer: true,
  showQualityMeter: true
}

// ====================== MAIN COMPONENT ======================

function AudioRecorder({
  onRecordingStart,
  onRecordingStop,
  onAudioLevel,
  config = DEFAULT_CONFIG,
  disabled = false,
  theme = 'light',
  size = 'medium',
  className = ''
}: AudioRecorderProps) {
  
  // ====================== STATE MANAGEMENT ======================
  
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [isPlayingBack, setIsPlayingBack] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [qualityIndicators, setQualityIndicators] = useState({
    volume: 'good' as 'poor' | 'fair' | 'good' | 'excellent',
    noise: 'low' as 'low' | 'medium' | 'high',
    clarity: 'good' as 'poor' | 'fair' | 'good' | 'excellent'
  })
  
  // ====================== REFS ======================
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const animationRef = useRef<number | null>(null)
  const playbackRef = useRef<HTMLAudioElement | null>(null)
  
  // Audio analysis refs
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const frequencyDataRef = useRef<Uint8Array | null>(null)
  const levelHistoryRef = useRef<number[]>([])
  const silenceCountRef = useRef(0)
  
  // ====================== COMPUTED VALUES ======================
  
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])
  
  const canRecord = useMemo(() => {
    return hasPermission && !disabled && !isRecording
  }, [hasPermission, disabled, isRecording])
  
  const canClickButton = useMemo(() => {
    // Allow clicking to request permissions or to control recording
    return !disabled && (!isRecording || hasPermission)
  }, [disabled, isRecording, hasPermission])
  
  const canPlayback = useMemo(() => {
    return recordedBlob && !isRecording && !isPlayingBack
  }, [recordedBlob, isRecording, isPlayingBack])
  
  const recordingProgress = useMemo(() => {
    return Math.min((duration / mergedConfig.maxDuration) * 100, 100)
  }, [duration, mergedConfig.maxDuration])
  
  // ====================== AUDIO INITIALIZATION ======================
  
  const initializeAudio = useCallback(async (): Promise<MediaStream> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: mergedConfig.noiseSuppression,
          autoGainControl: mergedConfig.autoGain,
          sampleRate: mergedConfig.sampleRate,
          channelCount: 1
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setHasPermission(true)
      
      // Initialize audio context for analysis
      if (mergedConfig.showWaveform || mergedConfig.enableVAD) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        
        const analyser = audioContext.createAnalyser()
        const source = audioContext.createMediaStreamSource(stream)
        
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        
        audioContextRef.current = audioContext
        analyserRef.current = analyser
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
        frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount)
      }
      
      return stream
    } catch (error) {
      console.error('Failed to initialize audio:', error)
      setHasPermission(false)
      throw error
    }
  }, [mergedConfig])
  
  // ====================== AUDIO ANALYSIS ======================
  
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !frequencyDataRef.current) {
      return { level: 0, frequency: 0, quality: 0.5 }
    }
    
    // Get time domain data for level analysis
    analyserRef.current.getByteTimeDomainData(dataArrayRef.current)
    
    // Calculate RMS level
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const value = (dataArrayRef.current[i] - 128) / 128
      sum += value * value
    }
    const rmsLevel = Math.sqrt(sum / dataArrayRef.current.length)
    
    // Get frequency data for quality analysis
    analyserRef.current.getByteFrequencyData(frequencyDataRef.current)
    
    // Calculate frequency distribution for quality metrics
    const lowFreq = frequencyDataRef.current.slice(0, 85).reduce((a, b) => a + b, 0) / 85
    const midFreq = frequencyDataRef.current.slice(85, 255).reduce((a, b) => a + b, 0) / 170
    const highFreq = frequencyDataRef.current.slice(255).reduce((a, b) => a + b, 0) / (frequencyDataRef.current.length - 255)
    
    // Quality score based on frequency balance
    const qualityScore = Math.min(1.0, (midFreq / 128) * 0.6 + (lowFreq / 128) * 0.2 + (highFreq / 128) * 0.2)
    
    return {
      level: rmsLevel,
      frequency: midFreq / 255,
      quality: qualityScore
    }
  }, [])
  
  const updateQualityIndicators = useCallback((analysis: ReturnType<typeof analyzeAudio>) => {
    // Update volume indicator
    let volumeQuality: typeof qualityIndicators.volume = 'good'
    if (analysis.level < 0.1) volumeQuality = 'poor'
    else if (analysis.level < 0.3) volumeQuality = 'fair'
    else if (analysis.level > 0.8) volumeQuality = 'excellent'
    
    // Update noise indicator (simplified)
    let noiseLevel: typeof qualityIndicators.noise = 'low'
    if (analysis.quality < 0.3) noiseLevel = 'high'
    else if (analysis.quality < 0.6) noiseLevel = 'medium'
    
    // Update clarity indicator
    let clarityLevel: typeof qualityIndicators.clarity = 'good'
    if (analysis.quality < 0.4) clarityLevel = 'poor'
    else if (analysis.quality < 0.6) clarityLevel = 'fair'
    else if (analysis.quality > 0.8) clarityLevel = 'excellent'
    
    setQualityIndicators({
      volume: volumeQuality,
      noise: noiseLevel,
      clarity: clarityLevel
    })
  }, [])
  
  // ====================== AUDIO MONITORING ======================
  
  const monitorAudio = useCallback(() => {
    if (!isRecording || isPaused) return
    
    const analysis = analyzeAudio()
    setAudioLevel(analysis.level)
    onAudioLevel?.(analysis.level)
    
    // Store level history for analytics
    levelHistoryRef.current.push(analysis.level)
    if (levelHistoryRef.current.length > 100) {
      levelHistoryRef.current.shift()
    }
    
    // Update quality indicators
    updateQualityIndicators(analysis)
    
    // Voice Activity Detection
    if (mergedConfig.enableVAD) {
      if (analysis.level < mergedConfig.silenceThreshold) {
        silenceCountRef.current++
        
        if (silenceCountRef.current >= mergedConfig.silenceDuration * 10) { // 10 calls per second
          console.log('Auto-stopping due to silence')
          stopRecording()
          return
        }
      } else {
        silenceCountRef.current = 0
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      }
    }
    
    animationRef.current = requestAnimationFrame(monitorAudio)
  }, [isRecording, isPaused, analyzeAudio, onAudioLevel, updateQualityIndicators, mergedConfig])
  
  // ====================== RECORDING CONTROLS ======================
  


  const startRecording = useCallback(async () => {
    try {
      let stream = streamRef.current
      if (!stream) {
        stream = await initializeAudio()
      }
      
      // Check MediaRecorder support
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg'
      ]
      
      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('No supported audio format available')
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType })
      chunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedMimeType })
        setRecordedBlob(blob)
        
        // Calculate analytics
        const analytics: AudioAnalytics = {
          duration,
          averageLevel: levelHistoryRef.current.reduce((a, b) => a + b, 0) / levelHistoryRef.current.length || 0,
          maxLevel: Math.max(...levelHistoryRef.current, 0),
          silenceRatio: levelHistoryRef.current.filter(l => l < mergedConfig.silenceThreshold).length / levelHistoryRef.current.length,
          qualityScore: levelHistoryRef.current.length > 0 ? 0.8 : 0.5, // Simplified
          voiceActivityRatio: 1 - (levelHistoryRef.current.filter(l => l < mergedConfig.silenceThreshold).length / levelHistoryRef.current.length)
        }
        
        onRecordingStop?.(blob, analytics)
      }
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        stopRecording()
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms
      
      setIsRecording(true)
      setIsPaused(false)
      setDuration(0)
      levelHistoryRef.current = []
      silenceCountRef.current = 0
      
      // Start monitoring
      monitorAudio()
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1
          if (newDuration >= mergedConfig.maxDuration) {
            stopRecording()
          }
          return newDuration
        })
      }, 1000)
      
      onRecordingStart?.()
      
    } catch (error) {
      console.error('Failed to start recording:', error)
      setHasPermission(false)
    }
  }, [initializeAudio, duration, mergedConfig, monitorAudio, onRecordingStart, onRecordingStop])
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    setIsRecording(false)
    setIsPaused(false)
    setAudioLevel(0)
    silenceCountRef.current = 0
    
    // Clear timers and animation
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])
  
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [])
  
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      monitorAudio()
    }
  }, [monitorAudio])
  
  const resetRecording = useCallback(() => {
    stopRecording()
    setRecordedBlob(null)
    setDuration(0)
    levelHistoryRef.current = []
  }, [stopRecording])

  // ====================== BUTTON CLICK HANDLER ======================

  const handleButtonClick = useCallback(async () => {
    // If currently recording, handle pause/resume
    if (isRecording) {
      if (isPaused) {
        resumeRecording()
      } else {
        pauseRecording()
      }
      return
    }

    // If no permission yet, request it first
    if (hasPermission === null || hasPermission === false) {
      try {
        await initializeAudio()
        // After getting permission, user needs to click again to start recording
        return
      } catch (error) {
        console.error('Failed to get microphone permission:', error)
        return
      }
    }

    // If we have permission, start recording
    if (hasPermission && !isRecording) {
      await startRecording()
    }
  }, [isRecording, isPaused, hasPermission, resumeRecording, pauseRecording, initializeAudio, startRecording])
  
  // ====================== PLAYBACK CONTROLS ======================
  
  const playRecording = useCallback(() => {
    if (!recordedBlob) return
    
    const audioUrl = URL.createObjectURL(recordedBlob)
    const audio = new Audio(audioUrl)
    
    audio.onplay = () => setIsPlayingBack(true)
    audio.onended = () => {
      setIsPlayingBack(false)
      URL.revokeObjectURL(audioUrl)
    }
    audio.onerror = () => {
      setIsPlayingBack(false)
      URL.revokeObjectURL(audioUrl)
    }
    
    playbackRef.current = audio
    audio.play()
  }, [recordedBlob])
  
  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.pause()
      playbackRef.current.currentTime = 0
      setIsPlayingBack(false)
    }
  }, [])
  
  // ====================== UTILITY FUNCTIONS ======================
  
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])
  
  const getStatusMessage = useCallback((): string => {
    if (hasPermission === false) return 'Microphone permission required'
    if (disabled) return 'Recording disabled'
    if (isRecording && isPaused) return 'Recording paused'
    if (isRecording) return 'Recording in progress'
    if (recordedBlob) return 'Recording ready for playback'
    return 'Ready to record'
  }, [hasPermission, disabled, isRecording, isPaused, recordedBlob])
  
  const getQualityColor = useCallback((quality: string): string => {
    switch (quality) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }, [])
  
  // ====================== CLEANUP ======================
  
  useEffect(() => {
    return () => {
      stopRecording()
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      
      if (playbackRef.current) {
        playbackRef.current.pause()
      }
    }
  }, [stopRecording])
  
  // ====================== COMPONENT SIZE STYLES ======================
  
  const sizeStyles = useMemo(() => {
    switch (size) {
      case 'small':
        return {
          container: 'p-3',
          button: 'w-12 h-12',
          icon: 'w-4 h-4',
          text: 'text-sm'
        }
      case 'large':
        return {
          container: 'p-8',
          button: 'w-20 h-20',
          icon: 'w-8 h-8',
          text: 'text-lg'
        }
      default:
        return {
          container: 'p-6',
          button: 'w-16 h-16',
          icon: 'w-6 h-6',
          text: 'text-base'
        }
    }
  }, [size])
  
  // ====================== RENDER ======================
  
  return (
    <div className={`
      audio-recorder 
      ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      rounded-xl border border-gray-200 shadow-lg
      ${sizeStyles.container}
      ${className}
    `}>
      {/* Main Recording Controls */}
      <div className="flex flex-col items-center space-y-4">
        
        {/* Primary Record Button */}
        <div className="relative">
          <button
            onClick={handleButtonClick}
            disabled={!canClickButton}
            className={`
              ${sizeStyles.button}
              rounded-full transition-all duration-200 transform
              ${isRecording 
                ? (isPaused ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600 animate-pulse') 
                : 'bg-blue-500 hover:bg-blue-600'
              }
              ${canClickButton 
                ? 'text-white shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
              flex items-center justify-center
            `}
          >
            {isRecording ? (
              isPaused ? <Play className={sizeStyles.icon} /> : <Pause className={sizeStyles.icon} />
            ) : (
              <Mic className={sizeStyles.icon} />
            )}
          </button>
          
          {/* Recording progress ring */}
          {isRecording && (
            <svg 
              className={`absolute inset-0 ${sizeStyles.button} transform -rotate-90`}
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${recordingProgress * 2.83} 283`}
                className="transition-all duration-1000"
              />
            </svg>
          )}
          
          {/* Permission indicator */}
          {hasPermission === false && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
        
        {/* Timer and Status */}
        {mergedConfig.showTimer && (
          <div className="text-center">
            <div className={`font-mono font-bold ${sizeStyles.text} ${isRecording ? 'text-red-600' : 'text-gray-600'}`}>
              {formatTime(duration)}
            </div>
            <div className={`text-xs text-gray-500 mt-1`}>
              {getStatusMessage()}
            </div>
          </div>
        )}
        
        {/* Audio Level Meter */}
        {mergedConfig.showWaveform && isRecording && (
          <div className="w-full max-w-xs">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-red-500 transition-all duration-100"
                style={{ width: `${audioLevel * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Quality Indicators */}
        {mergedConfig.showQualityMeter && isRecording && (
          <div className="flex space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <Volume2 className="w-3 h-3" />
              <span className={getQualityColor(qualityIndicators.volume)}>
                {qualityIndicators.volume}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <VolumeX className="w-3 h-3" />
              <span className={getQualityColor(qualityIndicators.noise)}>
                {qualityIndicators.noise}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span className={getQualityColor(qualityIndicators.clarity)}>
                {qualityIndicators.clarity}
              </span>
            </div>
          </div>
        )}
        
        {/* Secondary Controls */}
        <div className="flex space-x-2">
          {/* Stop Button */}
          {isRecording && (
            <button
              onClick={stopRecording}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              title="Stop Recording"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          
          {/* Playback Button */}
          {canPlayback && (
            <button
              onClick={isPlayingBack ? stopPlayback : playRecording}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              title={isPlayingBack ? "Stop Playback" : "Play Recording"}
            >
              {isPlayingBack ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          
          {/* Reset Button */}
          {(recordedBlob || isRecording) && (
            <button
              onClick={resetRecording}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              title="Reset Recording"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            title="Recording Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="w-full p-4 bg-gray-50 rounded-lg border text-sm">
            <h4 className="font-medium mb-2">Recording Settings</h4>
            <div className="space-y-2 text-xs text-gray-600">
              <div>Max Duration: {formatTime(mergedConfig.maxDuration)}</div>
              <div>Voice Detection: {mergedConfig.enableVAD ? 'Enabled' : 'Disabled'}</div>
              <div>Auto Gain: {mergedConfig.autoGain ? 'Enabled' : 'Disabled'}</div>
              <div>Noise Suppression: {mergedConfig.noiseSuppression ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>
        )}
        
        {/* Help Text */}
        {hasPermission === null && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Info className="w-4 h-4" />
            <span>Click to request microphone permission</span>
          </div>
        )}
        
        {hasPermission === false && (
          <div className="flex items-center space-x-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Microphone access required for recording</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AudioRecorder
export type { AudioRecorderProps, AudioConfig, AudioAnalytics } 