/**
 * Authentication Context for AI Examiner
 * 
 * This context manages user authentication state and provides
 * authentication-related functionality throughout the application.
 * 
 * Author: AI Assistant
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Types
interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  register: (name: string, email: string, password: string) => Promise<boolean>
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider props
interface AuthProviderProps {
  children: ReactNode
}

/**
 * Authentication Provider Component
 * 
 * Provides authentication state and methods to child components.
 * For this demo, we'll use a simplified authentication system.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = user !== null

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth()
  }, [])

  /**
   * Initialize authentication state from localStorage or session
   */
  const initializeAuth = async () => {
    try {
      // For demo purposes, we'll create a default user
      // In a real app, this would check tokens, make API calls, etc.
      const savedUser = localStorage.getItem('ai_examiner_user')
      
      if (savedUser) {
        const userData = JSON.parse(savedUser)
        setUser(userData)
      } else {
        // Create a demo user for the AI Examiner
        const demoUser: User = {
          id: 'demo-user-1',
          name: 'Demo Student',
          email: 'student@university.edu',
          avatar: undefined
        }
        setUser(demoUser)
        localStorage.setItem('ai_examiner_user', JSON.stringify(demoUser))
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      // Create fallback user
      const fallbackUser: User = {
        id: 'demo-user-1',
        name: 'Demo Student',
        email: 'student@university.edu'
      }
      setUser(fallbackUser)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Login function (simplified for demo)
   * 
   * @param email - User email
   * @param password - User password
   * @returns Promise<boolean> - Success status
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // For demo purposes, accept any email/password combination
      const userData: User = {
        id: `user-${Date.now()}`,
        name: email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        email: email,
        avatar: undefined
      }
      
      setUser(userData)
      localStorage.setItem('ai_examiner_user', JSON.stringify(userData))
      
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Register function (simplified for demo)
   * 
   * @param name - User's full name
   * @param email - User email
   * @param password - User password
   * @returns Promise<boolean> - Success status
   */
  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userData: User = {
        id: `user-${Date.now()}`,
        name: name,
        email: email,
        avatar: undefined
      }
      
      setUser(userData)
      localStorage.setItem('ai_examiner_user', JSON.stringify(userData))
      
      return true
    } catch (error) {
      console.error('Registration failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Logout function
   */
  const logout = () => {
    setUser(null)
    localStorage.removeItem('ai_examiner_user')
    // In a real app, you might also clear tokens, make API calls, etc.
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use authentication context
 * 
 * @returns AuthContextType - Authentication context value
 * @throws Error if used outside AuthProvider
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  
  return context
}

// Export types for use in other components
export type { User, AuthContextType } 