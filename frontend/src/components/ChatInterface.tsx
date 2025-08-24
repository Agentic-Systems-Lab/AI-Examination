/**
 * Chat Interface Component
 * 
 * This component displays the conversation between the examiner and student
 * in a chat-style interface during the oral exam.
 * 
 * Author: AI Assistant
 */

import { useEffect, useRef } from 'react'
import { Bot, User, Volume2, VolumeX } from 'lucide-react'

export interface ChatMessage {
  id: string
  type: 'examiner' | 'student'
  content: string
  timestamp: Date
  isPlaying?: boolean
  hasAudio?: boolean
}

interface ChatInterfaceProps {
  /** Array of chat messages to display */
  messages: ChatMessage[]
  /** Whether the examiner is currently speaking */
  isExaminerSpeaking?: boolean
  /** Whether the student is currently recording */
  isStudentRecording?: boolean
  /** Callback when a message audio should be played */
  onPlayAudio?: (messageId: string) => void
  /** Callback when audio playback should be stopped */
  onStopAudio?: (messageId: string) => void
  /** Custom className for styling */
  className?: string
}

/**
 * ChatInterface Component
 * 
 * Displays the conversation history between examiner and student,
 * with support for audio playback and real-time status indicators.
 */
function ChatInterface({
  messages,
  isExaminerSpeaking = false,
  isStudentRecording = false,
  onPlayAudio,
  onStopAudio,
  className = ''
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /**
   * Auto-scroll to bottom when new messages are added
   */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      })
    }
  }, [messages])

  /**
   * Format timestamp for display
   */
  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  /**
   * Render individual chat message
   */
  const renderMessage = (message: ChatMessage) => {
    const isExaminer = message.type === 'examiner'
    
    return (
      <div
        key={message.id}
        className={`flex ${isExaminer ? 'justify-start' : 'justify-end'} mb-4`}
      >
        <div
          className={`max-w-xs lg:max-w-md xl:max-w-lg px-5 py-4 rounded-2xl shadow-lg backdrop-blur-sm border transition-all duration-300 hover:shadow-xl transform hover:scale-105 ${
            isExaminer
              ? 'bg-blue-100/80 text-blue-900 rounded-tl-none border-blue-200/50'
              : 'bg-gray-100/80 text-gray-900 rounded-tr-none border-gray-200/50'
          }`}
        >
          {/* Message header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {isExaminer ? (
                <Bot className="w-4 h-4 text-blue-600" />
              ) : (
                <User className="w-4 h-4 text-gray-600" />
              )}
              <span className="text-xs font-medium">
                {isExaminer ? 'Examiner' : 'Student'}
              </span>
            </div>
            
            {/* Audio control button */}
            {message.hasAudio && onPlayAudio && onStopAudio && (
                              <button
                onClick={() => {
                  if (message.isPlaying) {
                    onStopAudio(message.id)
                  } else {
                    onPlayAudio(message.id)
                  }
                }}
                className={`p-2 rounded-full transition-all duration-300 backdrop-blur-sm border shadow-md hover:shadow-lg transform hover:scale-110 ${
                  isExaminer
                    ? 'hover:bg-blue-200/60 text-blue-600 border-blue-200/50'
                    : 'hover:bg-gray-200/60 text-gray-600 border-gray-200/50'
                }`}
                title={message.isPlaying ? 'Stop audio' : 'Play audio'}
              >
                {message.isPlaying ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
          
          {/* Message content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          
          {/* Timestamp */}
          <div className="text-xs opacity-60 mt-2">
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    )
  }

  /**
   * Render typing indicator for examiner
   */
  const renderExaminerTyping = () => (
    <div className="flex justify-start mb-4">
      <div className="bg-blue-100/80 backdrop-blur-sm text-blue-900 px-5 py-4 rounded-2xl rounded-tl-none max-w-xs shadow-lg border border-blue-200/50 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="p-1 bg-blue-200/50 rounded-full">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-semibold">Examiner</span>
          <Volume2 className="w-4 h-4 animate-pulse text-blue-600" />
        </div>
        <div className="text-sm mt-3 flex items-center space-x-2">
          <span className="font-medium">Speaking</span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  )

  /**
   * Render recording indicator for student
   */
  const renderStudentRecording = () => (
    <div className="flex justify-end mb-4">
      <div className="bg-red-100/80 backdrop-blur-sm text-red-900 px-5 py-4 rounded-2xl rounded-tr-none max-w-xs shadow-lg border border-red-200/50 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="p-1 bg-red-200/50 rounded-full">
            <User className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-sm font-semibold">Student</span>
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-lg" />
        </div>
        <div className="text-sm mt-3 font-medium">
          Recording your response...
        </div>
      </div>
    </div>
  )

  return (
    <div 
      className={`flex flex-col h-full bg-white/90 backdrop-blur-sm border border-white/30 rounded-2xl shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/30 bg-gray-50/60 backdrop-blur-sm rounded-t-2xl">
        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Exam Conversation
        </h3>
        <div className="flex items-center space-x-3 text-sm text-gray-600">
          <div className="px-3 py-1 bg-white/50 rounded-full backdrop-blur-sm border border-white/40">
            <span className="font-medium">{messages.length} messages</span>
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{ maxHeight: '400px' }}
      >
        {/* Welcome message if no messages yet */}
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <div className="p-6 bg-blue-100/60 backdrop-blur-sm rounded-2xl border border-blue-200/50 shadow-lg mx-auto max-w-md">
              <div className="p-4 bg-white/60 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Bot className="w-12 h-12 text-blue-600" />
              </div>
              <p className="text-xl font-bold text-gray-800 mb-4">Welcome to your oral exam</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Click the microphone button to start the exam.
                The examiner will read each question aloud.
              </p>
            </div>
          </div>
        )}

        {/* Render all messages */}
        {messages.map(renderMessage)}
        
        {/* Real-time indicators */}
        {isExaminerSpeaking && renderExaminerTyping()}
        {isStudentRecording && renderStudentRecording()}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Status bar */}
      <div className="px-6 py-4 border-t border-white/30 bg-gray-50/60 backdrop-blur-sm rounded-b-2xl">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-6">
            {isExaminerSpeaking && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100/60 rounded-full backdrop-blur-sm border border-blue-200/50">
                <Volume2 className="w-3 h-3 animate-pulse text-blue-600" />
                <span className="font-medium">Examiner speaking</span>
              </div>
            )}
            {isStudentRecording && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-red-100/60 rounded-full backdrop-blur-sm border border-red-200/50">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                <span className="font-medium">Recording student response</span>
              </div>
            )}

          </div>
          
          <div className="text-right">
            {messages.length > 0 && (
              <div className="px-3 py-1 bg-white/50 rounded-full backdrop-blur-sm border border-white/40">
                <span className="font-medium">Last: {formatTime(messages[messages.length - 1]?.timestamp)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface 