/**
 * API Service for AI Examiner Backend
 * 
 * This module provides functions to interact with the FastAPI backend,
 * handling all HTTP requests and responses for the AI Examiner application.
 * 
 * Author: AI Assistant
 */

import axios from 'axios'
import type { Material, Question, ExamSession, StudentAnswer, ScoreReport } from '../contexts/ExamContext'

// Configure axios with base URL and defaults
const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message)
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Handle authentication errors
      console.error('Authentication required')
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error occurred')
    }
    
    return Promise.reject(error)
  }
)

// Types for API responses
interface MaterialsResponse {
  materials: Material[]
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}

interface QuestionGenerationResponse {
  message: string
  material_id: number
  material_title: string
  questions_generated: number
  questions: Question[]
  file_path: string | null
  file_available: boolean
  file_message?: string
}



interface AnswerSubmissionResponse {
  message: string
  is_correct: boolean
  explanation: string
  score: number
  ai_feedback: string
  question_number: number
  total_questions: number
  is_exam_completed: boolean
  next_question?: Question
  conversation_log_file?: string
}



// === MATERIAL MANAGEMENT ===

/**
 * Upload a new study material file
 */
export async function uploadMaterial(
  file: File,
  title: string,
  description: string = '',
  subject: string
): Promise<Material> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)
  formData.append('description', description)
  formData.append('subject', subject)

  const response = await api.post('/upload/material', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

/**
 * Get list of uploaded materials
 */
export async function getMaterials(
  subject?: string,
  limit: number = 20,
  offset: number = 0
): Promise<MaterialsResponse> {
  const params = new URLSearchParams()
  if (subject) params.append('subject', subject)
  params.append('limit', limit.toString())
  params.append('offset', offset.toString())

  const response = await api.get(`/upload/materials?${params}`)
  return response.data
}

/**
 * Get specific material by ID
 */
export async function getMaterial(materialId: number): Promise<Material> {
  const response = await api.get(`/upload/material/${materialId}`)
  return response.data
}

/**
 * Delete a material and all associated data (cascade delete)
 * 
 * This function calls the backend endpoint to delete a material along with
 * all its associated questions, exam sessions, and answers.
 */
export async function deleteMaterial(materialId: number): Promise<{
  message: string
  deleted_id: number
  deleted_counts: {
    answers: number
    exam_sessions: number
    questions: number
    material: number
  }
  total_records_deleted: number
}> {
  const response = await api.delete(`/upload/material/${materialId}`)
  return response.data
}

// === QUESTION GENERATION ===

/**
 * Generate questions from study material
 */
export async function generateQuestions(
  materialId: number,
  options: {
    num_questions: number
    difficulty_level: number
    question_types: string[]
  }
): Promise<QuestionGenerationResponse> {
  const response = await api.post('/questions/generate', {
    material_id: materialId,
    num_questions: options.num_questions,
    difficulty_level: options.difficulty_level,
    question_types: options.question_types,
  })

  return response.data
}

/**
 * Get questions for a specific material
 */
export async function getQuestionsForMaterial(
  materialId: number,
  questionType?: string,
  difficultyLevel?: number,
  limit: number = 50,
  offset: number = 0
): Promise<{
  material_id: number
  material_title: string
  questions: Question[]
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}> {
  const params = new URLSearchParams()
  if (questionType) params.append('question_type', questionType)
  if (difficultyLevel) params.append('difficulty_level', difficultyLevel.toString())
  params.append('limit', limit.toString())
  params.append('offset', offset.toString())

  const response = await api.get(`/questions/material/${materialId}?${params}`)
  return response.data
}

/**
 * Get specific question by ID
 */
export async function getQuestion(questionId: number): Promise<Question> {
  const response = await api.get(`/questions/${questionId}`)
  return response.data
}

/**
 * Get questions from generated text file for a specific material
 */
export async function getQuestionsFromFile(
  materialTitle: string
): Promise<{
  material_title: string
  questions: Question[]
  total_count: number
  file_path: string
  message: string
}> {
  const response = await api.get(`/questions/file/${encodeURIComponent(materialTitle)}`)
  return response.data
}

/**
 * Update a specific question
 */
export async function updateQuestion(questionId: number, questionData: Question): Promise<Question> {
  const response = await api.put(`/questions/${questionId}`, questionData)
  return response.data
}

/**
 * Delete a specific question
 */
export async function deleteQuestion(questionId: number): Promise<{ message: string; deleted_id: number }> {
  const response = await api.delete(`/questions/${questionId}`)
  return response.data
}

/**
 * Create a new question for a specific material
 */
export async function createQuestion(
  materialId: number, 
  questionData: Omit<Question, 'id'>
): Promise<{
  message: string
  question: Question
  material_id: number
  material_title: string
}> {
  const response = await api.post(`/questions/material/${materialId}`, questionData)
  return response.data
}

/**
 * Bulk update and delete questions for a material
 */
export async function bulkUpdateQuestions(
  materialId: number,
  updates: Question[],
  deletes: number[]
): Promise<{
  message: string
  material_id: number
  updated_count: number
  deleted_count: number
  total_operations: number
  errors?: string[]
}> {
  const response = await api.post('/questions/bulk-update', {
    material_id: materialId,
    updates: updates,
    deletes: deletes
  })
  return response.data
}

/**
 * Get question count for a specific material (diagnostic)
 */
export async function getQuestionCount(materialId: number): Promise<{
  material_id: number
  material_title: string
  total_questions: number
  type_breakdown: Record<string, number>
  message: string
}> {
  const response = await api.get(`/questions/material/${materialId}/count`)
  return response.data
}

// === EXAM SESSIONS ===

/**
 * Start a new exam session
 */
export async function startExamSession(
  materialId: number,
  options?: {
    num_questions?: number
    difficulty_level?: number
  }
): Promise<ExamSession> {
  const response = await api.post('/exam/start', {
    material_id: materialId,
    num_questions: options?.num_questions || 10,
    difficulty_level: options?.difficulty_level || 3,
  })

  return response.data
}

/**
 * Get current exam session status
 */
export async function getExamSession(sessionId: number): Promise<ExamSession> {
  const response = await api.get(`/exam/session/${sessionId}`)
  return response.data
}

/**
 * Submit an answer for the current question
 */
export async function submitAnswer(
  sessionId: number,
  answer: StudentAnswer
): Promise<AnswerSubmissionResponse> {
  const response = await api.post(`/exam/session/${sessionId}/answer`, answer)
  return response.data
}

/**
 * Generate follow-up question based on student's answer
 */
export async function generateFollowUpQuestion(
  sessionId: number,
  questionId: number,
  studentAnswer: string,
  context?: string
): Promise<{
  exam_session_id: number
  original_question_id: number
  followup_question: string
  purpose: string
  expected_answer_type: string
  generated_at: string
}> {
  const response = await api.post(`/exam/session/${sessionId}/followup`, {
    exam_session_id: sessionId,
    question_id: questionId,
    student_answer: studentAnswer,
    context,
  })

  return response.data
}

/**
 * Get detailed progress for an exam session
 */
export async function getExamProgress(sessionId: number): Promise<{
  exam_session_id: number
  material_title: string
  status: string
  progress: {
    total_questions: number
    answered_questions: number
    remaining_questions: number
    progress_percentage: number
  }
  performance: {
    correct_answers: number
    accuracy_percentage: number
    total_time_seconds: number
    average_time_per_question: number
  }
  difficulty_breakdown: Record<number, { total: number; correct: number }>
  start_time: string | null
  end_time: string | null
}> {
  const response = await api.get(`/exam/session/${sessionId}/progress`)
  return response.data
}

/**
 * Manually complete an exam session
 */
export async function completeExamSession(sessionId: number): Promise<{
  message: string
  exam_session_id: number
  status: string
  basic_score: number
  questions_answered: number
  correct_answers: number
  completion_time: string
  conversation_log_file?: string
}> {
  const response = await api.post(`/exam/session/${sessionId}/complete`)
  return response.data
}

/**
 * Get complete exam session results with questions and answers
 */
export async function getSessionResults(sessionId: number): Promise<{
  exam_session_id: number
  material_title: string
  material_subject: string
  status: string
  start_time: string | null
  end_time: string | null
  questions_data: any[]
  answers_data: any[]
  final_score: number | null
  score_breakdown: any
}> {
  const response = await api.get(`/exam/session/${sessionId}/results`)
  return response.data
}

/**
 * Generate conversation log file for an exam session
 */
export async function generateConversationLog(sessionId: number): Promise<{
  message: string
  exam_session_id: number
  log_file_path: string
  generated_at: string
}> {
  const response = await api.get(`/exam/session/${sessionId}/conversation-log`)
  return response.data
}

// === SCORING & ANALYTICS ===

/**
 * Calculate comprehensive score for completed exam
 */
export async function calculateScore(sessionId: number): Promise<ScoreReport> {
  const response = await api.post(`/scoring/session/${sessionId}/calculate`)
  return response.data
}

/**
 * Get detailed score report
 */
export async function getScoreReport(sessionId: number): Promise<ScoreReport> {
  const response = await api.get(`/scoring/session/${sessionId}/report`)
  return response.data
}

/**
 * Get exam history
 */
export async function getExamHistory(
  materialId?: number,
  limit: number = 20,
  offset: number = 0
): Promise<{
  exam_history: Array<{
    exam_session_id: number
    material_title: string
    material_subject: string
    exam_date: string | null
    completion_date: string | null
    final_score: number | null
    questions_answered: number
    correct_answers: number
    accuracy_percentage: number
  }>
  total_count: number
  limit: number
  offset: number
  has_more: boolean
}> {
  const params = new URLSearchParams()
  if (materialId) params.append('material_id', materialId.toString())
  params.append('limit', limit.toString())
  params.append('offset', offset.toString())

  const response = await api.get(`/scoring/sessions/history?${params}`)
  return response.data
}



// === UTILITY FUNCTIONS ===

/**
 * Handle API errors and return user-friendly messages
 */
export function getErrorMessage(error: any): string {
  if (error.response?.data?.detail) {
    return error.response.data.detail
  }
  
  if (error.response?.status === 404) {
    return 'The requested resource was not found.'
  }
  
  if (error.response?.status === 400) {
    return 'Invalid request. Please check your input and try again.'
  }
  
  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.'
  }
  
  if (error.code === 'NETWORK_ERROR') {
    return 'Network error. Please check your connection.'
  }
  
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Convert file size to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validate file type for upload
 */
export function isValidFileType(file: File): boolean {
  const validTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
  
  return validTypes.includes(file.type)
}

/**
 * Get file type display name
 */
export function getFileTypeDisplayName(fileType: string): string {
  const typeMap: Record<string, string> = {
    '.pdf': 'PDF Document',
    '.txt': 'Text File',
    '.docx': 'Word Document',
    '.doc': 'Word Document (Legacy)'
  }
  
  return typeMap[fileType] || fileType.toUpperCase()
} 