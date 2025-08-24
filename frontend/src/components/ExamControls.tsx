/**
 * Exam Controls Component
 * 
 * This component provides control buttons and status information
 * for managing the exam session flow.
 * 
 * Author: AI Assistant
 */

import { Play, SkipForward, CheckCircle, Clock, BookOpen } from 'lucide-react'

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
    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl p-8 space-y-8 hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-3xl">
      {/* Exam header */}
      <div className="text-center border-b border-white/30 pb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 bg-clip-text text-transparent mb-3">
          Oral Examination
        </h2>
        {materialTitle && (
          <div className="flex items-center justify-center space-x-3 text-gray-600">
            <div className="p-2 bg-blue-100/50 rounded-full backdrop-blur-sm">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-base font-medium">{materialTitle}</span>
          </div>
        )}
      </div>

      {/* Status and progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current status */}
        <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg hover:bg-white/80 transition-all duration-300">
          <div className="mb-3">
            <div className="text-lg font-semibold text-gray-700 mb-1">Status</div>
            <div className="text-2xl font-bold">
              <span className={getStatusColor(examStatus)}>
                {examStatus.replace('_', ' ').charAt(0).toUpperCase() + examStatus.replace('_', ' ').slice(1).toLowerCase()}
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-600 font-medium bg-gray-50/60 backdrop-blur-sm rounded-lg px-3 py-2">
            {getCurrentActivity()}
          </div>
        </div>

        {/* Progress */}
        <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg hover:bg-white/80 transition-all duration-300">
          <div className="mb-3">
            <div className="text-lg font-semibold text-gray-700 mb-1">Progress</div>
            <div className="text-2xl font-bold text-gray-900">
              {currentQuestionNumber}/{totalQuestions}
            </div>
          </div>
          <div className="text-sm text-gray-600 font-medium bg-gray-50/60 backdrop-blur-sm rounded-lg px-3 py-2 mb-3">
            Questions • {progressPercentage}% Complete
          </div>
          {totalQuestions > 0 && (
            <div className="w-full bg-gray-200/60 backdrop-blur-sm rounded-full h-3 shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 shadow-lg"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg hover:bg-white/80 transition-all duration-300">
          <div className="mb-3">
            <div className="text-lg font-semibold text-gray-700 mb-1">Duration</div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {formatDuration(examDuration)}
            </div>
          </div>
          <div className="text-sm text-gray-600 font-medium bg-gray-50/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-center space-x-2">
            <div className="p-1 bg-gray-100/50 rounded-full backdrop-blur-sm">
              <Clock className="w-3 h-3" />
            </div>
            <span>Elapsed Time</span>
          </div>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {examStatus === 'not_started' && (
          <button
            onClick={onStartExam}
            disabled={!canStartExam || disabled}
            className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 
                     disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl 
                     font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 backdrop-blur-sm border border-white/20"
          >
            <Play className="w-6 h-6" />
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
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 
                         disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl 
                         font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 backdrop-blur-sm border border-white/20"
              >
                <SkipForward className="w-5 h-5" />
                <span>Skip</span>
              </button>
            )}

            {/* Complete exam button */}
            <button
              onClick={onCompleteExam}
              disabled={disabled || isRecording || isExaminerSpeaking}
              className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 
                       disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl 
                       font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 backdrop-blur-sm border border-white/20"
            >
              <CheckCircle className="w-6 h-6" />
              <span>Complete Exam</span>
            </button>
          </>
        )}

        {examStatus === 'completed' && onRestartExam && (
          <button
            onClick={onRestartExam}
            disabled={disabled}
            className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 
                     disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl 
                     font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 backdrop-blur-sm border border-white/20"
          >
            <Play className="w-6 h-6" />
            <span>Start New Exam</span>
          </button>
        )}
      </div>


    </div>
  )
}

export default ExamControls 