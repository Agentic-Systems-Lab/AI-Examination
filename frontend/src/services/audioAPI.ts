/**
 * Advanced Audio API Service
 * 
 * This service provides comprehensive audio functionality for the AI Examiner frontend,
 * connecting with the advanced backend audio processing system.
 * 
 * Features:
 * - High-quality audio transcription with analytics
 * - Advanced text-to-speech synthesis with emotion control
 * - Audio quality analysis and optimization suggestions
 * - Streaming audio capabilities
 * - Audio caching and performance optimization
 * 
 * Author: AI Assistant
 */

import axios, { AxiosResponse } from 'axios'

// ====================== API CONFIGURATION ======================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const audioAPI = axios.create({
  baseURL: `${API_BASE_URL}/api/audio`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds for audio processing
})

// ====================== TYPE DEFINITIONS ======================

export interface AudioConfig {
  supported_formats: string[]
  max_file_size_mb: number
  max_duration_seconds: number
  sample_rate: number
  bit_rate: number
  enable_noise_reduction: boolean
  enable_auto_gain: boolean
  silence_threshold: number
  silence_duration: number
}

export interface VoiceSettings {
  voice_id: string
  speech_rate: number
  pitch: number
  volume: number
  output_format: string
  enable_ssml: boolean
}

export interface AudioAnalytics {
  duration_seconds: number
  file_size_bytes: number
  sample_rate: number
  bit_rate?: number
  noise_level: number
  voice_activity_ratio: number
  average_volume: number
  speaking_rate_wpm?: number
  confidence_score: number
  quality_score: number
}

export interface AudioProcessingResult {
  exam_session_id: number
  transcription: string
  confidence: number
  language_detected: string
  processing_time_ms: number
  audio_analytics: AudioAnalytics
  suggested_improvements: string[]
  timestamp: string
}

export interface SynthesisResult {
  exam_session_id: number
  text: string
  voice_settings: VoiceSettings
  audio_data: string // Base64 encoded
  audio_format: string
  audio_size_mb: number
  estimated_duration_seconds: number
  processing_time_ms: number
  voice_model_info: {
    description: string
    gender: string
    age: string
  }
  cached: boolean
  timestamp: string
  message: string
}

export interface AudioConfigResponse {
  audio_config: AudioConfig
  voice_models: Record<string, {
    description: string
    gender: string
    age: string
  }>
  supported_languages: string[]
  emotions: string[]
  capabilities: {
    speech_to_text: boolean
    text_to_speech: boolean
    real_time_transcription: boolean
    voice_cloning: boolean
    emotion_synthesis: boolean
    audio_analytics: boolean
    streaming_synthesis: boolean
    audio_caching: boolean
  }
  quality_levels: Record<string, string>
  limits: {
    max_file_size_mb: number
    max_duration_seconds: number
    max_text_length: number
    concurrent_requests: number
  }
  openai_configured: boolean
  server_info: {
    audio_temp_dir: string
    audio_cache_dir: string
    version: string
  }
}

export interface AudioAnalysisResult {
  validation: {
    file_size_bytes: number
    file_size_mb: number
    file_extension: string
    content_type: string
    quality_score: number
    is_valid: boolean
    validation_time: string
  }
  analytics: AudioAnalytics
  overall_quality_score: number
  quality_rating: 'excellent' | 'good' | 'fair' | 'poor'
  transcription_preview: string
  analysis_timestamp: string
  recommendations: string[]
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    openai_client: boolean
    audio_directories: {
      temp_dir_exists: boolean
      cache_dir_exists: boolean
      temp_dir_writable: boolean
      cache_dir_writable: boolean
    }
  }
  storage: {
    temp_files_count: number
    cache_files_count: number
  }
  error?: string
}

// ====================== ERROR HANDLING ======================

export class AudioAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AudioAPIError'
  }
}

const handleAPIError = (error: any): never => {
  if (error.response) {
    const { status, data } = error.response
    const message = data?.detail || data?.message || 'Audio processing failed'
    throw new AudioAPIError(message, status, data?.code, data)
  } else if (error.request) {
    throw new AudioAPIError('Network error: Unable to reach audio service', 0, 'NETWORK_ERROR')
  } else {
    throw new AudioAPIError(error.message || 'Unknown audio processing error', 0, 'UNKNOWN_ERROR')
  }
}

// ====================== AUDIO TRANSCRIPTION ======================

