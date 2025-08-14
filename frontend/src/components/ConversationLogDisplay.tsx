/**
 * Conversation Log Display Component
 * 
 * This component displays the exam conversation log in a beautifully formatted way,
 * showing questions, student answers, and proposed solutions with proper styling.
 * 
 * Author: AI Assistant
 */

import React from 'react'
import { CheckCircle, XCircle, Clock, User, BookOpen, Award } from 'lucide-react'
import * as examAPI from '../services/examAPI'

interface ConversationLogProps {
  sessionId: number
  logFilePath?: string
  isVisible: boolean
  onClose: () => void
}

interface LogEntry {
  questionNumber: number
  questionText: string
  studentAnswer: string
  proposedSolution: string
  explanation?: string
  isCorrect: boolean
  score: number
  aiFeedback?: string
  timeTaken?: number
  confidence?: number
}

interface ExamSummary {
  totalQuestions: number
  questionsAnswered: number
  correctAnswers: number
  accuracy: number
  finalScore: number
}

/**
 * Conversation Log Display Component
 * 
 * Displays exam results and conversation log in an elegant, readable format
 * with proper typography and visual hierarchy.
 */
function ConversationLogDisplay({ sessionId, logFilePath, isVisible, onClose }: ConversationLogProps) {
  const [logData, setLogData] = React.useState<{
    entries: LogEntry[]
    summary: ExamSummary
  } | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  /**
   * Parse conversation log content from the generated log file
   * This would normally fetch from an API endpoint, but for now we'll show a mock
   */
  const fetchLogData = React.useCallback(async () => {
    if (!isVisible || !sessionId) return

    setIsLoading(true)
    setError(null)

          try {
        // Fetch complete session results with questions and answers
        const sessionData = await examAPI.getSessionResults(sessionId)
        
        if (!sessionData.questions_data || !sessionData.answers_data) {
          throw new Error('No exam data found for this session')
        }

        // Transform session data into conversation log format
        const entries: LogEntry[] = []
        const questions = sessionData.questions_data || []
        const answers = sessionData.answers_data || []

      // Create a map of answers by question_id for efficient lookup
      const answersMap = new Map()
      answers.forEach((answer: any) => {
        answersMap.set(answer.question_id, answer)
      })

      // Build entries from questions and their corresponding answers
      questions.forEach((question: any, index: number) => {
        const answer = answersMap.get(question.id)
        if (answer) {
          entries.push({
            questionNumber: index + 1,
            questionText: question.text || 'Question text not available',
            studentAnswer: answer.answer || 'No answer provided',
            proposedSolution: question.correct_answer || 'Solution not available',
            explanation: question.explanation || undefined,
            isCorrect: answer.is_correct || false,
            score: answer.score || 0,
            aiFeedback: answer.feedback || undefined,
            timeTaken: answer.time_taken || undefined,
            confidence: answer.confidence_level || undefined
          })
        }
      })

      // Calculate summary statistics
      const totalQuestions = questions.length
      const questionsAnswered = entries.length
      const correctAnswers = entries.filter(entry => entry.isCorrect).length
      const accuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0
      const totalScore = entries.reduce((sum, entry) => sum + (entry.score || 0), 0)
      const finalScore = questionsAnswered > 0 ? Number((totalScore / questionsAnswered).toFixed(2)) : 0

      const logData = {
        entries,
        summary: {
          totalQuestions,
          questionsAnswered,
          correctAnswers,
          accuracy,
          finalScore
        }
      }

      setLogData(logData)
    } catch (err) {
      setError('Failed to load conversation log: ' + (err instanceof Error ? err.message : 'Unknown error'))
      console.error('Error loading conversation log:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, isVisible])

  React.useEffect(() => {
    fetchLogData()
  }, [fetchLogData])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Exam Conversation Log</h2>
              <p className="text-blue-100">Session ID: {sessionId}</p>
              {logFilePath && (
                <p className="text-blue-100 text-sm mt-1">Saved to: {logFilePath}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading conversation log...</span>
            </div>
          )}

          {error && (
            <div className="p-6 text-center text-red-600">
              <XCircle className="w-12 h-12 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          )}

          {logData && (
            <div className="p-6">
              {/* Summary Section */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-8">
                <div className="flex items-center mb-4">
                  <Award className="w-6 h-6 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Exam Summary</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{logData.summary.totalQuestions}</div>
                    <div className="text-sm text-gray-600">Total Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{logData.summary.questionsAnswered}</div>
                    <div className="text-sm text-gray-600">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{logData.summary.correctAnswers}</div>
                    <div className="text-sm text-gray-600">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{logData.summary.accuracy}%</div>
                    <div className="text-sm text-gray-600">Accuracy</div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="text-3xl font-bold text-indigo-600">
                    {logData.summary.finalScore.toFixed(1)}/10
                  </div>
                  <div className="text-sm text-gray-600">Final Score</div>
                </div>
              </div>

              {/* Questions and Answers */}
              <div className="space-y-8">
                {logData.entries.map((entry, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Question Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                          <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                          Question {entry.questionNumber}
                        </h4>
                        <div className="flex items-center space-x-4">
                          {entry.timeTaken && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Clock className="w-4 h-4 mr-1" />
                              {entry.timeTaken}s
                            </div>
                          )}
                          {entry.isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                      {/* Question Text */}
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Question:</h5>
                        <p className="text-gray-700 bg-blue-50 p-4 rounded-lg">
                          {entry.questionText}
                        </p>
                      </div>

                      {/* Student Answer */}
                      <div>
                        <div className="flex items-center mb-2">
                          <User className="w-4 h-4 mr-2 text-blue-600" />
                          <h5 className="font-medium text-gray-900">Your Answer:</h5>
                        </div>
                        <p className="text-gray-700 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                          {entry.studentAnswer}
                        </p>
                      </div>

                      {/* Proposed Solution */}
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Proposed Solution:</h5>
                        <p className="text-gray-700 bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                          {entry.proposedSolution}
                        </p>
                      </div>

                      {/* Explanation */}
                      {entry.explanation && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Explanation:</h5>
                          <p className="text-gray-600 bg-gray-50 p-4 rounded-lg italic">
                            {entry.explanation}
                          </p>
                        </div>
                      )}

                      {/* AI Feedback */}
                      {entry.aiFeedback && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">AI Feedback:</h5>
                          <p className="text-gray-700 bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
                            {entry.aiFeedback}
                          </p>
                        </div>
                      )}

                      {/* Evaluation */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-3">Evaluation:</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Correct:</span>
                            <span className={`ml-2 ${entry.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.isCorrect ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Score:</span>
                            <span className="ml-2 text-blue-600">{entry.score.toFixed(1)}/10</span>
                          </div>
                          {entry.confidence && (
                            <div>
                              <span className="font-medium">Confidence:</span>
                              <span className="ml-2 text-purple-600">{entry.confidence}/5</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConversationLogDisplay 