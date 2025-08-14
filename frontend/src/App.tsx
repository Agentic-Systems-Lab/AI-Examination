/**
 * Main App Component for ExamFlow
 * 
 * This component provides the main application structure with routing,
 * navigation, and global layout for the ExamFlow platform.
 * 
 * Author: ExamFlow Team
 */

import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthContext } from './contexts/AuthContext'
import { useExamContext } from './contexts/ExamContext'

// Import pages/components (these will be created)
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import ExamPage from './pages/ExamPage'
import ResultsPage from './pages/ResultsPage'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const { isLoading: authLoading } = useAuthContext()
  const { isLoading: examLoading } = useExamContext()

  // Show loading spinner while initializing
  if (authLoading || examLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
        <span className="ml-4 text-lg text-gray-600">Initializing ExamFlow...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Main application routes */}
          <Route index element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/exam/:sessionId?" element={<ExamPage />} />
          <Route path="/results/:sessionId?" element={<ResultsPage />} />
          
          {/* Fallback route */}
          <Route path="*" element={
            <div className="exam-container py-16">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
                <p className="text-lg text-gray-600 mb-8">
                  The page you're looking for doesn't exist.
                </p>
                <a 
                  href="/" 
                  className="btn-primary"
                >
                  Return Home
                </a>
              </div>
            </div>
          } />
        </Route>
      </Routes>
    </div>
  )
}

export default App 