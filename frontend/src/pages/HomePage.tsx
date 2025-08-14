/**
 * Home Page Component
 * 
 * The main landing page for the AI Examiner application.
 * Provides an overview of features and quick access to main functionality.
 * 
 * Author: AI Assistant
 */

import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { useExamContext } from '../contexts/ExamContext'
import LoadingSpinner from '../components/LoadingSpinner'

function HomePage() {
  const { user } = useAuthContext()
  const { materials, currentSession, isInExam, isLoading } = useExamContext()

  const features = [
    {
      icon: '📚',
      title: 'Upload Study Materials',
      description: 'Upload PDF, DOCX, or TXT files with your study content',
      action: 'Upload Now',
      link: '/upload'
    },
    {
      icon: '🤖',
      title: 'AI Question Generation',
      description: 'Automatically generate questions from your materials using GPT-4',
      action: 'View Materials',
      link: '/upload'
    },
    {
      icon: '🗣️',
      title: 'Voice Exam Mode',
      description: 'Practice oral exams with speech-to-text and AI feedback',
      action: 'Start Exam',
      link: '/upload'
    },
    {
      icon: '📊',
      title: 'Performance Analytics',
      description: 'Get detailed score reports and personalized recommendations',
      action: 'View Results',
      link: '/results'
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
        <span className="ml-4 text-lg text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="exam-container py-16 lg:py-24">
          <div className="text-center">
            {/* ExamFlow Logo */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl shadow-lg mr-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.6" />
                </svg>
              </div>
              <div className="text-left">
                <h1 className="text-5xl lg:text-7xl font-bold bg-gradient-to-r from-blue-800 to-blue-600 bg-clip-text text-transparent">
                  ExamFlow
                </h1>
                <p className="text-lg text-gray-600 -mt-2">Seamless AI-Powered Testing</p>
              </div>
            </div>
            
            <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto text-balance">
              Upload your study materials and get personalized questions with intelligent AI feedback. 
              Practice written and oral exams with advanced scoring and seamless voice interaction.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              {isInExam ? (
                <Link
                  to={`/exam/${currentSession?.id}`}
                  className="btn-success btn-lg w-full sm:w-auto"
                >
                  🎯 Continue Active Exam
                </Link>
              ) : (
                <Link
                  to="/upload"
                  className="btn-primary btn-lg w-full sm:w-auto"
                >
                  🚀 Start Examining
                </Link>
              )}
              
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-lg w-full sm:w-auto"
              >
                📖 View API Docs
              </a>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-exam p-6 border border-gray-200">
                <div className="text-3xl font-bold text-primary-600">
                  {materials?.length || 0}
                </div>
                <div className="text-gray-600 font-medium">Study Materials</div>
                <div className="text-sm text-gray-500">Ready for examination</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-exam p-6 border border-gray-200">
                <div className="text-3xl font-bold text-success-600">
                  {currentSession ? 'Active' : 'Ready'}
                </div>
                <div className="text-gray-600 font-medium">Exam Status</div>
                <div className="text-sm text-gray-500">
                  {currentSession ? 'Exam in progress' : 'Start when ready'}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-exam p-6 border border-gray-200">
                <div className="text-3xl font-bold text-purple-600">AI</div>
                <div className="text-gray-600 font-medium">Powered</div>
                <div className="text-sm text-gray-500">GPT-4 & Whisper</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="exam-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Excel
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive AI-powered examination tools designed specifically for university students
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card-hover text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-6">
                  {feature.description}
                </p>
                <Link
                  to={feature.link}
                  className="btn-primary btn-sm w-full"
                >
                  {feature.action}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="exam-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get started with AI-powered examination in four simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Upload Material',
                description: 'Upload your study materials in PDF, DOCX, or TXT format'
              },
              {
                step: '2',
                title: 'Generate Questions',
                description: 'AI analyzes content and creates personalized questions'
              },
              {
                step: '3',
                title: 'Take Exam',
                description: 'Answer questions using text or voice input with real-time feedback'
              },
              {
                step: '4',
                title: 'Get Results',
                description: 'Receive comprehensive score report with study recommendations'
              }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Welcome Message */}
      {user && (
        <section className="py-12 bg-primary-600">
          <div className="exam-container">
            <div className="text-center text-white">
              <h2 className="text-2xl lg:text-3xl font-bold mb-4">
                Welcome back, {user.name}! 👋
              </h2>
              <p className="text-lg text-primary-100 mb-6">
                Ready to continue your learning journey? Let's get started with your next exam.
              </p>
              
              {materials && materials.length > 0 ? (
                <Link
                  to="/upload"
                  className="btn-secondary btn-lg"
                >
                  View Your Materials ({materials.length})
                </Link>
              ) : (
                <Link
                  to="/upload"
                  className="btn-secondary btn-lg"
                >
                  Upload Your First Material
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default HomePage 