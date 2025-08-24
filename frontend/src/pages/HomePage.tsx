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



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
        <span className="ml-4 text-lg text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 animate-gradient-shift"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-50/30 to-purple-50/50 animate-gradient-pulse"></div>
      
      {/* Floating Geometric Shapes */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-xl animate-float-slow"></div>
      <div className="absolute top-40 right-20 w-48 h-48 bg-gradient-to-br from-purple-400/15 to-pink-400/15 rounded-full blur-2xl animate-float-slower"></div>
      <div className="absolute bottom-40 left-1/4 w-24 h-24 bg-gradient-to-br from-indigo-400/25 to-blue-400/25 rounded-full blur-lg animate-float"></div>
      
      {/* Hero Section */}
      <section className="relative z-10">
        <div className="exam-container py-16 lg:py-24">
          <div className="text-center">
            {/* ExamFlow Logo - Enhanced */}
            <div className="flex items-start justify-center mb-12 animate-slide-up">
              <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-3xl shadow-2xl mr-6 mt-2 transform hover:scale-105 transition-transform duration-300">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <h1 className="text-6xl lg:text-8xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 bg-clip-text text-transparent mb-2 leading-none">
                  ExamFlow
                </h1>
                <p className="text-xl lg:text-2xl text-gray-600 font-medium tracking-wide">Seamless AI-Powered Testing</p>
              </div>
            </div>
            
            <p className="text-xl lg:text-2xl text-gray-700 mb-12 max-w-4xl mx-auto text-balance leading-relaxed font-light">
              Upload your study materials and get personalized questions with intelligent AI feedback. 
              Practice written and oral exams with advanced scoring and seamless voice interaction.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
              {isInExam ? (
                <Link
                  to={`/exam/${currentSession?.id}`}
                  className="btn-success btn-lg w-full sm:w-auto transform hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl"
                >
                  🎯 Continue Active Exam
                </Link>
              ) : (
                <Link
                  to="/upload"
                  className="btn-primary btn-lg w-full sm:w-auto transform hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  🚀 Start Examining
                </Link>
              )}
            </div>

            {/* Status Cards - Enhanced with Glass Morphism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-3xl">
                <div className="text-4xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text mb-2">
                  {materials?.length || 0}
                </div>
                <div className="text-gray-700 font-semibold text-lg mb-1">Study Materials</div>
                <div className="text-sm text-gray-500">Ready for examination</div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-purple-400/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-3xl">
                <div className="text-4xl font-bold text-transparent bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text mb-2">
                  {currentSession ? 'Active' : 'Ready'}
                </div>
                <div className="text-gray-700 font-semibold text-lg mb-1">Exam Status</div>
                <div className="text-sm text-gray-500">
                  {currentSession ? 'Exam in progress' : 'Start when ready'}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/5 to-emerald-400/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-3xl">
                <div className="text-4xl font-bold text-transparent bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text mb-2">AI</div>
                <div className="text-gray-700 font-semibold text-lg mb-1">Powered</div>
                <div className="text-sm text-gray-500">GPT-4 & Whisper</div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-pink-400/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* How It Works Section - Enhanced */}
      <section className="relative py-20 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-20 right-10 w-64 h-64 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-48 h-48 bg-gradient-to-br from-purple-300/20 to-pink-300/20 rounded-full blur-2xl"></div>
        </div>
        
        <div className="exam-container relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-800 via-blue-700 to-purple-700 bg-clip-text text-transparent mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
              <div key={index} className="text-center group">
                <div className="relative mb-6 mx-auto w-20 h-20">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:scale-110 group-hover:-rotate-3">
                    {item.step}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300 -z-10"></div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-purple-700 transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Welcome Message - Enhanced */}
      {user && (
        <section className="relative py-16 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 overflow-hidden">
          {/* Background elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 to-purple-700/80"></div>
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-10 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
            <div className="absolute bottom-10 left-20 w-24 h-24 bg-white/15 rounded-full blur-lg"></div>
          </div>
          
          <div className="exam-container relative z-10">
            <div className="text-center text-white">
              <h2 className="text-3xl lg:text-4xl font-bold mb-6 animate-slide-up">
                Welcome back, {user.name}! 👋
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
                Ready to continue your learning journey? Let's get started with your next exam.
              </p>
              
              {materials && materials.length > 0 ? (
                <Link
                  to="/upload"
                  className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-2xl hover:bg-blue-50 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
                >
                  📚 View Your Materials ({materials.length})
                </Link>
              ) : (
                <Link
                  to="/upload"
                  className="inline-flex items-center px-8 py-4 bg-white text-purple-600 font-semibold rounded-2xl hover:bg-purple-50 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
                >
                  🚀 Upload Your First Material
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