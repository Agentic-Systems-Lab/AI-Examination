/**
 * Simplified Exam Page Component
 * 
 * This page provides a simplified exam experience focused on text interaction.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useExamContext } from '../contexts/ExamContext'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'
import * as examAPI from '../services/examAPI'
import { getDisplayTitle } from '../utils/textUtils'

// Types for simplified exam state
interface ExamState {
  currentQuestionNumber: number
  totalQuestions: number
  answeredQuestions: number
  isSubmitting: boolean
}

interface ExamQuestion {
  id: number
  text: string
  type: string
  options?: string[]
  difficulty_level: number
}

function ExamPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { currentSession, selectedMaterial } = useExamContext()

  // Get material title
  const rawMaterialTitle = searchParams.get('material') || selectedMaterial?.title || 'Exam Material'
  const materialTitle = getDisplayTitle(rawMaterialTitle, 'header')

  // State
  const [examState, setExamState] = useState<ExamState>({
    currentQuestionNumber: 1,
    totalQuestions: 0,
    answeredQuestions: 0,
    isSubmitting: false
  })

  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [realSessionId, setRealSessionId] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())

  // Initialize session ID
  useEffect(() => {
    if (currentSession && currentSession.id) {
      setRealSessionId(currentSession.id)
    } else if (!realSessionId) {
      // If no session, redirect to upload
      navigate('/upload')
    }
  }, [currentSession, realSessionId, navigate])

  // Load Questions
  useEffect(() => {
    const loadQuestions = async () => {
      if (!realSessionId && !currentSession?.id) return
      
      try {
        setIsLoadingQuestions(true)
        const sessionId = realSessionId || currentSession?.id
        if (!sessionId) return

        // Fetch session details to get material ID and check status
        const sessionData = await examAPI.getExamSession(sessionId)
        
        // Fetch questions
        const questionsResponse = await examAPI.getQuestionsForMaterial(sessionData.material_id)
        
        if (questionsResponse.questions && questionsResponse.questions.length > 0) {
          setQuestions(questionsResponse.questions)
          setExamState(prev => ({
            ...prev,
            totalQuestions: questionsResponse.questions.length,
            currentQuestionNumber: sessionData.current_question_number || 1,
            answeredQuestions: sessionData.answered_questions || 0
          }))
          setQuestionStartTime(Date.now())
        } else {
            setQuestionsError('No questions found for this material.')
        }
      } catch (error) {
        console.error('Failed to load questions:', error)
        setQuestionsError('Failed to load exam questions.')
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    loadQuestions()
  }, [realSessionId, currentSession])

  const handleSubmitAnswer = async () => {
    if (!textAnswer.trim() || !realSessionId) return

    setExamState(prev => ({ ...prev, isSubmitting: true }))

    try {
      const currentQuestion = questions[examState.currentQuestionNumber - 1]
      
      const answerData = {
        question_id: currentQuestion.id,
        answer: textAnswer.trim(),
        confidence_level: 5, // Default
        time_taken: Math.floor((Date.now() - questionStartTime) / 1000)
      }

      const result = await examAPI.submitAnswer(realSessionId, answerData)
      
      if (result.is_exam_completed || examState.currentQuestionNumber >= examState.totalQuestions) {
        // Exam finished
        navigate(`/results/${realSessionId}`)
      } else {
        // Next question
        setExamState(prev => ({
          ...prev,
          currentQuestionNumber: prev.currentQuestionNumber + 1,
          answeredQuestions: prev.answeredQuestions + 1,
          isSubmitting: false
        }))
        setTextAnswer('')
        setQuestionStartTime(Date.now())
        toast.success('Answer submitted!')
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      toast.error('Failed to submit answer. Please try again.')
      setExamState(prev => ({ ...prev, isSubmitting: false }))
    }
  }

  // Render Loading
  if (isLoadingQuestions) {
    return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner /></div>
  }

  // Render Error
  if (questionsError) {
    return (
      <div className="flex justify-center items-center min-h-screen flex-col gap-4">
        <p className="text-red-600 text-xl">{questionsError}</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-blue-600 text-white rounded">Back to Upload</button>
      </div>
    )
  }

  if (questions.length === 0) return null

  const currentQuestion = questions[examState.currentQuestionNumber - 1]
  const progress = ((examState.currentQuestionNumber - 1) / examState.totalQuestions) * 100

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header / Progress */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">{materialTitle}</h1>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-right text-sm text-gray-500 mt-1">Question {examState.currentQuestionNumber} of {examState.totalQuestions}</p>
        </div>

        {/* Question Card */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
             {currentQuestion?.text}
          </h2>
          
          {currentQuestion?.options && currentQuestion.options.length > 0 && (
             <div className="mb-6 space-y-2">
                {currentQuestion.options.map((opt, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                        {opt}
                    </div>
                ))}
             </div>
          )}

          <div className="mt-6">
            <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">Your Answer:</label>
            <textarea
              id="answer"
              rows={6}
              className="w-full p-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Type your answer here..."
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={examState.isSubmitting}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmitAnswer}
            disabled={!textAnswer.trim() || examState.isSubmitting}
            className="px-8 py-3 bg-blue-600 text-white text-lg font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {examState.isSubmitting ? 'Submitting...' : (examState.currentQuestionNumber === examState.totalQuestions ? 'Finish Exam' : 'Next Question')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExamPage
