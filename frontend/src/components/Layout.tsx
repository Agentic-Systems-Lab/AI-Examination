/**
 * Layout Component
 * 
 * Main layout component that provides the application structure,
 * navigation, and common UI elements for all pages.
 * 
 * Author: ExamFlow Team
 */

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { useExamContext } from '../contexts/ExamContext'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthContext()
  const { currentSession, isInExam, resetExam } = useExamContext()

  const handleLogout = () => {
    if (isInExam) {
      const confirmLogout = window.confirm(
        'You have an active exam session. Logging out will end your exam. Continue?'
      )
      if (confirmLogout) {
        resetExam()
        logout()
        navigate('/')
      }
    } else {
      logout()
      navigate('/')
    }
  }

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-800 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-800 to-blue-600 bg-clip-text text-transparent">
                  ExamFlow
                </h1>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/') 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Home
              </Link>
              
              <Link
                to="/upload"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/upload') 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Upload Material
              </Link>

              {isInExam && (
                <Link
                  to={`/exam/${currentSession?.id}`}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-success-100 text-success-700 hover:bg-success-200"
                >
                  Active Exam
                </Link>
              )}


            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Exam Status Indicator */}
              {isInExam && (
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-success-100 text-success-700 rounded-full text-sm">
                  <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                  <span>Exam in Progress</span>
                </div>
              )}

              {/* User Avatar and Menu */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-medium text-sm">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>

                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-4 py-3 space-y-1">
            <Link
              to="/"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/') 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Home
            </Link>
            
            <Link
              to="/upload"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/upload') 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Upload Material
            </Link>

            {isInExam && (
              <Link
                to={`/exam/${currentSession?.id}`}
                className="block px-3 py-2 rounded-md text-base font-medium bg-success-100 text-success-700 hover:bg-success-200"
              >
                Active Exam
              </Link>
            )}


          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-500 mb-4 md:mb-0">
              © 2025 ExamFlow. Built with ❤️ by the Agentic Systems Lab @ ETH.
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <span>Version 1.1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout 