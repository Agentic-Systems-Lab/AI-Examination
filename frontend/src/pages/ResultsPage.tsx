/**
 * Results Page Component
 * 
 * This page displays comprehensive exam results, score breakdowns,
 * performance analytics, and AI-generated recommendations.
 * 
 * Author: AI Assistant
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import * as examAPI from '../services/examAPI'

interface ExamResults {
  finalScore: number
  accuracy: number
  grade: string
  totalQuestions: number
  questionsAnswered: number
  correctAnswers: number
  materialTitle: string
}

function ResultsPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const [results, setResults] = useState<ExamResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Function to calculate letter grade based on score
  const calculateGrade = (score: number): string => {
    if (score >= 9.0) return 'A+'
    if (score >= 8.5) return 'A'
    if (score >= 8.0) return 'A-'
    if (score >= 7.5) return 'B+'
    if (score >= 7.0) return 'B'
    if (score >= 6.5) return 'B-'
    if (score >= 6.0) return 'C+'
    if (score >= 5.5) return 'C'
    if (score >= 5.0) return 'C-'
    if (score >= 4.0) return 'D'
    return 'F'
  }

  useEffect(() => {
    const fetchResults = async () => {
      if (!sessionId) return

      setIsLoading(true)
      setError(null)

      try {
        const sessionData = await examAPI.getSessionResults(parseInt(sessionId))
        
        if (!sessionData.answers_data || !sessionData.questions_data) {
          throw new Error('No exam data found for this session')
        }

        const questions = sessionData.questions_data || []
        const answers = sessionData.answers_data || []

        // Calculate statistics
        const totalQuestions = questions.length
        const questionsAnswered = answers.length
        const correctAnswers = answers.filter((answer: any) => answer.is_correct).length
        const accuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0
        
        // Calculate average score
        const totalScore = answers.reduce((sum: number, answer: any) => sum + (answer.score || 0), 0)
        const finalScore = questionsAnswered > 0 ? Number((totalScore / questionsAnswered).toFixed(1)) : 0
        
        const grade = calculateGrade(finalScore)

        setResults({
          finalScore,
          accuracy,
          grade,
          totalQuestions,
          questionsAnswered,
          correctAnswers,
          materialTitle: sessionData.material_title || 'Unknown Material'
        })
      } catch (err) {
        setError('Failed to load exam results: ' + (err instanceof Error ? err.message : 'Unknown error'))
        console.error('Error loading exam results:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="exam-container">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-gray-600 mt-4">Loading exam results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="exam-container">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              📊 Exam Results
            </h1>
            <div className="card max-w-2xl mx-auto">
              <div className="text-red-600 mb-4">❌ Error</div>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="exam-container">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📊 Exam Results & Analytics
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Comprehensive score report with performance analytics powered by AI evaluation.
          </p>
          
          {sessionId && results && (
            <div className="card max-w-4xl mx-auto">
              <h2 className="text-xl font-semibold mb-4">
                Results for {results.materialTitle} - Session: {sessionId}
              </h2>
              <p className="text-gray-600 mb-6">
                Your exam has been evaluated using advanced AI scoring that considers accuracy, 
                understanding, context relevance, and completeness.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary-50 p-6 rounded-lg">
                  <div className="text-3xl font-bold text-primary-600 mb-2">
                    {results.finalScore}
                  </div>
                  <div className="text-primary-800 font-medium">Final Score</div>
                  <div className="text-sm text-primary-600">Out of 10</div>
                </div>
                
                <div className="bg-success-50 p-6 rounded-lg">
                  <div className="text-3xl font-bold text-success-600 mb-2">
                    {results.accuracy}%
                  </div>
                  <div className="text-success-800 font-medium">Accuracy</div>
                  <div className="text-sm text-success-600">
                    {results.correctAnswers}/{results.questionsAnswered} correct
                  </div>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {results.grade}
                  </div>
                  <div className="text-purple-800 font-medium">Grade</div>
                  <div className="text-sm text-purple-600">Performance Level</div>
                </div>
              </div>

              <div className="mt-8 text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Total Questions:</span>
                    <div className="text-xl font-bold text-gray-900">{results.totalQuestions}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Answered:</span>
                    <div className="text-xl font-bold text-blue-600">{results.questionsAnswered}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Correct:</span>
                    <div className="text-xl font-bold text-green-600">{results.correctAnswers}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">AI Score:</span>
                    <div className="text-xl font-bold text-indigo-600">{results.finalScore}/10</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResultsPage 