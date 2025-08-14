/**
 * Exam Controls Component
 * 
 * This component provides control buttons and status information
 * for managing the exam session flow.
 * 
 * Author: AI Assistant
 */

import React from 'react'
import { Play, Square, SkipForward, CheckCircle, Clock, BookOpen, User } from 'lucide-react'

interface ExamControlsProps {
  /** Current exam session status */
  examStatus: 'not_started' | 'started' | 'in_progress' | 'completed'
  /** Current question number (1-indexed) */
  currentQuestionNumber: number
  /** Total number of questions */
  totalQuestions: number
  /** Number of questions answered */
  answeredQuestions: number
  /** Whether the exam can be started */
  canStartExam: boolean
  /** Whether recording is in progress */
  isRecording: boolean
  /** Whether examiner is speaking */
  isExaminerSpeaking: boolean
  /** Whether transcription is in progress */
  isTranscribing: boolean
  /** Material title */
  materialTitle?: string
  /** Exam duration in seconds */
  examDuration?: number
  /** Callback to start the exam */
  onStartExam: () => void
  /** Callback to complete the exam */
  onCompleteExam: () => void
  /** Callback to skip current question */
  onSkipQuestion?: () => void
  /** Callback to restart exam */
  onRestartExam?: () => void
  /** Disabled state */
  disabled?: boolean
}

/**
 * ExamControls Component
 * 
 * Provides exam session control buttons and displays current status,
 * progress information, and timing details.
 */
function ExamControls({
  examStatus,
  currentQuestionNumber,
  totalQuestions,
  answeredQuestions,
  canStartExam,
  isRecording,
  isExaminerSpeaking,
  isTranscribing,
  materialTitle,
  examDuration = 0,
  onStartExam,
  onCompleteExam,
  onSkipQuestion,
  onRestartExam,
  disabled = false
}: ExamControlsProps) {

  /**
   * Format duration in MM:SS format
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Calculate progress percentage
   */
  const progressPercentage = totalQuestions > 0 
    ? Math.round((answeredQuestions / totalQuestions) * 100)
    : 0

  /**
   * Get status color for different states
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'text-gray-600'
      case 'started': return 'text-blue-600'
      case 'in_progress': return 'text-green-600'
      case 'completed': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  /**
   * Get current activity description
   */
  const getCurrentActivity = (): string => {
    if (examStatus === 'not_started') return 'Ready to begin'
    if (examStatus === 'completed') return 'Exam completed'
    if (isExaminerSpeaking) return 'Examiner asking question'
    if (isRecording) return 'Recording your answer'
    if (isTranscribing) return 'Processing your response'
    return 'Waiting for your response'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      {/* Exam header */}
      <div className="text-center border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Oral Examination
        </h2>
        {materialTitle && (
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">{materialTitle}</span>
          </div>
        )}
      </div>

      {/* Status and progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current status */}
        <div className="text-center">
          <div className="text-2xl font-bold mb-1">
            <span className={getStatusColor(examStatus)}>
              {examStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {getCurrentActivity()}
          </div>
        </div>

        {/* Progress */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {currentQuestionNumber}/{totalQuestions}
          </div>
          <div className="text-sm text-gray-600">
            Questions ({progressPercentage}% complete)
          </div>
          {totalQuestions > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatDuration(examDuration)}
          </div>
          <div className="text-sm text-gray-600 flex items-center justify-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Duration</span>
          </div>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        {examStatus === 'not_started' && (
          <button
            onClick={onStartExam}
            disabled={!canStartExam || disabled}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 
                     disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg 
                     font-medium transition-colors shadow-md hover:shadow-lg"
          >
            <Play className="w-5 h-5" />
            <span>Start Exam</span>
          </button>
        )}

        {(examStatus === 'started' || examStatus === 'in_progress') && (
          <>
            {/* Skip question button */}
            {onSkipQuestion && currentQuestionNumber <= totalQuestions && (
              <button
                onClick={onSkipQuestion}
                disabled={disabled || isRecording || isExaminerSpeaking}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 
                         disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg 
                         transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>Skip</span>
              </button>
            )}

            {/* Complete exam button */}
            <button
              onClick={onCompleteExam}
              disabled={disabled || isRecording || isExaminerSpeaking}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 
                       disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg 
                       font-medium transition-colors shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Complete Exam</span>
            </button>
          </>
        )}

        {examStatus === 'completed' && onRestartExam && (
          <button
            onClick={onRestartExam}
            disabled={disabled}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg 
                     font-medium transition-colors shadow-md hover:shadow-lg"
          >
            <Play className="w-5 h-5" />
            <span>Start New Exam</span>
          </button>
        )}
      </div>

      {/* Activity indicators */}
      {(examStatus === 'started' || examStatus === 'in_progress') && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-center space-x-6 text-sm">
            {/* Examiner status */}
            <div className={`flex items-center space-x-2 ${
              isExaminerSpeaking ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isExaminerSpeaking ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'
              }`} />
              <span>Examiner</span>
            </div>

            {/* Student status */}
            <div className={`flex items-center space-x-2 ${
              isRecording ? 'text-red-600' : isTranscribing ? 'text-yellow-600' : 'text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isRecording 
                  ? 'bg-red-600 animate-pulse' 
                  : isTranscribing 
                    ? 'bg-yellow-600 animate-spin' 
                    : 'bg-gray-400'
              }`} />
              <User className="w-3 h-3" />
              <span>
                {isRecording ? 'Recording' : isTranscribing ? 'Processing' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {examStatus === 'not_started' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Instructions:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click "Start Exam" to begin</li>
            <li>• The examiner will read each question aloud</li>
            <li>• Use the microphone to record your answers</li>
            <li>• The system will detect when you stop speaking</li>
            <li>• You can complete the exam at any time</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default ExamControls 