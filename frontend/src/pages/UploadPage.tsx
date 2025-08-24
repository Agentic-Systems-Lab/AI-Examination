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
import QuestionsPopup from '../components/QuestionsPopup'
import toast from 'react-hot-toast'

function UploadPage() {
  const navigate = useNavigate()
  const { materials, isLoading, isGeneratingQuestions, loadMaterials, selectMaterial, deleteMaterial, generateQuestions, startExam } = useExamContext()
  
  // Upload form state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    subject: '',
    file: null as File | null
  })

  // Question generation modal state
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [questionOptions, setQuestionOptions] = useState({
    num_questions: 10,
    difficulty_level: 3,
    question_types: ['short_answer']
  })
  const [customQuestionCount, setCustomQuestionCount] = useState('10')

  // Questions popup state
  const [showQuestionsPopup, setShowQuestionsPopup] = useState(false)
  const [questionsPopupMaterial, setQuestionsPopupMaterial] = useState<any>(null)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
    if (!uploadForm.file || !uploadForm.title.trim() || !uploadForm.subject.trim()) {
      toast.error('Please fill in all required fields and select a file.')
      return
    }

    try {
      setIsUploading(true)
      
      await uploadMaterial(
        uploadForm.file,
        uploadForm.title.trim(),
        uploadForm.description.trim(),
        uploadForm.subject.trim()
      )

      toast.success('Material uploaded successfully!')
      
      // Reset form
      setUploadForm({
        title: '',
        description: '',
        subject: '',
        file: null
      })
      
      // Reload materials
      await loadMaterials()
      
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Failed to upload material. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle opening question generation modal
  const handleGenerateQuestions = (material: any) => {
    setSelectedMaterial(material)
    setCustomQuestionCount('10') // Reset to default
    setShowQuestionModal(true)
  }

  // Handle question generation
  const handleConfirmGenerateQuestions = async () => {
    if (!selectedMaterial) return

    // Validate custom question count
    const questionCount = parseInt(customQuestionCount)
    if (isNaN(questionCount) || questionCount < 1 || questionCount > 50) {
      toast.error('Please enter a valid number of questions between 1 and 50.')
      return
    }

    try {
      const optionsWithCustomCount = {
        ...questionOptions,
        num_questions: questionCount
      }
      
      const success = await generateQuestions(selectedMaterial.id, optionsWithCustomCount)
      
      if (success) {
        toast.success(`${questionCount} questions generated successfully!`)
        setShowQuestionModal(false)
        setSelectedMaterial(null)
        setCustomQuestionCount('10') // Reset to default
      } else {
        toast.error('Failed to generate questions. Please check your OpenAI API key.')
      }
    } catch (error) {
      console.error('Question generation failed:', error)
      toast.error('Failed to generate questions. Please try again.')
    }
  }

  /**
   * Handle opening the questions viewer/editor popup
   */
  const handleViewQuestions = (material: any) => {
    setQuestionsPopupMaterial(material)
    setShowQuestionsPopup(true)
  }

  // Handle material selection for exam
  const handleStartExam = async (material: any) => {
    try {
      selectMaterial(material)
      const success = await startExam(material.id)
      
      if (success) {
        toast.success(`Starting exam for: ${material.title}`)
        navigate(`/exam?material=${encodeURIComponent(material.title)}`)
      } else {
        toast.error('Failed to start exam. Please try again.')
      }
    } catch (error) {
      console.error('Failed to start exam:', error)
      toast.error('Failed to start exam. Please try again.')
    }
  }

  /**
   * Handle opening delete confirmation dialog
   */
  const handleDeleteMaterial = (material: any) => {
    setMaterialToDelete(material)
    setShowDeleteConfirm(true)
  }

  /**
   * Handle confirming material deletion
   */
  const handleConfirmDelete = async () => {
    if (!materialToDelete) return

    try {
      setIsDeleting(true)
      const success = await deleteMaterial(materialToDelete.id)
      
      if (success) {
        toast.success(`Material "${materialToDelete.title}" deleted successfully!`)
        setShowDeleteConfirm(false)
        setMaterialToDelete(null)
      } else {
        toast.error('Failed to delete material. Please try again.')
      }
    } catch (error) {
      console.error('Failed to delete material:', error)
      toast.error('Failed to delete material. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Handle canceling material deletion
   */
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
    setMaterialToDelete(null)
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl p-8 h-fit hover:bg-white/90 transition-all duration-300">
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
                disabled={isUploading || !uploadForm.file || !uploadForm.title.trim() || !uploadForm.subject.trim()}
                className="btn-primary w-full"
              >
                {isUploading ? (
                  <>
                    <LoadingSpinner size="small" color="white" />
                    <span className="ml-2">Uploading...</span>
                  </>
                ) : (
                  '📤 Upload Material'
                )}
              </button>
            </div>
          </div>

          {/* Materials List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl p-8 hover:bg-white/90 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center mr-4 shadow-xl">
                  <span className="text-xl text-white">📚</span>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-800 to-green-700 bg-clip-text text-transparent">
                  Your Materials
                </h2>
              </div>
              <button
                onClick={loadMaterials}
                disabled={isLoading}
                className="btn-secondary btn-sm flex items-center space-x-2"
              >
                {isLoading ? <LoadingSpinner size="small" /> : <span>🔄</span>}
                <span>Refresh</span>
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <LoadingSpinner size="large" />
                <p className="text-gray-500 mt-4">Loading materials...</p>
              </div>
            ) : materials && materials.length > 0 ? (
              <div className="space-y-6">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="group bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:bg-white/90 hover:shadow-3xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
                  >
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-purple-400/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Header Section */}
                    <div className="mb-6 relative z-10">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 bg-clip-text text-transparent mb-2 group-hover:from-blue-700 group-hover:to-purple-700 transition-all duration-300">
                        {material.title}
                      </h3>
                      <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-300">
                        Uploaded: {new Date(material.upload_time).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>

                    {/* Action Buttons Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                      <button
                        onClick={() => handleStartExam(material)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 text-sm font-semibold flex items-center justify-center space-x-2 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                        disabled={isGeneratingQuestions}
                      >
                        <span className="text-lg">🎯</span>
                        <span>Start Exam</span>
                      </button>
                      
                      <button
                        onClick={() => handleGenerateQuestions(material)}
                        className="bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-700 hover:bg-white hover:border-blue-300 py-3 px-4 text-sm font-semibold flex items-center justify-center space-x-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        disabled={isGeneratingQuestions}
                      >
                        {isGeneratingQuestions ? (
                          <>
                            <LoadingSpinner size="small" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">⚙️</span>
                            <span>Generate</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleViewQuestions(material)}
                        className="bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-700 hover:bg-white hover:border-green-300 py-3 px-4 text-sm font-semibold flex items-center justify-center space-x-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        disabled={isGeneratingQuestions}
                      >
                        <span className="text-lg">📝</span>
                        <span>View & Edit</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteMaterial(material)}
                        className="bg-red-50/80 backdrop-blur-sm text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 py-3 px-4 text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
                        disabled={isGeneratingQuestions || isDeleting}
                      >
                        <span className="text-lg">🗑️</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No materials uploaded yet
                </h3>
                <p className="text-gray-500">
                  Upload your first study material to get started with AI-powered examinations.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Question Generation Modal */}
        {showQuestionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-blue-700 bg-clip-text text-transparent mb-6">Generate Questions</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={customQuestionCount}
                    onChange={(e) => setCustomQuestionCount(e.target.value)}
                    className="input"
                    placeholder="Enter number (1-50)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ Maximum 50 questions per generation.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={questionOptions.difficulty_level}
                    onChange={(e) => setQuestionOptions(prev => ({
                      ...prev,
                      difficulty_level: parseInt(e.target.value)
                    }))}
                    className="input"
                  >
                    <option value={1}>1 - Very Easy</option>
                    <option value={2}>2 - Easy</option>
                    <option value={3}>3 - Medium</option>
                    <option value={4}>4 - Hard</option>
                    <option value={5}>5 - Very Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Types
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'short_answer', label: 'Short Answer' },
                      { value: 'multiple_choice', label: 'Multiple Choice' },
                      { value: 'essay', label: 'Essay' },
                      { value: 'true_false', label: 'True/False' }
                    ].map((type) => (
                      <label key={type.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={questionOptions.question_types.includes(type.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setQuestionOptions(prev => ({
                                ...prev,
                                question_types: [...prev.question_types, type.value]
                              }))
                            } else {
                              setQuestionOptions(prev => ({
                                ...prev,
                                question_types: prev.question_types.filter(t => t !== type.value)
                              }))
                            }
                          }}
                          className="mr-2"
                        />
                        {type.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowQuestionModal(false)
                    setCustomQuestionCount('10') // Reset to default
                  }}
                  className="btn-secondary flex-1"
                  disabled={isGeneratingQuestions}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGenerateQuestions}
                  className="btn-primary flex-1"
                  disabled={
                    isGeneratingQuestions || 
                    questionOptions.question_types.length === 0 ||
                    !customQuestionCount || 
                    parseInt(customQuestionCount) < 1 || 
                    parseInt(customQuestionCount) > 50 ||
                    isNaN(parseInt(customQuestionCount))
                  }
                >
                  {isGeneratingQuestions ? (
                    <>
                      <LoadingSpinner size="small" color="white" />
                      <span className="ml-2">Generating...</span>
                    </>
                  ) : (
                    'Generate Questions'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Questions Popup */}
        <QuestionsPopup
          isVisible={showQuestionsPopup}
          onClose={() => setShowQuestionsPopup(false)}
          material={questionsPopupMaterial}
        />

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="text-6xl mb-6">⚠️</div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-red-700 bg-clip-text text-transparent mb-4">
                  Confirm Deletion
                </h3>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete <strong>"{materialToDelete?.title}"</strong>?
                </p>
                <p className="text-sm text-red-600 mb-6">
                  This will permanently delete the material and all associated questions, exam sessions, and answers. This action cannot be undone.
                </p>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancelDelete}
                    className="btn-secondary flex-1"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <LoadingSpinner size="small" color="white" />
                        <span className="ml-2">Deleting...</span>
                      </>
                    ) : (
                      'Delete Material'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-16">
          <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl border border-white/20 shadow-2xl p-12 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full opacity-30">
              <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-2xl"></div>
              <div className="absolute bottom-10 left-10 w-24 h-24 bg-gradient-to-br from-purple-300/20 to-pink-300/20 rounded-full blur-xl"></div>
            </div>
            
            <div className="relative z-10">
              <div className="text-center mb-12">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <span className="text-3xl text-white">💡</span>
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-800 via-blue-700 to-purple-700 bg-clip-text text-transparent mb-4">Tips for Better Results</h3>
                <p className="text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed font-light">Follow these guidelines to maximize your AI examination experience</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                      <span className="text-xl text-white">📄</span>
                    </div>
                    <h4 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:to-purple-700 transition-all duration-300">File Preparation</h4>
                  </div>
                  <ul className="space-y-4 text-gray-700">
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Use clear, well-structured documents with proper headings</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Include key concepts, definitions, and examples</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Ensure content is at least 500 words for quality questions</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Keep files under 5MB for optimal performance</span>
                    </li>
                  </ul>
                </div>

                <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                      <span className="text-xl text-white">🎯</span>
                    </div>
                    <h4 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-green-700 bg-clip-text text-transparent group-hover:from-green-700 group-hover:to-emerald-700 transition-all duration-300">Content Guidelines</h4>
                  </div>
                  <ul className="space-y-4 text-gray-700">
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Focus on key learning objectives and outcomes</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Include detailed explanations for better question quality</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Use academic or professional content for best results</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <span className="text-green-500 mt-1.5 font-bold text-lg">•</span>
                      <span className="leading-relaxed">Organize content with clear sections and topics</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default UploadPage 