/**
 * Transcribe audio to text with comprehensive analytics.
 * 
 * This function uploads an audio file and returns detailed transcription
 * results including quality metrics and improvement suggestions.
 * 
 * @param sessionId - Current exam session ID
 * @param audioBlob - Audio data to transcribe
 * @param language - Optional language code for better transcription
 * @param enableAnalytics - Whether to include detailed analytics
 * @returns Promise with transcription results and analytics
 */
export async function transcribeAudio(
  sessionId: number,
  audioBlob: Blob,
  language?: string,
  enableAnalytics: boolean = true
): Promise<AudioProcessingResult> {
  try {
    const formData = new FormData()
    formData.append('audio_file', audioBlob, 'recording.webm')
    formData.append('exam_session_id', sessionId.toString())
    formData.append('enable_analytics', enableAnalytics.toString())
    
    if (language) {
      formData.append('language', language)
    }

    const response: AxiosResponse<AudioProcessingResult> = await audioAPI.post('/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // Extended timeout for transcription
    })

    return response.data
  } catch (error) {
    handleAPIError(error)
  }
}

// ====================== TEXT-TO-SPEECH SYNTHESIS ======================

/**
 * Synthesize text to speech with advanced voice control.
 * 
 * This function converts text to speech using the advanced TTS system
 * with support for emotion, voice selection, and quality control.
 * 
 * @param sessionId - Current exam session ID
 * @param text - Text to convert to speech
 * @param voiceSettings - Voice configuration options
 * @param emotion - Optional emotional tone
 * @param enableCaching - Whether to cache the result
 * @returns Promise with synthesis result and audio data
 */
export async function synthesizeSpeech(
  sessionId: number,
  text: string,
  voiceSettings?: Partial<VoiceSettings>,
  emotion?: string,
  enableCaching: boolean = true
): Promise<SynthesisResult> {
  try {
    const requestData = {
      exam_session_id: sessionId,
      text: text.slice(0, 4000), // Ensure we don't exceed limits
      voice_settings: {
        voice_id: 'alloy',
        speech_rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        output_format: 'mp3',
        enable_ssml: false,
        ...voiceSettings
      },
      emotion,
      enable_caching: enableCaching
    }

    const response: AxiosResponse<SynthesisResult> = await audioAPI.post('/synthesize', requestData, {
      timeout: 30000, // 30 seconds for synthesis
    })

    return response.data
  } catch (error) {
    handleAPIError(error)
  }
}

/**
 * Stream text-to-speech synthesis for real-time audio generation.
 * 
 * This function provides streaming audio generation for better user experience
 * with large text content or real-time applications.
 * 
 * @param sessionId - Current exam session ID
 * @param text - Text to convert to speech
 * @param voiceSettings - Voice configuration options
 * @param emotion - Optional emotional tone
 * @returns Promise with audio stream URL
 */
export async function synthesizeSpeechStream(
  sessionId: number,
  text: string,
  voiceSettings?: Partial<VoiceSettings>,
  emotion?: string
): Promise<string> {
  try {
    const requestData = {
      exam_session_id: sessionId,
      text: text.slice(0, 4000),
      voice_settings: {
        voice_id: 'alloy',
        speech_rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        output_format: 'mp3',
        enable_ssml: false,
        ...voiceSettings
      },
      emotion,
      enable_caching: false // Streaming doesn't use cache
    }

    const response = await audioAPI.post('/stream-synthesis', requestData, {
      responseType: 'blob',
      timeout: 60000,
    })

    // Create object URL for the audio stream
    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' })
    return URL.createObjectURL(audioBlob)
  } catch (error) {
    handleAPIError(error)
  }
}

// ====================== AUDIO ANALYSIS ======================

/**
 * Analyze audio quality and characteristics without full transcription.
 * 
 * This function provides comprehensive audio analysis including quality metrics,
 * speaking characteristics, and optimization suggestions.
 * 
 * @param audioBlob - Audio data to analyze
 * @param includeTranscription - Whether to include transcription preview
 * @returns Promise with detailed audio analysis results
 */
export async function analyzeAudio(
  audioBlob: Blob,
  includeTranscription: boolean = false
): Promise<AudioAnalysisResult> {
  try {
    const formData = new FormData()
    formData.append('audio_file', audioBlob, 'audio_sample.webm')
    formData.append('include_transcription', includeTranscription.toString())

    const response: AxiosResponse<AudioAnalysisResult> = await audioAPI.post('/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 45000, // Extended timeout for analysis
    })

    return response.data
  } catch (error) {
    handleAPIError(error)
  }
}

// ====================== CONFIGURATION AND MANAGEMENT ======================

/**
 * Get audio system configuration and capabilities.
 * 
 * This function retrieves the current audio configuration including
 * supported formats, voice options, and system capabilities.
 * 
 * @returns Promise with complete audio configuration
 */
export async function getAudioConfig(): Promise<AudioConfigResponse> {
  try {
    const response: AxiosResponse<AudioConfigResponse> = await audioAPI.get('/config')
    return response.data
  } catch (error) {
    handleAPIError(error)
  }
}

/**
 * Clear audio cache to free up storage space.
 * 
 * This function removes all cached audio files and temporary files,
 * useful for storage management and privacy compliance.
 * 
 * @returns Promise with cache clearing results
 */
export async function clearAudioCache(): Promise<{
  files_deleted: number
  space_freed_mb: number
  cache_directories: string[]
  cleared_at: string
  message: string
}> {
  try {
    const response = await audioAPI.delete('/cache/clear')
    return response.data
  } catch (error) {
    handleAPIError(error)
  }
}

/**
 * Check audio system health status.
 * 
 * This function verifies that all audio processing components
 * are functioning correctly and reports system status.
 * 
 * @returns Promise with health status information
 */
export async function checkAudioHealth(): Promise<HealthStatus> {
  try {
    const response: AxiosResponse<HealthStatus> = await audioAPI.get('/health')
    return response.data
  } catch (error) {
    handleAPIError(error)
  }
}

// ====================== UTILITY FUNCTIONS ======================

/**
 * Convert base64 audio data to blob.
 * 
 * @param base64Data - Base64 encoded audio data
 * @param mimeType - MIME type of the audio
 * @returns Audio blob
 */
export function base64ToBlob(base64Data: string, mimeType: string = 'audio/mp3'): Blob {
  const byteCharacters = atob(base64Data)
  const byteArrays = []

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512)
    const byteNumbers = new Array(slice.length)
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }
    
    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  return new Blob(byteArrays, { type: mimeType })
}

/**
 * Create audio element from blob with error handling.
 * 
 * @param audioBlob - Audio blob data
 * @returns Promise with audio element
 */
export function createAudioElement(audioBlob: Blob): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    
    audio.onloadeddata = () => {
      resolve(audio)
    }
    
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      reject(new Error('Failed to load audio'))
    }
    
    // Cleanup URL when audio ends
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
    }
  })
}

/**
 * Format audio duration in human-readable format.
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatAudioDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (minutes === 0) {
    return `${remainingSeconds}s`
  } else if (minutes < 60) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

/**
 * Format file size in human-readable format.
 * 
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Get quality color class based on score.
 * 
 * @param score - Quality score (0-1)
 * @returns CSS color class
 */
export function getQualityColorClass(score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.6) return 'text-blue-600'
  if (score >= 0.4) return 'text-yellow-600'
  return 'text-red-600'
}

/**
 * Validate audio file before processing.
 * 
 * @param file - Audio file to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns Validation result
 */
export function validateAudioFile(file: File, maxSizeMB: number = 50): {
  isValid: boolean
  error?: string
} {
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024)
  if (fileSizeMB > maxSizeMB) {
    return {
      isValid: false,
      error: `File too large: ${fileSizeMB.toFixed(1)}MB. Maximum allowed: ${maxSizeMB}MB`
    }
  }
  
  // Check file type
  const supportedTypes = [
    'audio/webm',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/m4a',
    'audio/ogg'
  ]
  
  if (!supportedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Unsupported format: ${file.type}. Supported formats: WebM, MP3, WAV, M4A, OGG`
    }
  }
  
  return { isValid: true }
}

// ====================== ERROR HELPER ======================

/**
 * Get user-friendly error message from AudioAPIError.
 * 
 * @param error - Audio API error
 * @returns User-friendly error message
 */
export function getErrorMessage(error: AudioAPIError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Network connection error. Please check your internet connection and try again.'
    case 'VALIDATION_ERROR':
      return error.message || 'Invalid audio file or parameters.'
    case 'PROCESSING_ERROR':
      return 'Audio processing failed. Please try again with a different audio file.'
    case 'QUOTA_EXCEEDED':
      return 'Processing quota exceeded. Please try again later.'
    case 'UNSUPPORTED_FORMAT':
      return 'Audio format not supported. Please use WebM, MP3, WAV, M4A, or OGG format.'
    default:
      if (error.status === 413) {
        return 'Audio file too large. Please use a smaller file.'
      } else if (error.status === 429) {
        return 'Too many requests. Please wait a moment and try again.'
      } else if (error.status >= 500) {
        return 'Server error. Please try again later.'
      }
      return error.message || 'An unexpected error occurred during audio processing.'
  }
} 