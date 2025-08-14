/**
 * QuestionsPopup Component
 * 
 * A modal component for viewing and editing questions with their proposed solutions.
 * This component provides a clean, simple interface for question management.
 * 
 * Features:
 * - View questions in a list format
 * - Edit question text, answers, and explanations
 * - Simple save functionality
 * - Responsive design with good UX
 */

import { useState, useEffect } from 'react'
import { Question, Material } from '../contexts/ExamContext'
import * as examAPI from '../services/examAPI'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'

interface QuestionsPopupProps {
  /** Whether the popup is visible */
  isVisible: boolean
  /** Function to close the popup */
  onClose: () => void
  /** The material to show questions for */
  material: Material | null
}

interface EditableQuestion extends Question {
  /** Flag to track if this question has been modified */
  isModified: boolean
  /** Flag to track if this question is marked for deletion */
  isDeleted: boolean
}

/**
 * Modal popup for viewing and editing questions with solutions
 */
function QuestionsPopup({ isVisible, onClose, material }: QuestionsPopupProps) {
  const [questions, setQuestions] = useState<EditableQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false)

  /**
   * Fetch questions for the current material
   */
  const fetchQuestions = async () => {
    if (!material) return

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await examAPI.getQuestionsForMaterial(material.id)
      const questionsWithEditFlag = response.questions.map(q => ({
        ...q,
        isModified: false,
        isDeleted: false
      }))
      setQuestions(questionsWithEditFlag)
    } catch (err) {
      setError('Failed to load questions. Please ensure questions have been generated for this material.')
      console.error('Error loading questions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Update a specific question field
   */
  const updateQuestion = (questionId: number, field: keyof Question, value: string | string[]) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { ...q, [field]: value, isModified: true }
        : q
    ))
  }

  /**
   * Mark a question for deletion (toggle deleted state)
   */
  const toggleDeleteQuestion = (questionId: number) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            isDeleted: !q.isDeleted,
            isModified: q.isDeleted ? q.isModified : true // Keep modified state if undeleting, mark as modified if deleting
          }
        : q
    ))
  }

  /**
   * Handle saving modified and deleted questions
   */
  const handleSave = async () => {
    if (!material) return
    
    const modifiedQuestions = questions.filter(q => q.isModified && !q.isDeleted)
    const deletedQuestionIds = questions.filter(q => q.isDeleted).map(q => q.id)
    
    if (modifiedQuestions.length === 0 && deletedQuestionIds.length === 0) {
      return
    }

    setIsSaving(true)
    try {
      // Prepare updates (remove non-database fields)
      const updates = modifiedQuestions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty_level: q.difficulty_level
      }))
      
      // Call bulk update API
      const result = await examAPI.bulkUpdateQuestions(material.id, updates, deletedQuestionIds)
      
      console.log('Bulk update result:', result)
      
      // Remove deleted questions from state and reset modified flags
      setQuestions(prev => prev
        .filter(q => !q.isDeleted)
        .map(q => ({ ...q, isModified: false }))
      )
      
      // Show success message with detailed information
      toast.success(
        `Successfully saved changes! ${result.updated_count} updated, ${result.deleted_count} deleted.`,
        { duration: 4000 }
      )
      
      // Log detailed information for debugging
      console.log('🔍 Bulk update completed:', {
        updated: result.updated_count,
        deleted: result.deleted_count,
        total_operations: result.total_operations,
        errors: result.errors,
        remaining_questions: questions.filter(q => !q.isDeleted).length
      })
      
      // Optionally call diagnostic endpoint to verify database state
      try {
        const count = await examAPI.getQuestionCount(material.id)
        console.log('📊 Database verification:', count)
      } catch (err) {
        console.warn('Could not verify database state:', err)
      }
      
      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        console.warn('Some operations had errors:', result.errors)
        toast.error('Some operations had errors. Check the console for details.')
      }
      
    } catch (err) {
      console.error('Error saving questions:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error(`Failed to save questions: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Question templates for different question types
   */
  const getQuestionTemplate = (type: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false'): Omit<Question, 'id'> => {
    const baseTemplate = {
      text: '',
      correct_answer: '',
      explanation: '',
      difficulty_level: 3
    }

    switch (type) {
      case 'multiple_choice':
        return {
          ...baseTemplate,
          type: 'multiple_choice' as const,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          text: 'Enter your multiple choice question here...',
          correct_answer: 'A',
          explanation: 'Explain why option A is correct...'
        }
      case 'short_answer':
        return {
          ...baseTemplate,
          type: 'short_answer' as const,
          text: 'Enter your short answer question here...',
          correct_answer: 'Enter the correct answer (1-3 sentences)...',
          explanation: 'Provide additional context and explanation...'
        }
      case 'essay':
        return {
          ...baseTemplate,
          type: 'essay' as const,
          text: 'Enter your essay question here...',
          correct_answer: 'Provide key points that should be covered in a good answer...',
          explanation: 'Explain the key concepts and provide guidance for evaluation...'
        }
      case 'true_false':
        return {
          ...baseTemplate,
          type: 'true_false' as const,
          text: 'Enter your true/false statement here...',
          correct_answer: 'True',
          explanation: 'Explain why this statement is true or false...'
        }
      default:
        return {
          ...baseTemplate,
          type: 'short_answer' as const
        }
    }
  }

  /**
   * Handle adding a new question of the specified type
   */
  const handleAddQuestion = async (questionType: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false') => {
    if (!material) return

    setIsCreatingQuestion(true)
    try {
      const questionTemplate = getQuestionTemplate(questionType)
      const response = await examAPI.createQuestion(material.id, questionTemplate)
      
      // Add the new question to the questions list
      const newEditableQuestion: EditableQuestion = {
        ...response.question,
        isModified: false,
        isDeleted: false
      }
      
      setQuestions(prev => [...prev, newEditableQuestion])
      setShowAddQuestion(false)
      
      toast.success(`New ${questionType.replace('_', ' ')} question added successfully!`, {
        duration: 3000
      })
      
    } catch (err) {
      console.error('Error creating question:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create question'
      toast.error(`Failed to add question: ${errorMessage}`)
    } finally {
      setIsCreatingQuestion(false)
    }
  }

  /**
   * Load questions when popup becomes visible or material changes
   */
  useEffect(() => {
    if (isVisible && material) {
      fetchQuestions()
    }
  }, [isVisible, material])

  /**
   * Close add question dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAddQuestion) {
        // Check if clicked element is not part of the dropdown
        const target = event.target as Element
        const dropdown = document.querySelector('[data-add-question-dropdown]')
        const button = document.querySelector('[data-add-question-button]')
        
        if (dropdown && button && !dropdown.contains(target) && !button.contains(target)) {
          setShowAddQuestion(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddQuestion])

  // Don't render if not visible
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <h2 className="text-xl font-semibold">
            📝 Questions & Solutions
            {material && (
              <span className="text-sm font-normal text-blue-100 ml-2 block sm:inline">
                {material.title}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {/* Add Question Button */}
            <div className="relative">
              <button
                onClick={() => setShowAddQuestion(!showAddQuestion)}
                disabled={isCreatingQuestion}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-white border-opacity-30 hover:border-opacity-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Add new question"
                data-add-question-button
              >
                {isCreatingQuestion ? (
                  <>
                    <LoadingSpinner size="small" color="white" />
                    <span className="hidden sm:inline">Adding...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">➕</span>
                    <span className="hidden sm:inline">Add Question</span>
                  </>
                )}
              </button>
              
              {/* Question Type Dropdown */}
              {showAddQuestion && !isCreatingQuestion && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-48 z-50" data-add-question-dropdown>
                  <div className="px-4 py-2 text-gray-700 font-medium border-b border-gray-100">
                    Select Question Type:
                  </div>
                  
                  <button
                    onClick={() => handleAddQuestion('multiple_choice')}
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-150 flex items-center gap-3"
                  >
                    <span className="text-emerald-600">🔄</span>
                    <div>
                      <div className="font-medium">Multiple Choice</div>
                      <div className="text-xs text-gray-500">4 options with one correct answer</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleAddQuestion('short_answer')}
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150 flex items-center gap-3"
                  >
                    <span className="text-blue-600">✏️</span>
                    <div>
                      <div className="font-medium">Short Answer</div>
                      <div className="text-xs text-gray-500">1-3 sentence answers</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleAddQuestion('essay')}
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors duration-150 flex items-center gap-3"
                  >
                    <span className="text-purple-600">📄</span>
                    <div>
                      <div className="font-medium">Essay</div>
                      <div className="text-xs text-gray-500">Detailed explanations required</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleAddQuestion('true_false')}
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-150 flex items-center gap-3"
                  >
                    <span className="text-orange-600">✅</span>
                    <div>
                      <div className="font-medium">True / False</div>
                      <div className="text-xs text-gray-500">True or false with explanation</div>
                    </div>
                  </button>
                  
                  <div className="border-t border-gray-100 mt-2 pt-2">
                    <button
                      onClick={() => setShowAddQuestion(false)}
                      className="w-full text-left px-4 py-2 text-gray-500 hover:bg-gray-50 transition-colors duration-150 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={onClose}
              className="text-blue-100 hover:text-white text-2xl font-bold transition-colors duration-200 hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ maxHeight: 'calc(95vh - 140px)', scrollBehavior: 'smooth' }}>
          {isLoading ? (
            <div className="text-center py-12">
              <LoadingSpinner />
              <p className="text-gray-600 mt-4">Loading questions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-6">
              <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <div className="text-red-500 text-4xl">⚠️</div>
              </div>
              <p className="text-red-700 text-lg font-medium mb-2">Error Loading Questions</p>
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={fetchQuestions}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <div className="text-gray-400 text-4xl">📚</div>
              </div>
              <p className="text-gray-700 text-lg font-medium mb-2">No Questions Found</p>
              <p className="text-gray-600 mb-2">No questions found for this material.</p>
              <p className="text-gray-500 text-sm">Generate questions first using the "Generate Questions" button.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-h-full pb-8">
              {/* Scroll Indicator */}
              {questions.length > 3 && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm">
                    <span className="mr-2">👆</span>
                    Scroll to see all {questions.length} questions
                    <span className="ml-2">👇</span>
                  </div>
                </div>
              )}
              
              {questions.map((question, index) => {
                // Color scheme based on question type and state
                const getQuestionColors = (type: string, isModified: boolean, isDeleted: boolean) => {
                  // If deleted, use red theme
                  if (isDeleted) {
                    return {
                      cardClass: 'bg-red-100 border-red-400',
                      accentClass: 'bg-red-200'
                    }
                  }
                  
                  const baseColors = {
                    multiple_choice: { 
                      bg: 'bg-emerald-50', 
                      border: 'border-emerald-200', 
                      accent: 'bg-emerald-100',
                      modifiedBg: 'bg-emerald-100',
                      modifiedBorder: 'border-emerald-400'
                    },
                    short_answer: { 
                      bg: 'bg-blue-50', 
                      border: 'border-blue-200', 
                      accent: 'bg-blue-100',
                      modifiedBg: 'bg-blue-100',
                      modifiedBorder: 'border-blue-400'
                    },
                    essay: { 
                      bg: 'bg-purple-50', 
                      border: 'border-purple-200', 
                      accent: 'bg-purple-100',
                      modifiedBg: 'bg-purple-100',
                      modifiedBorder: 'border-purple-400'
                    },
                    true_false: { 
                      bg: 'bg-orange-50', 
                      border: 'border-orange-200', 
                      accent: 'bg-orange-100',
                      modifiedBg: 'bg-orange-100',
                      modifiedBorder: 'border-orange-400'
                    }
                  }
                  
                  const colors = baseColors[type as keyof typeof baseColors] || baseColors.short_answer
                  
                  return {
                    cardClass: `${isModified ? colors.modifiedBg : colors.bg} ${isModified ? colors.modifiedBorder : colors.border}`,
                    accentClass: colors.accent
                  }
                }
                
                const colors = getQuestionColors(question.type, question.isModified, question.isDeleted)
                
                return (
                <div 
                  key={question.id} 
                  className={`border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg ${colors.cardClass}`}
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap justify-between items-center mb-4 pb-3 border-b border-gray-200">
                    <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.accentClass} text-gray-700`}>
                        Question {index + 1}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                        {question.type.replace('_', ' ').toUpperCase()}
                      </span>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-500 mr-1">Difficulty:</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <span
                              key={level}
                              className={`text-xs ${level <= question.difficulty_level ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {question.isDeleted && (
                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-full animate-pulse">
                          Marked for Deletion
                        </span>
                      )}
                      {question.isModified && !question.isDeleted && (
                        <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full animate-pulse">
                          Modified
                        </span>
                      )}
                      <button
                        onClick={() => toggleDeleteQuestion(question.id)}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          question.isDeleted 
                            ? 'bg-green-100 hover:bg-green-200 text-green-700' 
                            : 'bg-red-100 hover:bg-red-200 text-red-700'
                        }`}
                        title={question.isDeleted ? 'Restore question' : 'Mark for deletion'}
                      >
                        {question.isDeleted ? '↺' : '🗑️'}
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className={`mb-6 ${question.isDeleted ? 'opacity-50' : ''}`}>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <span className="text-indigo-600 mr-2">❓</span>
                      Question Text:
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                      disabled={question.isDeleted}
                      className={`w-full p-4 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 bg-white ${
                        question.isDeleted ? 'cursor-not-allowed bg-gray-100' : ''
                      }`}
                      rows={3}
                      placeholder="Enter your question here..."
                    />
                  </div>

                  {/* Multiple Choice Options */}
                  {question.type === 'multiple_choice' && question.options && (
                    <div className={`mb-6 ${question.isDeleted ? 'opacity-50' : ''}`}>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="text-emerald-600 mr-2">📋</span>
                        Answer Options:
                      </label>
                      <div className="space-y-3">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center space-x-3">
                            <span className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-semibold">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...question.options!]
                                newOptions[optionIndex] = e.target.value
                                updateQuestion(question.id, 'options', newOptions)
                              }}
                              disabled={question.isDeleted}
                              className={`flex-1 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors duration-200 bg-white ${
                                question.isDeleted ? 'cursor-not-allowed bg-gray-100' : ''
                              }`}
                              placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Correct Answer */}
                  <div className={`mb-6 ${question.isDeleted ? 'opacity-50' : ''}`}>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <span className="text-green-600 mr-2">✅</span>
                      Correct Answer:
                    </label>
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-1">
                      <textarea
                        value={question.correct_answer}
                        onChange={(e) => updateQuestion(question.id, 'correct_answer', e.target.value)}
                        disabled={question.isDeleted}
                        className={`w-full p-3 border-0 bg-transparent focus:ring-2 focus:ring-green-500 rounded-md transition-colors duration-200 resize-none ${
                          question.isDeleted ? 'cursor-not-allowed' : ''
                        }`}
                        rows={2}
                        placeholder="Enter the correct answer..."
                      />
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className={`mb-4 ${question.isDeleted ? 'opacity-50' : ''}`}>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <span className="text-purple-600 mr-2">💡</span>
                      Explanation:
                    </label>
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-1">
                      <textarea
                        value={question.explanation}
                        onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                        disabled={question.isDeleted}
                        className={`w-full p-3 border-0 bg-transparent focus:ring-2 focus:ring-purple-500 rounded-md transition-colors duration-200 resize-none ${
                          question.isDeleted ? 'cursor-not-allowed' : ''
                        }`}
                        rows={3}
                        placeholder="Explain why this is the correct answer and provide additional context..."
                      />
                    </div>
                  </div>
                </div>
                )
              })}
              
              {/* Bottom spacing and visual indicator */}
              <div className="text-center pt-4 pb-2">
                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-1/2 mx-auto"></div>
                <p className="text-xs text-gray-400 mt-2">End of questions</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {questions.length > 0 && (
          <div className="border-t-2 border-gray-200 p-6 bg-white">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm text-gray-600 flex items-center">
                  <span className="text-blue-500 mr-2">📊</span>
                  {questions.filter(q => q.isModified && !q.isDeleted).length} question(s) modified
                </span>
                <span className="text-sm text-gray-500 flex items-center">
                  <span className="text-gray-400 mr-2">📝</span>
                  {questions.filter(q => !q.isDeleted).length} questions remaining
                </span>
                {questions.filter(q => q.isDeleted).length > 0 && (
                  <span className="text-sm text-red-600 flex items-center">
                    <span className="text-red-500 mr-2">🗑️</span>
                    {questions.filter(q => q.isDeleted).length} marked for deletion
                  </span>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 border-2 border-gray-200 hover:border-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || questions.filter(q => q.isModified || q.isDeleted).length === 0}
                  className={`px-6 py-2 font-medium rounded-lg transition-all duration-200 border-2 ${
                    questions.filter(q => q.isModified || q.isDeleted).length === 0
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-transparent shadow-lg hover:shadow-xl transform hover:scale-105'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <LoadingSpinner size="small" color="white" />
                      <span className="ml-2">Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="mr-2">💾</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestionsPopup