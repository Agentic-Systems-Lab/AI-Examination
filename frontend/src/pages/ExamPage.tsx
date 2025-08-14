/**
 * Simplified Exam Page Component
 * 
 * This page provides a simplified exam experience focused on audio functionality
 * without complex backend session management.
 * 
 * Author: AI Assistant
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { useExamContext } from '../contexts/ExamContext'
import LoadingSpinner from '../components/LoadingSpinner'
import AudioRecorder, { AudioConfig, AudioAnalytics } from '../components/AudioRecorder'
import ChatInterface, { ChatMessage } from '../components/ChatInterface'
import ExamControls from '../components/ExamControls'
import ConversationLogDisplay from '../components/ConversationLogDisplay'
import * as audioAPI from '../services/audioAPI'
import * as examAPI from '../services/examAPI'

// Types for simplified exam state
type ExamStatus = 'not_started' | 'started' | 'in_progress' | 'completed'

interface ExamState {
  status: ExamStatus
  duration: number
  isAudioProcessing: boolean
  currentQuestionNumber: number
  totalQuestions: number
  answeredQuestions: number
}

interface ExamQuestion {
  id: number
  text: string
  type: string
  options?: string[]
  difficulty_level: number
}

/**
 * Simplified ExamPage Component
 * 
 * Provides audio-focused exam experience without backend session complexity.
 * Now loads questions dynamically from generated text files.
 * Material can be specified via URL parameter 'material' or defaults to Business Model Navigator.
 */
function ExamPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthContext()
  const { currentSession, selectedMaterial } = useExamContext()

  // Get material title from URL params, selected material, or use default
  const materialTitle = searchParams.get('material') || selectedMaterial?.title || 'Business Model Navigator'

  // ====================== STATE MANAGEMENT ======================
  
  const [examState, setExamState] = useState<ExamState>({
    status: 'not_started',
    duration: 0,
    isAudioProcessing: false,
    currentQuestionNumber: 1,
    totalQuestions: 0,
    answeredQuestions: 0
  })

  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentQuestionText, setCurrentQuestionText] = useState('')
  const [audioConfig, setAudioConfig] = useState<AudioConfig | null>(null)
  
  // Input mode state
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice')
  const [textAnswer, setTextAnswer] = useState('')
  const [isSubmittingText, setIsSubmittingText] = useState(false)
  
  // Real exam session state
  const [realSessionId, setRealSessionId] = useState<number | null>(null)
  const [material, setMaterial] = useState<any>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  
  // Conversation log display state
  const [showConversationLog, setShowConversationLog] = useState(false)
  const [conversationLogPath, setConversationLogPath] = useState<string | null>(null)
  
  // Question timing
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  
  // Refs for managing intervals and audio
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // ====================== MATERIAL & SESSION MANAGEMENT ======================

  // ====================== QUESTION LOADING ======================

  /**
   * Load questions for the material associated with the exam session
   */
  const loadQuestions = useCallback(async () => {
    try {
      console.log('🔍 Loading questions for exam session material')
      setIsLoadingQuestions(true)
      setQuestionsError(null)
      
      // Get material ID from current session or selected material
      let materialId = currentSession?.material_id || selectedMaterial?.id
      
      // If no material ID, try to get session data
      if (!materialId && realSessionId) {
        console.log('🔍 Getting material ID from session data')
        const sessionData = await examAPI.getExamSession(realSessionId)
        materialId = sessionData.material_id
      }
      
      if (!materialId) {
        // If no material ID, don't set it as an error, just wait
        console.warn('⚠️ No material ID found - session may not be ready yet')
        setQuestionsError(null) // Clear any previous errors
        setIsLoadingQuestions(false) // Stop the loading state
        console.log('⏳ Waiting for session to be established...')
        return
      }
      
      console.log('📚 Loading questions for material ID:', materialId)
      
      // Load questions for this material from the questions API
      const questionsResponse = await examAPI.getQuestionsForMaterial(materialId)
      
      if (questionsResponse.questions && questionsResponse.questions.length > 0) {
        console.log(`✅ Loaded ${questionsResponse.questions.length} questions for material: ${questionsResponse.material_title}`)
        setQuestions(questionsResponse.questions)
        setExamState(prev => ({ 
          ...prev, 
          totalQuestions: questionsResponse.questions.length 
        }))
        return
      }
      
      throw new Error('No questions found for this material')
      
    } catch (error) {
      console.error('❌ Failed to load questions for material:', error)
      setQuestionsError(
        error instanceof Error 
          ? error.message 
          : 'Failed to load questions for this material.'
      )
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [currentSession, selectedMaterial, realSessionId])

  const loadAudioConfig = useCallback(async () => {
    try {
      console.log('🔧 Loading audio configuration...')
      const config = await audioAPI.getAudioConfig()
      setAudioConfig({
        maxDuration: config.limits.max_duration_seconds,
        enableVAD: true,
        silenceThreshold: config.audio_config.silence_threshold,
        silenceDuration: config.audio_config.silence_duration,
        autoGain: config.audio_config.enable_auto_gain,
        noiseSuppression: config.audio_config.enable_noise_reduction,
        sampleRate: config.audio_config.sample_rate,
        showWaveform: true,
        showTimer: true,
        showQualityMeter: true
      })
      console.log('✅ Audio configuration loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load audio config:', error)
      // Use default config on error
      setAudioConfig({
        maxDuration: 300,
        enableVAD: true,
        silenceThreshold: 0.03,
        silenceDuration: 3,
        autoGain: true,
        noiseSuppression: true,
        sampleRate: 44100,
        showWaveform: true,
        showTimer: true,
        showQualityMeter: true
      })
    }
  }, [])

  // ====================== CHAT MANAGEMENT ======================

  const addChatMessage = useCallback((type: 'examiner' | 'student', content: string, hasAudio = false) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      hasAudio
    }
    setChatMessages(prev => [...prev, message])
  }, [])

  // ====================== INITIALIZATION ======================

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth')
      return
    }

    // Load audio configuration first
    loadAudioConfig()
    
    // Always try to load questions - the loadQuestions function will handle missing session
    loadQuestions()

    return () => {
      // Cleanup timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      // Stop any playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
      }
    }
  }, [isAuthenticated, navigate, loadAudioConfig, currentSession, realSessionId, loadQuestions])

  // Use existing session from ExamContext instead of creating a new one
  useEffect(() => {
    if (!isAuthenticated) return
    
    // Use existing session from ExamContext if available
    if (currentSession && currentSession.id) {
      console.log('✅ Using existing exam session from context:', currentSession.id)
      setRealSessionId(currentSession.id)
      setMaterial(selectedMaterial)
      setIsCreatingSession(false)
      return
    }
    
    // If no session exists and we haven't already set one, redirect back to upload
    if (!currentSession && realSessionId === null && !isCreatingSession) {
      console.log('⚠️ No exam session found. Redirecting to upload page.')
      navigate('/upload')
      return
    }
  }, [isAuthenticated, currentSession, selectedMaterial, realSessionId, isCreatingSession, navigate])

  // Reload questions when session becomes available
  useEffect(() => {
    if (currentSession || realSessionId) {
      console.log('🔄 Session available, reloading questions...')
      loadQuestions()
    }
  }, [currentSession, realSessionId, loadQuestions])

  // ====================== TEXT-TO-SPEECH ======================

  const playTextToSpeech = useCallback(async (text: string, emotion?: string) => {
    try {
      if (!realSessionId) {
        console.warn('⚠️ No session ID available for TTS')
        return
      }
      
      console.log('🔊 Starting TTS with session:', realSessionId)
      console.log('🔊 TTS Text:', text.substring(0, 50) + '...')
      console.log('🔊 Current realSessionId state:', realSessionId)
      
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
      }
      
      // Get audio data from API using real session ID
      const result = await audioAPI.synthesizeSpeech(
        realSessionId,
        text,
        { voice_id: 'alloy', speech_rate: 1.0 },
        emotion
      )
      
      console.log('✅ TTS API response received, audio length:', result.audio_data.length)
      
      // Convert base64 to audio blob
      const audioBlob = audioAPI.base64ToBlob(result.audio_data, 'audio/mp3')
      const audioUrl = URL.createObjectURL(audioBlob)
      
      console.log('🎵 Playing audio, blob size:', audioBlob.size)
      
      // Play audio
      const audio = new Audio(audioUrl)
      currentAudioRef.current = audio
      
      audio.onended = () => {
        console.log('🎵 Audio playback ended')
        URL.revokeObjectURL(audioUrl)
        currentAudioRef.current = null
      }
      
      audio.onerror = (e) => {
        console.error('❌ Audio playback error:', e)
        URL.revokeObjectURL(audioUrl)
        currentAudioRef.current = null
      }
      
      await audio.play()
      console.log('🎵 Audio play() called successfully')
      
    } catch (error) {
      console.error('❌ TTS failed:', error)
      // Show user-friendly error message
      if (error instanceof audioAPI.AudioAPIError) {
        console.error('TTS Error details:', audioAPI.getErrorMessage(error))
      }
    }
  }, [realSessionId])

  // ====================== EXAM FLOW MANAGEMENT ======================

  const startExamFlow = useCallback(async () => {
    console.log('🎯 Starting simplified exam flow with session:', realSessionId)
    
    // Ensure session is created
    if (!realSessionId) {
      console.error('❌ Cannot start exam: No session ID available')
      addChatMessage('examiner', 'Unable to start exam. Session is not ready. Please wait a moment and try again.')
      return
    }
    
    // Ensure questions are loaded
    if (questions.length === 0) {
      console.error('❌ Cannot start exam: No questions loaded')
      addChatMessage('examiner', 'Unable to start exam. No questions are available. Please try reloading the page.')
      return
    }
    
    setExamState(prev => ({ ...prev, status: 'started' }))
    
    // Start the timer
    timerRef.current = setInterval(() => {
      setExamState(prev => ({ ...prev, duration: prev.duration + 1 }))
    }, 1000)
    
    try {
      // Add welcome message and read first question
      addChatMessage('examiner', 'Welcome to your oral examination. I will now read the first question.', true)
      await playTextToSpeech('Welcome to your oral examination. I will now read the first question.')
      
      const firstQuestion = questions[0]
      
      // Format question with options
      let questionText = `Question 1: ${firstQuestion.text}`
      if (firstQuestion.options && firstQuestion.options.length > 0) {
        questionText += '\n\nOptions:\n' + firstQuestion.options.join('\n')
      }
      
      setCurrentQuestionText(firstQuestion.text)
      addChatMessage('examiner', questionText, true)
      
      // Read question and options aloud
      let spokenText = `Question 1: ${firstQuestion.text}`
      if (firstQuestion.options && firstQuestion.options.length > 0) {
        spokenText += '. The options are: ' + firstQuestion.options.map(option => option.replace(/^[A-D]\)\s*/, '')).join(', ')
      }
      await playTextToSpeech(spokenText)
      
      // Start timing for first question
      setQuestionStartTime(Date.now())
      
      setExamState(prev => ({ ...prev, status: 'in_progress' }))
      console.log('✅ Exam started successfully')
      
    } catch (error) {
      console.error('❌ Error during exam startup:', error)
      // Continue exam even if TTS fails
      setExamState(prev => ({ ...prev, status: 'in_progress' }))
    }
  }, [addChatMessage, playTextToSpeech, realSessionId, questions])

  // ====================== AUDIO RECORDING HANDLERS ======================

  const handleRecordingStart = useCallback(() => {
    console.log('🎤 Recording started')
    setExamState(prev => ({ ...prev, isAudioProcessing: false }))
  }, [])

  const handleRecordingStop = useCallback(async (audioBlob: Blob, analytics: AudioAnalytics) => {
    console.log('🎤 Recording stopped, blob size:', audioBlob.size, 'analytics:', analytics)
    
    setExamState(prev => ({ ...prev, isAudioProcessing: true }))

    try {
      if (!realSessionId) {
        console.warn('⚠️ No session ID available for transcription')
        setExamState(prev => ({ ...prev, isAudioProcessing: false }))
        return
      }
      
      console.log('🔄 Starting transcription with session:', realSessionId)
      console.log('🔄 Current realSessionId state:', realSessionId)
      
      // Transcribe audio using real session ID
      const result = await audioAPI.transcribeAudio(realSessionId, audioBlob)
      console.log('✅ Transcription received:', result.transcription)
      
      if (result.transcription && result.transcription.trim().length > 0) {
        // Add student message to chat
        addChatMessage('student', result.transcription)
        
        // Submit the transcribed answer to the exam database
        try {
          console.log('📝 Submitting answer to exam database:', result.transcription)
          
          const currentQuestion = questions[examState.currentQuestionNumber - 1]
          if (currentQuestion) {
            const answerData = {
              question_id: currentQuestion.id,
              answer: result.transcription.trim(),
              confidence_level: 4, // Default confidence
              time_taken: Math.floor((Date.now() - questionStartTime) / 1000) // Actual time in seconds
            }
            
            const submitResult = await examAPI.submitAnswer(realSessionId, answerData)
            console.log('✅ Answer submitted successfully:', submitResult)
          } else {
            console.warn('⚠️ No current question found for answer submission')
          }
        } catch (submitError) {
          console.error('❌ Failed to submit answer:', submitError)
          // Continue with exam flow even if submission fails
        }
        
        // Move to next question
        setExamState(prev => {
          const nextQuestionNumber = prev.currentQuestionNumber + 1
          const isLastQuestion = nextQuestionNumber > prev.totalQuestions
          
          return {
            ...prev,
            answeredQuestions: prev.answeredQuestions + 1,
            currentQuestionNumber: isLastQuestion ? prev.currentQuestionNumber : nextQuestionNumber,
            status: isLastQuestion ? 'completed' : 'in_progress'
          }
        })
        
        // Check if there are more questions using the NEW question number
        const newQuestionNumber = examState.currentQuestionNumber + 1 // This will be the updated value after state change
        if (newQuestionNumber <= examState.totalQuestions) {
          // Add examiner feedback and next question
          addChatMessage('examiner', 'Thank you for your answer. Let me move to the next question.', true)
          await playTextToSpeech('Thank you for your answer.')
          
          const nextQuestion = questions[newQuestionNumber - 1] // Use the correct index (0-based)
          
          // Format question with options
          let nextQuestionText = `Question ${newQuestionNumber}: ${nextQuestion.text}`
          if (nextQuestion.options && nextQuestion.options.length > 0) {
            nextQuestionText += '\n\nOptions:\n' + nextQuestion.options.join('\n')
          }
          
          setCurrentQuestionText(nextQuestion.text)
          addChatMessage('examiner', nextQuestionText, true)
          
          // Read question and options aloud
          let spokenText = `Question ${newQuestionNumber}: ${nextQuestion.text}`
          if (nextQuestion.options && nextQuestion.options.length > 0) {
            spokenText += '. The options are: ' + nextQuestion.options.map(option => option.replace(/^[A-D]\)\s*/, '')).join(', ')
          }
          await playTextToSpeech(spokenText)
          
          // Start timing for next question
          setQuestionStartTime(Date.now())
        } else {
          // Exam completed
          await completeExamFlow()
        }
      } else {
        addChatMessage('examiner', 'I didn\'t hear your response clearly. Please try again.', true)
        await playTextToSpeech('I didn\'t hear your response clearly. Please try again.')
      }
      
    } catch (error) {
      console.error('❌ Error processing voice input:', error)
      addChatMessage('examiner', 'There was an issue processing your response. Please try again.', true)
      await playTextToSpeech('There was an issue processing your response. Please try again.')
    } finally {
      setExamState(prev => ({ ...prev, isAudioProcessing: false }))
    }
  }, [examState.currentQuestionNumber, examState.totalQuestions, realSessionId, addChatMessage, playTextToSpeech, questions])

  const completeExamFlow = useCallback(async () => {
    console.log('🏁 Completing simplified exam flow')
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setExamState(prev => ({ ...prev, status: 'completed' }))
    
    addChatMessage('examiner', 'Congratulations! You have completed all questions. Your exam is now finished.', true)
    await playTextToSpeech('Congratulations! You have completed all questions. Your exam is now finished.')
    
    // Try to generate conversation log
    try {
      if (!realSessionId) {
        console.warn('⚠️ No session ID available for conversation log')
        return
      }
      
      console.log('📝 Attempting to generate conversation log with session:', realSessionId)
      const logResult = await examAPI.generateConversationLog(realSessionId)
      console.log('✅ Conversation log generated:', logResult.log_file_path)
      
      setConversationLogPath(logResult.log_file_path)
      addChatMessage('examiner', 'Your exam transcript has been generated. Click "View Transcript" to see your detailed results!')
      
      // Show the conversation log automatically after a short delay
      setTimeout(() => {
        setShowConversationLog(true)
      }, 2000)
    } catch (error) {
      console.log('⚠️ Could not generate conversation log:', error)
      addChatMessage('examiner', 'Your exam is complete! While we couldn\'t generate the transcript file, you can still view your results.')
      
      // Show conversation log even if generation failed, using session data
      setTimeout(() => {
        setShowConversationLog(true)
      }, 2000)
    }
  }, [examState.answeredQuestions, examState.totalQuestions, addChatMessage, playTextToSpeech, navigate, realSessionId])

  const handleTextAnswerSubmit = useCallback(async () => {
    if (!textAnswer.trim() || !realSessionId || isSubmittingText) {
      return
    }

    setIsSubmittingText(true)

    try {
      // Add student message to chat
      addChatMessage('student', textAnswer.trim())
      
      // Submit the text answer to the exam database
      console.log('📝 Submitting text answer to exam database:', textAnswer.trim())
      
      const currentQuestion = questions[examState.currentQuestionNumber - 1]
      if (currentQuestion) {
        const answerData = {
          question_id: currentQuestion.id,
          answer: textAnswer.trim(),
          confidence_level: 4,
          time_taken: Math.floor((Date.now() - questionStartTime) / 1000)
        }
        
        const submitResult = await examAPI.submitAnswer(realSessionId, answerData)
        console.log('✅ Text answer submitted successfully:', submitResult)
      } else {
        console.warn('⚠️ No current question found for answer submission')
      }
      
      // Clear text input
      setTextAnswer('')
      
      // Move to next question
      setExamState(prev => {
        const nextQuestionNumber = prev.currentQuestionNumber + 1
        const isLastQuestion = nextQuestionNumber > prev.totalQuestions
        
        return {
          ...prev,
          answeredQuestions: prev.answeredQuestions + 1,
          currentQuestionNumber: isLastQuestion ? prev.currentQuestionNumber : nextQuestionNumber,
          status: isLastQuestion ? 'completed' : 'in_progress'
        }
      })
      
      // Check if there are more questions using the NEW question number
      const newQuestionNumber = examState.currentQuestionNumber + 1 // This will be the updated value after state change
      if (newQuestionNumber <= examState.totalQuestions) {
        // Add examiner feedback and next question
        addChatMessage('examiner', 'Thank you for your answer. Let me move to the next question.', true)
        await playTextToSpeech('Thank you for your answer.')
        
        const nextQuestion = questions[newQuestionNumber - 1] // Use the correct index (0-based)
        
        // Format question with options
        let nextQuestionText = `Question ${newQuestionNumber}: ${nextQuestion.text}`
        if (nextQuestion.options && nextQuestion.options.length > 0) {
          nextQuestionText += '\n\nOptions:\n' + nextQuestion.options.join('\n')
        }
        
        setCurrentQuestionText(nextQuestion.text)
        addChatMessage('examiner', nextQuestionText, true)
        
        // Read question and options aloud if voice mode is enabled
        let spokenText = `Question ${newQuestionNumber}: ${nextQuestion.text}`
        if (nextQuestion.options && nextQuestion.options.length > 0) {
          spokenText += '. The options are: ' + nextQuestion.options.map(option => option.replace(/^[A-D]\)\s*/, '')).join(', ')
        }
        await playTextToSpeech(spokenText)
        
        // Start timing for next question
        setQuestionStartTime(Date.now())
      } else {
        // Exam completed
        await completeExamFlow()
      }
      
    } catch (error) {
      console.error('❌ Error submitting text answer:', error)
      addChatMessage('examiner', 'There was an issue submitting your response. Please try again.')
    } finally {
      setIsSubmittingText(false)
    }
  }, [textAnswer, realSessionId, isSubmittingText, addChatMessage, questions, examState.currentQuestionNumber, examState.totalQuestions, questionStartTime, playTextToSpeech, completeExamFlow])

  const stopExam = useCallback(() => {
    console.log('🛑 Stopping exam session')
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
    }
    
    // Reset exam state
    setExamState(prev => ({
      ...prev,
      status: 'not_started',
      duration: 0,
      currentQuestionNumber: 1,
      answeredQuestions: 0
    }))
    
    // Clear chat messages
    setChatMessages([])
    setCurrentQuestionText('')
    
    addChatMessage('examiner', 'Exam session stopped. You can start again whenever you\'re ready.')
  }, [addChatMessage])

  // ====================== RENDER HELPERS ======================

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // ====================== LOADING STATE ======================

  if (!audioConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading audio configuration...</p>
        </div>
      </div>
    )
  }

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading questions for {materialTitle}...</p>
          {questionsError && <p className="mt-2 text-red-600">{questionsError}</p>}
        </div>
      </div>
    )
  }

  if (questionsError && !isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to Load Questions
          </h2>
          <p className="text-gray-600 mb-4">
            {questionsError}
          </p>
          <div className="space-y-3">
            <button
              onClick={loadQuestions}
              disabled={isLoadingQuestions}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoadingQuestions ? (
                <>
                  <LoadingSpinner size="small" />
                  <span className="ml-2">Retrying...</span>
                </>
              ) : (
                'Retry Loading Questions'
              )}
            </button>
            <button
              onClick={() => navigate('/upload')}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Go to Upload Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0 && !isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Questions Available
          </h2>
          <p className="text-gray-600 mb-4">
            No questions were found for {materialTitle}. Please generate questions first.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Upload Page
          </button>
        </div>
      </div>
    )
  }

  // ====================== MAIN RENDER ======================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Duration: {formatTime(examState.duration)}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                examState.status === 'completed' ? 'bg-green-100 text-green-800' :
                examState.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {examState.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column - Conversation & Voice Interface */}
          <div className="space-y-4">
            {/* Exam Conversation */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <ChatInterface
                messages={chatMessages}
                className="h-96 p-0"
              />
            </div>

            {/* Answer Input - Voice or Text */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Your Answer
                </h3>
                
                {/* Input Mode Toggle */}
                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setInputMode('voice')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      inputMode === 'voice'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    🎤 Voice
                  </button>
                  <button
                    onClick={() => setInputMode('text')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      inputMode === 'text'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    ⌨️ Text
                  </button>
                </div>
              </div>
              
              {inputMode === 'voice' ? (
                <div>
                  <AudioRecorder
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    config={audioConfig}
                    disabled={examState.status === 'not_started' || examState.status === 'completed' || examState.isAudioProcessing}
                    theme="light"
                    size="medium"
                  />
                  
                  {/* Processing Indicator */}
                  {examState.isAudioProcessing && (
                    <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      <span className="text-sm">Processing your response...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey && textAnswer.trim()) {
                        e.preventDefault()
                        handleTextAnswerSubmit()
                      }
                    }}
                    placeholder="Type your answer here... (Ctrl+Enter to submit)"
                    disabled={examState.status === 'not_started' || examState.status === 'completed' || isSubmittingText}
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {textAnswer.length} characters
                    </div>
                    
                    <button
                      onClick={handleTextAnswerSubmit}
                      disabled={
                        !textAnswer.trim() || 
                        examState.status === 'not_started' || 
                        examState.status === 'completed' || 
                        isSubmittingText
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSubmittingText ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Answer</span>
                          <span>↵</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Current Question Display */}
              {currentQuestionText && examState.status !== 'completed' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Current Question:</h4>
                  <p className="text-blue-800 text-sm">
                    {currentQuestionText}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Exam Controls */}
          <div className="space-y-6">
            <ExamControls 
              examStatus={examState.status}
              currentQuestionNumber={examState.currentQuestionNumber}
              totalQuestions={examState.totalQuestions}
              answeredQuestions={examState.answeredQuestions}
              canStartExam={questions.length > 0 && !isLoadingQuestions && !questionsError && realSessionId !== null && !isCreatingSession}
              isRecording={false}
              isExaminerSpeaking={false}
              isTranscribing={examState.isAudioProcessing}
              materialTitle={materialTitle}
              examDuration={examState.duration}
              onStartExam={startExamFlow}
              onCompleteExam={completeExamFlow}
              disabled={examState.isAudioProcessing}
            />

            {/* View Transcript Button */}
            {examState.status === 'completed' && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Results</h3>
                <button
                  onClick={() => setShowConversationLog(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  📋 View Exam Transcript
                </button>
                {conversationLogPath && (
                  <p className="text-sm text-gray-600 mt-2">
                    Saved to: {conversationLogPath}
                  </p>
                )}
              </div>
            )}

            {/* Session Status */}
            {isCreatingSession && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-blue-800 font-medium">Creating exam session...</span>
                </div>
              </div>
            )}

            {/* Session Progress */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Progress</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Questions Answered</span>
                    <span>{examState.answeredQuestions} / {examState.totalQuestions}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(examState.answeredQuestions / examState.totalQuestions) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Material:</span>
                    <p className="font-medium">{materialTitle}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-medium">{examState.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Help Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Use</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Click "Start Exam" to begin</li>
                <li>• Listen to the examiner read each question</li>
                <li>• Choose your input method:</li>
                <li className="ml-4">
                  <strong>🎤 Voice:</strong> Click the microphone to record your answer
                </li>
                <li className="ml-4">
                  <strong>⌨️ Text:</strong> Type your answer and click "Submit Answer" or press Ctrl+Enter
                </li>
                <li>• Your response will be processed and the next question will be read</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Log Modal */}
      <ConversationLogDisplay
        sessionId={realSessionId || 0}
        logFilePath={conversationLogPath || undefined}
        isVisible={showConversationLog}
        onClose={() => setShowConversationLog(false)}
      />
    </div>
  )
}

export default ExamPage 