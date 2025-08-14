/**
 * Chat Interface Component
 * 
 * This component displays the conversation between the examiner and student
 * in a chat-style interface during the oral exam.
 * 
 * Author: AI Assistant
 */

import React, { useEffect, useRef } from 'react'
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
          className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${
            isExaminer
              ? 'bg-blue-100 text-blue-900 rounded-tl-none'
              : 'bg-gray-100 text-gray-900 rounded-tr-none'
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
                className={`p-1 rounded-full transition-colors ${
                  isExaminer
                    ? 'hover:bg-blue-200 text-blue-600'
                    : 'hover:bg-gray-200 text-gray-600'
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
      <div className="bg-blue-100 text-blue-900 px-4 py-3 rounded-lg rounded-tl-none max-w-xs">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium">Examiner</span>
          <Volume2 className="w-3 h-3 animate-pulse text-blue-600" />
        </div>
        <div className="text-sm mt-2 flex items-center space-x-1">
          <span>Speaking</span>
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
      <div className="bg-red-100 text-red-900 px-4 py-3 rounded-lg rounded-tr-none max-w-xs">
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-red-600" />
          <span className="text-xs font-medium">Student</span>
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
        </div>
        <div className="text-sm mt-2">
          Recording your response...
        </div>
      </div>
    </div>
  )

  return (
    <div 
      className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-900">
          Exam Conversation
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>{messages.length} messages</span>
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
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">Welcome to your oral exam</p>
            <p className="text-sm">
              Click the microphone button to start the exam.
              The examiner will read each question aloud.
            </p>
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
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            {isExaminerSpeaking && (
              <div className="flex items-center space-x-1">
                <Volume2 className="w-3 h-3 animate-pulse text-blue-600" />
                <span>Examiner speaking</span>
              </div>
            )}
            {isStudentRecording && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                <span>Recording student response</span>
              </div>
            )}
            {!isExaminerSpeaking && !isStudentRecording && (
              <span>Ready for interaction</span>
            )}
          </div>
          
          <div className="text-right">
            {messages.length > 0 && (
              <span>Last message at {formatTime(messages[messages.length - 1]?.timestamp)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface 