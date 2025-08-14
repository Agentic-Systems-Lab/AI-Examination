/**
 * Exam Context for AI Examiner
 * 
 * This context manages exam sessions, question flow, voice interactions,
 * and all exam-related state throughout the application.
 * 
 * Author: AI Assistant
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuthContext } from './AuthContext'
import * as examAPI from '../services/examAPI'

// Types
export interface Material {
  id: number
  title: string
  description?: string
  subject: string
  file_type: string
  upload_time: string
  text_length: number
}

export interface Question {
  id: number
  text: string
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false'
  options?: string[]
  correct_answer: string
  explanation: string
  difficulty_level: number
}

export interface StudentAnswer {
  question_id: number
  answer: string
  confidence_level?: number
  time_taken?: number
}

export interface ExamSession {
  id: number
  exam_session_id?: number  // Backend sometimes returns this instead of id
  material_id: number
  material_title: string
  material_subject: string
  status: 'started' | 'in_progress' | 'completed'
  total_questions: number
  current_question_number: number
  answered_questions: number
  question?: Question
  is_completed: boolean
}

export interface ScoreReport {
  exam_session_id: number
  final_score: number
  score_breakdown: {
    basic_accuracy: number
    weighted_accuracy: number
    time_efficiency: number
    confidence_calibration: number
    questions_answered: number
    correct_answers: number
  }
  performance_analysis: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }
  question_details: Array<{
    question_number: number
    question_text: string
    student_answer: string
    correct_answer: string
    is_correct: boolean
    explanation: string
  }>
}



interface ExamContextType {
  // Materials
  materials: Material[]
  selectedMaterial: Material | null
  
  // Current exam session
  currentSession: ExamSession | null
  isInExam: boolean
  

  
  // Loading states
  isLoading: boolean
  isGeneratingQuestions: boolean
  
  // Error state
  error: string | null
  
  // Actions
  loadMaterials: () => Promise<void>
  selectMaterial: (material: Material) => void
  deleteMaterial: (materialId: number) => Promise<boolean>
  generateQuestions: (materialId: number, options: {
    num_questions: number
    difficulty_level: number
    question_types: string[]
  }) => Promise<boolean>
  startExam: (materialId: number, options?: {
    num_questions?: number
    difficulty_level?: number
  }) => Promise<boolean>
  loadExamSession: (sessionId: number) => Promise<boolean>
  submitAnswer: (answer: StudentAnswer) => Promise<boolean>
  completeExam: () => Promise<ScoreReport | null>
  getScoreReport: (sessionId: number) => Promise<ScoreReport | null>
  

  
  // Utility actions
  clearError: () => void
  resetExam: () => void
}

// Create context
const ExamContext = createContext<ExamContextType | undefined>(undefined)

// Provider props
interface ExamProviderProps {
  children: ReactNode
}

/**
 * Exam Provider Component
 * 
 * Provides exam state and methods to child components.
 */
export function ExamProvider({ children }: ExamProviderProps) {
  const { isAuthenticated } = useAuthContext()
  
  // State
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Computed values
  const isInExam = currentSession !== null && currentSession.status !== 'completed'

  // Load materials on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadMaterials()
    }
  }, [isAuthenticated])

  /**
   * Load available study materials
   */
  const loadMaterials = async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await examAPI.getMaterials()
      setMaterials(response.materials || [])
    } catch (err) {
      console.error('Failed to load materials:', err)
      setError('Failed to load study materials')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Select a material for examination
   */
  const selectMaterial = (material: Material): void => {
    setSelectedMaterial(material)
    setError(null)
  }

  /**
   * Delete a material and all its associated data
   * 
   * This function calls the backend to delete a material along with all
   * associated questions, exam sessions, and answers. After successful
   * deletion, it refreshes the materials list.
   */
  const deleteMaterial = async (materialId: number): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Call the delete API
      const response = await examAPI.deleteMaterial(materialId)
      
      // Remove the deleted material from local state
      setMaterials(prev => prev.filter(material => material.id !== materialId))
      
      // If the deleted material was selected, clear the selection
      if (selectedMaterial?.id === materialId) {
        setSelectedMaterial(null)
      }
      
      console.log(`Material deleted successfully: ${response.message}`)
      console.log(`Total records deleted: ${response.total_records_deleted}`)
      
      return true
    } catch (err) {
      console.error('Failed to delete material:', err)
      setError('Failed to delete material')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Generate questions from selected material
   */
  const generateQuestions = async (
    materialId: number,
    options: {
      num_questions: number
      difficulty_level: number
      question_types: string[]
    }
  ): Promise<boolean> => {
    try {
      setIsGeneratingQuestions(true)
      setError(null)
      
      const response = await examAPI.generateQuestions(materialId, options)
      
      // Check if questions were actually generated successfully
      if (response && response.questions_generated > 0) {
        // Questions were generated successfully, even if file creation failed
        // Don't set an error state for file creation issues
        if (!response.file_available) {
          console.warn('Questions generated but file creation failed:', response.file_message)
        }
        return true
      } else {
        setError('No questions were generated')
        return false
      }
    } catch (err) {
      console.error('Failed to generate questions:', err)
      setError('Failed to generate questions')
      return false
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  /**
   * Start a new exam session
   */
  const startExam = async (
    materialId: number,
    options?: {
      num_questions?: number
      difficulty_level?: number
    }
  ): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      
      // If no specific number of questions requested, check available questions first
      let adjustedOptions = options
      if (!options?.num_questions) {
        try {
          const questionsResponse = await examAPI.getQuestionsForMaterial(materialId)
          const availableCount = questionsResponse.questions.length
          
          if (availableCount === 0) {
            setError('No questions available for this material. Please generate questions first.')
            return false
          }
          
          // Adjust to use all available questions (up to a reasonable max)
          const questionsToUse = Math.min(availableCount, 10)
          adjustedOptions = {
            ...options,
            num_questions: questionsToUse
          }
          
          console.log(`📊 Found ${availableCount} questions, using ${questionsToUse} for exam`)
        } catch (err) {
          console.warn('Could not check available questions, proceeding with default:', err)
        }
      }
      
      const sessionResponse = await examAPI.startExamSession(materialId, adjustedOptions)
      
      // Convert API response to ExamSession format
      const examSession: ExamSession = {
        id: (sessionResponse as any).exam_session_id,
        material_id: (sessionResponse as any).material_id || materialId,
        material_title: (sessionResponse as any).material_title || '',
        material_subject: (sessionResponse as any).material_subject || '',
        status: (sessionResponse as any).status || 'started',
        total_questions: (sessionResponse as any).total_questions || 0,
        current_question_number: (sessionResponse as any).current_question_number || 1,
        answered_questions: 0, // Always 0 when starting
        question: (sessionResponse as any).question,
        is_completed: false // Always false when starting
      }
      
      setCurrentSession(examSession)
      console.log('✅ Exam session created and stored:', examSession)
      return true
    } catch (err) {
      console.error('Failed to start exam:', err)
      
      // Extract meaningful error message
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Failed to start exam session: ${errorMessage}`)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Load an existing exam session
   */
  const loadExamSession = async (sessionId: number): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const sessionData = await examAPI.getExamSession(sessionId)
      
      // Convert API response to ExamSession format
      const examSession: ExamSession = {
        id: (sessionData as any).exam_session_id,
        material_id: (sessionData as any).material_id || 0,
        material_title: (sessionData as any).material_title,
        material_subject: (sessionData as any).material_subject,
        status: (sessionData as any).status as any,
        total_questions: (sessionData as any).total_questions,
        current_question_number: (sessionData as any).current_question_number,
        answered_questions: (sessionData as any).answered_questions,
        question: (sessionData as any).question,
        is_completed: (sessionData as any).is_completed
      }
      
      setCurrentSession(examSession)
      console.log('✅ Exam session loaded successfully:', examSession)
      return true
    } catch (err) {
      console.error('Failed to load exam session:', err)
      setError('Failed to load exam session')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Submit an answer for the current question
   */
  const submitAnswer = async (answer: StudentAnswer): Promise<boolean> => {
    if (!currentSession) {
      setError('No active exam session')
      return false
    }

    try {
      setIsLoading(true)
      setError(null)
      
      const response = await examAPI.submitAnswer(currentSession.id, answer)
      
      // Update session with response data
      setCurrentSession(prev => prev ? {
        ...prev,
        current_question_number: response.question_number,
        answered_questions: prev.answered_questions + 1,
        question: response.next_question,
        is_completed: response.is_exam_completed,
        status: response.is_exam_completed ? 'completed' : 'in_progress'
      } : null)
      
      return true
    } catch (err) {
      console.error('Failed to submit answer:', err)
      setError('Failed to submit answer')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Complete the current exam session
   */
  const completeExam = async (): Promise<ScoreReport | null> => {
    if (!currentSession) {
      setError('No active exam session')
      return null
    }

    try {
      setIsLoading(true)
      setError(null)
      
      await examAPI.completeExamSession(currentSession.id)
      const scoreReport = await examAPI.getScoreReport(currentSession.id)
      
      setCurrentSession(prev => prev ? {
        ...prev,
        status: 'completed',
        is_completed: true
      } : null)
      
      return scoreReport
    } catch (err) {
      console.error('Failed to complete exam:', err)
      setError('Failed to complete exam')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Get score report for a completed exam
   */
  const getScoreReport = async (sessionId: number): Promise<ScoreReport | null> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const scoreReport = await examAPI.getScoreReport(sessionId)
      return scoreReport
    } catch (err) {
      console.error('Failed to get score report:', err)
      setError('Failed to load score report')
      return null
    } finally {
      setIsLoading(false)
    }
  }



  /**
   * Clear error state
   */
  const clearError = (): void => {
    setError(null)
  }

  /**
   * Reset exam state
   */
  const resetExam = (): void => {
    setCurrentSession(null)
    setSelectedMaterial(null)
    setError(null)
  }

  const value: ExamContextType = {
    materials,
    selectedMaterial,
    currentSession,
    isInExam,
    isLoading,
    isGeneratingQuestions,
    error,
    loadMaterials,
    selectMaterial,
    deleteMaterial,
    generateQuestions,
    startExam,
    loadExamSession,
    submitAnswer,
    completeExam,
    getScoreReport,
    clearError,
    resetExam
  }

  return (
    <ExamContext.Provider value={value}>
      {children}
    </ExamContext.Provider>
  )
}

/**
 * Hook to use exam context
 * 
 * @returns ExamContextType - Exam context value
 * @throws Error if used outside ExamProvider
 */
export function useExamContext(): ExamContextType {
  const context = useContext(ExamContext)
  
  if (context === undefined) {
    throw new Error('useExamContext must be used within an ExamProvider')
  }
  
  return context
}

// Export types for use in other components
export type { ExamContextType } 