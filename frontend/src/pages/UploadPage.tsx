/**
 * Upload Page Component
 * 
 * This page allows users to upload study materials and manage
 * their uploaded content for the AI Examiner application.
 * 
 * Author: AI Assistant
 */

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { useExamContext } from '../contexts/ExamContext'
import { uploadMaterial, isValidFileType, formatFileSize, getFileTypeDisplayName } from '../services/examAPI'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

function UploadPage() {
  const navigate = useNavigate()
  const { isGeneratingQuestions, selectMaterial, generateQuestions, startExam } = useExamContext()

  // Upload form state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    subject: '',
    documentType: 'study_material',
    email: '',
    file: null as File | null
  })


  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]

    if (!file) return

    if (!isValidFileType(file)) {
      toast.error('Invalid file type. Please upload PDF, DOCX, or TXT files.')
      return
    }

    setUploadForm(prev => ({
      ...prev,
      file,
      title: prev.title || file.name.replace(/\.[^/.]+$/, '') // Auto-fill title from filename
    }))
  }, [])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setUploadForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title.trim() || !uploadForm.subject.trim() || !uploadForm.email.trim()) {
      toast.error('Please fill in all required fields and select a file.')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(uploadForm.email.trim())) {
      toast.error('Please enter a valid email address.')
      return
    }

    try {
      setIsUploading(true)

      const uploadedMaterial = await uploadMaterial(
        uploadForm.file,
        uploadForm.title.trim(),
        uploadForm.description.trim(),
        uploadForm.subject.trim(),
        uploadForm.documentType,
        uploadForm.email.trim()
      )

      toast.success('Material uploaded successfully! Generating questions...')

      // Automatically generate 5 short essay questions
      const questionOptions = {
        num_questions: 5,
        difficulty_level: 3,
        question_types: ['short_answer']
      }

      const questionsGenerated = await generateQuestions(uploadedMaterial.id, questionOptions)

      if (questionsGenerated) {
        toast.success('Questions generated! Starting exam...')

        // Select the material and start exam
        selectMaterial(uploadedMaterial)
        const examStarted = await startExam(uploadedMaterial.id)

        if (examStarted) {
          // Navigate to exam page
          navigate(`/exam?material=${encodeURIComponent(uploadedMaterial.title)}`)
        } else {
          toast.error('Failed to start exam. Please try again.')
          setIsUploading(false)
        }
      } else {
        toast.error('Failed to generate questions. Please check your OpenAI API key.')
        setIsUploading(false)
      }

    } catch (error) {
      console.error('Upload or question generation failed:', error)
      toast.error('Failed to complete the process. Please try again.')
      setIsUploading(false)
    }
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

      <div className="relative z-10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="text-center mb-12 animate-slide-up">
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 bg-clip-text text-transparent mb-6">
              Study Materials
            </h1>
            <p className="text-xl lg:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed font-light">
              Upload and manage your study materials for AI-powered examinations.
              Supports PDF, DOCX, and TXT files up to 10MB.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Upload Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl p-8 hover:bg-white/90 transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mr-4 shadow-xl">
                  <span className="text-xl text-white">📁</span>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-800 to-blue-700 bg-clip-text text-transparent">
                  Upload New Material
                </h2>
              </div>

              {/* File Drop Zone */}
              <div
                {...getRootProps()}
                className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200
                ${isDragActive && !isDragReject ? 'border-primary-400 bg-primary-50' : ''}
                ${isDragReject ? 'border-error-400 bg-error-50' : ''}
                ${!isDragActive ? 'border-gray-300 hover:border-gray-400' : ''}
              `}
              >
                <input {...getInputProps()} />

                <div className="space-y-4">
                  <div className="text-4xl">
                    {isDragActive ? '📎' : '📤'}
                  </div>

                  {uploadForm.file ? (
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        {uploadForm.file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(uploadForm.file.size)} • {getFileTypeDisplayName(uploadForm.file.name.split('.').pop() || '')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg text-gray-600 mb-2">
                        {isDragActive ? 'Drop your file here' : 'Drag & drop your study material'}
                      </p>
                      <p className="text-sm text-gray-500">
                        or click to browse files
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Supports PDF, DOCX, TXT (max 10MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Form */}
              <div className="space-y-4 mt-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    className="input"
                    placeholder="Enter a descriptive title for your material"
                    value={uploadForm.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    className="input"
                    placeholder="e.g., Computer Science, Biology, History"
                    value={uploadForm.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type *
                  </label>
                  <select
                    id="documentType"
                    className="input"
                    value={uploadForm.documentType}
                    onChange={(e) => handleInputChange('documentType', e.target.value)}
                  >
                    <option value="study_material">Study Material</option>
                    <option value="assignment">Assignment</option>
                    <option value="thesis">Thesis</option>
                    <option value="paper">Paper</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Student Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="input"
                    placeholder="your.email@university.edu"
                    value={uploadForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    className="input resize-none"
                    placeholder="Brief description of the content..."
                    value={uploadForm.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>

                <button
                  onClick={handleUpload}
                  disabled={isUploading || isGeneratingQuestions || !uploadForm.file || !uploadForm.title.trim() || !uploadForm.subject.trim() || !uploadForm.email.trim()}
                  className="btn-primary w-full"
                >
                  {isUploading || isGeneratingQuestions ? (
                    <>
                      <LoadingSpinner size="small" color="white" />
                      <span className="ml-2">
                        {isUploading && !isGeneratingQuestions ? 'Uploading...' : 'Generating Questions...'}
                      </span>
                    </>
                  ) : (
                    '📤 Upload & Start Exam'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadPage 