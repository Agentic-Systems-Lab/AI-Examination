/**
 * Results Page Component
 * 
 * This page displays comprehensive exam results, score breakdowns,
 * and allows students to submit feedback.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import * as examAPI from '../services/examAPI'
import { getDisplayTitle } from '../utils/textUtils'
import toast from 'react-hot-toast'

interface QuestionDetail {
  question_number: number
  question_text: string
  question_type: string
  difficulty_level: number
  student_answer: string
  correct_answer: string
  explanation: string
  is_correct: boolean
  score: number
  feedback: string
  confidence_level?: number
  time_taken?: number
}

interface ExamResults {
  finalScore: number
  accuracy: number
  grade: string
  totalQuestions: number
  questionsAnswered: number
  correctAnswers: number
  materialTitle: string
  questionDetails?: QuestionDetail[]
}

function ResultsPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()
  const [results, setResults] = useState<ExamResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Overall Survey State
  const [fairness, setFairness] = useState<number>(0)
  const [aiAccuracy, setAiAccuracy] = useState<number>(0)
  const [comments, setComments] = useState('')
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)

  // Per-Question Survey State
  const [questionSurveys, setQuestionSurveys] = useState<{[key: number]: {
    fairness: number
    aiAccuracy: number
    comments: string
    submitted: boolean
  }}>({})
  const [submittingQuestionSurvey, setSubmittingQuestionSurvey] = useState<number | null>(null)

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
        const scoreReport = await examAPI.getScoreReport(parseInt(sessionId))
        
        const totalQuestions = scoreReport.summary?.total_questions || 0
        const questionsAnswered = scoreReport.summary?.questions_answered || 0
        const correctAnswers = scoreReport.summary?.correct_answers || 0
        const accuracy = scoreReport.summary?.accuracy_percentage || 0
        
        const finalScore = scoreReport.final_score || 0
        const grade = calculateGrade(finalScore)

        setResults({
          finalScore,
          accuracy,
          grade,
          totalQuestions,
          questionsAnswered,
          correctAnswers,
          materialTitle: scoreReport.material_title || 'Unknown Material',
          questionDetails: scoreReport.question_details || []
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

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId) return
    
    setIsSubmittingSurvey(true)
    try {
        await examAPI.submitSurvey({
            fairness_rating: fairness,
            ai_accuracy_rating: aiAccuracy,
            comments,
            session_id: parseInt(sessionId)
        })
        setSurveySubmitted(true)
        toast.success('Feedback submitted successfully!')
    } catch (error) {
        console.error('Failed to submit survey:', error)
        toast.error('Failed to submit feedback. Please try again.')
    } finally {
        setIsSubmittingSurvey(false)
    }
  }

  const handleQuestionSurveySubmit = async (questionNumber: number) => {
    if (!sessionId) return
    
    const survey = questionSurveys[questionNumber]
    if (!survey || survey.fairness === 0 || survey.aiAccuracy === 0) {
      toast.error('Please provide ratings for both questions.')
      return
    }
    
    setSubmittingQuestionSurvey(questionNumber)
    try {
        await examAPI.submitSurvey({
            fairness_rating: survey.fairness,
            ai_accuracy_rating: survey.aiAccuracy,
            comments: survey.comments,
            session_id: parseInt(sessionId),
            question_number: questionNumber
        })
        
        setQuestionSurveys(prev => ({
          ...prev,
          [questionNumber]: { ...prev[questionNumber], submitted: true }
        }))
        
        toast.success(`Feedback for Question ${questionNumber} submitted!`)
    } catch (error) {
        console.error('Failed to submit question survey:', error)
        toast.error('Failed to submit feedback. Please try again.')
    } finally {
        setSubmittingQuestionSurvey(null)
    }
  }

  const updateQuestionSurvey = (questionNumber: number, field: 'fairness' | 'aiAccuracy' | 'comments', value: number | string) => {
    setQuestionSurveys(prev => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        fairness: prev[questionNumber]?.fairness || 0,
        aiAccuracy: prev[questionNumber]?.aiAccuracy || 0,
        comments: prev[questionNumber]?.comments || '',
        submitted: prev[questionNumber]?.submitted || false,
        [field]: value
      }
    }))
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner /></div>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Results</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Results Section */}
        {results && (
            <div className="bg-white shadow rounded-lg p-8">
              <div className="text-center mb-8">
                 <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
                 <p className="text-gray-500 mt-2">{results.materialTitle}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-blue-600">{results.finalScore}/10</div>
                  <div className="text-sm text-blue-800 font-medium">Final Score</div>
                </div>
                
                <div className="bg-green-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-600">{results.accuracy}%</div>
                  <div className="text-sm text-green-800 font-medium">Accuracy</div>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-purple-600">{results.grade}</div>
                  <div className="text-sm text-purple-800 font-medium">Grade</div>
                </div>
              </div>

              <div className="border-t pt-6">
                 <h3 className="text-lg font-semibold mb-4">Summary</h3>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Total Questions: <span className="font-bold">{results.totalQuestions}</span></div>
                    <div>Correct Answers: <span className="font-bold">{results.correctAnswers}</span></div>
                 </div>
              </div>
            </div>
        )}

        {/* Detailed Question Results */}
        {results && results.questionDetails && results.questionDetails.length > 0 && (
          <div className="bg-white shadow rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Question-by-Question Results</h2>
            <div className="space-y-6">
              {results.questionDetails.map((question, index) => {
                const isUnanswered = question.student_answer === '(Not answered)' || !question.student_answer
                return (
                <div 
                  key={index} 
                  className={`border rounded-lg p-6 ${
                    isUnanswered 
                      ? 'border-gray-300 bg-gray-50' 
                      : question.is_correct 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Question {question.question_number}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isUnanswered
                          ? 'bg-gray-200 text-gray-700'
                          : question.is_correct 
                            ? 'bg-green-200 text-green-800' 
                            : 'bg-red-200 text-red-800'
                      }`}>
                        {isUnanswered ? '⊘ Not Answered' : question.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-200 text-blue-800">
                        Score: {question.score.toFixed(1)}/10
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <p className="text-gray-700 font-medium">{question.question_text}</p>
                  </div>

                  {/* Your Answer */}
                  <div className="mb-4 bg-white rounded p-4 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Your Answer:</p>
                    <p className="text-gray-800">{question.student_answer || '(No answer provided)'}</p>
                  </div>

                  {/* Correct Answer */}
                  <div className="mb-4 bg-white rounded p-4 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Proposed Solution:</p>
                    <p className="text-gray-800">{question.correct_answer}</p>
                  </div>

                  {/* AI Feedback */}
                  {question.feedback && (
                    <div className="bg-white rounded p-4 border border-blue-200">
                      <p className="text-sm font-semibold text-blue-600 mb-2">AI Feedback:</p>
                      <p className="text-gray-700 text-sm">{question.feedback}</p>
                    </div>
                  )}

                  {/* Explanation */}
                  {question.explanation && (
                    <div className="mt-4 bg-white rounded p-4 border border-gray-200">
                      <p className="text-sm font-semibold text-gray-600 mb-2">Explanation:</p>
                      <p className="text-gray-700 text-sm">{question.explanation}</p>
                    </div>
                  )}

                  {/* Per-Question Survey */}
                  <div className="mt-6 pt-6 border-t border-gray-300">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Question Feedback</h4>
                    
                    {questionSurveys[question.question_number]?.submitted ? (
                      <div className="bg-green-50 rounded p-4 text-center">
                        <div className="text-green-500 text-2xl mb-2">✓</div>
                        <p className="text-sm text-green-700 font-medium">Thank you for your feedback!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Was this question fair? (1-5)
                          </label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => updateQuestionSurvey(question.question_number, 'fairness', rating)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs ${
                                  questionSurveys[question.question_number]?.fairness === rating
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Did the AI assess your answer correctly? (1-5)
                          </label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => updateQuestionSurvey(question.question_number, 'aiAccuracy', rating)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs ${
                                  questionSurveys[question.question_number]?.aiAccuracy === rating
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Comments (optional)
                          </label>
                          <textarea
                            rows={2}
                            className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            value={questionSurveys[question.question_number]?.comments || ''}
                            onChange={(e) => updateQuestionSurvey(question.question_number, 'comments', e.target.value)}
                            placeholder="Share your thoughts about this question..."
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuestionSurveySubmit(question.question_number)}
                          disabled={
                            submittingQuestionSurvey === question.question_number ||
                            !questionSurveys[question.question_number]?.fairness ||
                            !questionSurveys[question.question_number]?.aiAccuracy
                          }
                          className="w-full py-2 px-4 border border-transparent rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingQuestionSurvey === question.question_number ? 'Submitting...' : 'Submit Question Feedback'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Survey Section */}
        <div className="bg-white shadow rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Feedback</h2>
            
            {surveySubmitted ? (
                <div className="text-center py-8">
                    <div className="text-green-500 text-5xl mb-4">✓</div>
                    <h3 className="text-xl font-semibold text-gray-900">Thank You!</h3>
                    <p className="text-gray-500 mt-2">Your feedback has been recorded.</p>
                    <button 
                        onClick={() => navigate('/upload')}
                        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Start New Exam
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSurveySubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Was the exam fair? (1-5)
                        </label>
                        <div className="flex gap-4">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    type="button"
                                    onClick={() => setFairness(rating)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                                        fairness === rating 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Did the AI assess you correctly? (1-5)
                        </label>
                        <div className="flex gap-4">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    type="button"
                                    onClick={() => setAiAccuracy(rating)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                                        aiAccuracy === rating 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                            Additional Comments
                        </label>
                        <textarea
                            id="comments"
                            rows={4}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Share your thoughts..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmittingSurvey || fairness === 0 || aiAccuracy === 0}
                        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmittingSurvey ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                </form>
            )}
        </div>

      </div>
    </div>
  )
}

export default ResultsPage
