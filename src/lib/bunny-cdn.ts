import axios, { AxiosError } from 'axios'
import FormData from 'form-data'

// Bunny CDN Configuration
export const BUNNY_CONFIG = {
  // Storage Zone configuration
  STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME || '',
  STORAGE_ACCESS_KEY: process.env.BUNNY_STORAGE_ACCESS_KEY || '',
  STORAGE_BASE_URL: `https://storage.bunnycdn.com`,
  
  // Stream (Video) configuration
  LIBRARY_ID: process.env.BUNNY_LIBRARY_ID || '',
  STREAM_ACCESS_KEY: process.env.BUNNY_STREAM_ACCESS_KEY || '',
  STREAM_BASE_URL: 'https://video.bunnycdn.com/library',
  
  // CDN Pull Zone for file delivery
  PULL_ZONE_URL: process.env.BUNNY_PULL_ZONE_URL || '',
} as const

// Validate configuration
export function validateBunnyConfig() {
  const missing = []
  if (!BUNNY_CONFIG.STORAGE_ZONE_NAME) missing.push('BUNNY_STORAGE_ZONE_NAME')
  if (!BUNNY_CONFIG.STORAGE_ACCESS_KEY) missing.push('BUNNY_STORAGE_ACCESS_KEY')
  if (!BUNNY_CONFIG.LIBRARY_ID) missing.push('BUNNY_LIBRARY_ID')
  if (!BUNNY_CONFIG.STREAM_ACCESS_KEY) missing.push('BUNNY_STREAM_ACCESS_KEY')
  if (!BUNNY_CONFIG.PULL_ZONE_URL) missing.push('BUNNY_PULL_ZONE_URL')
  
  if (missing.length > 0) {
    throw new Error(`Missing Bunny CDN environment variables: ${missing.join(', ')}`)
  }
}

// Check if Bunny CDN is configured
export function isBunnyConfigured(): boolean {
  return !!(BUNNY_CONFIG.STORAGE_ZONE_NAME && 
           BUNNY_CONFIG.STORAGE_ACCESS_KEY && 
           BUNNY_CONFIG.LIBRARY_ID && 
           BUNNY_CONFIG.STREAM_ACCESS_KEY && 
           BUNNY_CONFIG.PULL_ZONE_URL)
}

// Types
export interface BunnyVideoUploadResponse {
  videoLibraryId: number
  guid: string
  title: string
  dateUploaded: string
  views: number
  isPublic: boolean
  length: number
  status: number
  frameworkUrl: string
  thumbnailUrl: string
  embedHtml: string
}

export interface BunnyFileUploadResponse {
  success: boolean
  url: string
  path: string
}

export interface VideoUploadProgress {
  loaded: number
  total: number
  percentage: number
}

// Bunny CDN API Client
export class BunnyCDNClient {
  private storageHeaders: Record<string, string>
  private streamHeaders: Record<string, string>

  constructor() {
    // Only validate when actually instantiated
    if (typeof window === 'undefined') {
      // In server environment, only validate if we're not in build time
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE !== 'phase-production-build') {
        validateBunnyConfig()
      }
    } else {
      // In browser environment, always validate
      validateBunnyConfig()
    }
    
    this.storageHeaders = {
      'AccessKey': BUNNY_CONFIG.STORAGE_ACCESS_KEY,
      'Content-Type': 'application/octet-stream',
    }
    
    this.streamHeaders = {
      'AccessKey': BUNNY_CONFIG.STREAM_ACCESS_KEY,
      'Content-Type': 'application/json',
    }
  }

  // Upload video to Bunny Stream
  async uploadVideo(
    file: File | Buffer, 
    title: string,
    onProgress?: (progress: VideoUploadProgress) => void
  ): Promise<BunnyVideoUploadResponse> {
    try {
      const formData = new FormData()
      formData.append('title', title)
      
      if (file instanceof File) {
        formData.append('file', file)
      } else {
        formData.append('file', file, { filename: `${title}.mp4` })
      }

      const response = await axios.post(
        `${BUNNY_CONFIG.STREAM_BASE_URL}/${BUNNY_CONFIG.LIBRARY_ID}/videos`,
        formData,
        {
          headers: {
            ...this.streamHeaders,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const progress = {
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
              }
              onProgress(progress)
            }
          }
        }
      )

      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`Video upload failed: ${error.response?.data?.message || error.message}`)
      }
      throw error
    }
  }

  // Upload file (thumbnails, PDFs, etc.) to Bunny Storage
  async uploadFile(
    file: File | Buffer,
    path: string,
    fileName: string
  ): Promise<BunnyFileUploadResponse> {
    try {
      const fullPath = `/${BUNNY_CONFIG.STORAGE_ZONE_NAME}/${path}/${fileName}`
      
      const response = await axios.put(
        `${BUNNY_CONFIG.STORAGE_BASE_URL}${fullPath}`,
        file,
        {
          headers: this.storageHeaders,
        }
      )

      if (response.status === 201) {
        return {
          success: true,
          url: `${BUNNY_CONFIG.PULL_ZONE_URL}/${path}/${fileName}`,
          path: fullPath
        }
      }

      throw new Error(`Upload failed with status: ${response.status}`)
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`File upload failed: ${error.response?.data?.message || error.message}`)
      }
      throw error
    }
  }

  // Delete file from Bunny Storage
  async deleteFile(path: string): Promise<boolean> {
    try {
      const fullPath = `/${BUNNY_CONFIG.STORAGE_ZONE_NAME}${path}`
      
      const response = await axios.delete(
        `${BUNNY_CONFIG.STORAGE_BASE_URL}${fullPath}`,
        {
          headers: {
            'AccessKey': BUNNY_CONFIG.STORAGE_ACCESS_KEY,
          }
        }
      )

      return response.status === 200
    } catch (error) {
      console.error('File deletion failed:', error)
      return false
    }
  }

  // Get video details from Bunny Stream
  async getVideoDetails(videoId: string): Promise<BunnyVideoUploadResponse> {
    try {
      const response = await axios.get(
        `${BUNNY_CONFIG.STREAM_BASE_URL}/${BUNNY_CONFIG.LIBRARY_ID}/videos/${videoId}`,
        {
          headers: this.streamHeaders
        }
      )

      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`Failed to get video details: ${error.response?.data?.message || error.message}`)
      }
      throw error
    }
  }

  // Delete video from Bunny Stream
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const response = await axios.delete(
        `${BUNNY_CONFIG.STREAM_BASE_URL}/${BUNNY_CONFIG.LIBRARY_ID}/videos/${videoId}`,
        {
          headers: this.streamHeaders
        }
      )

      return response.status === 200
    } catch (error) {
      console.error('Video deletion failed:', error)
      return false
    }
  }

  // Generate signed URL for secure video access
  generateSignedUrl(videoId: string, expires?: number): string {
    const expiry = expires || Math.floor(Date.now() / 1000) + 3600 // 1 hour default
    // This would require implementing HMAC signing based on your security needs
    // For now, returning the basic URL
    return `${BUNNY_CONFIG.PULL_ZONE_URL}/video/${videoId}`
  }
}

// Utility functions
export function getVideoEmbedUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_CONFIG.LIBRARY_ID}/${videoId}`
}

export function getThumbnailUrl(videoId: string): string {
  return `https://vz-${BUNNY_CONFIG.LIBRARY_ID}.b-cdn.net/${videoId}/thumbnail.jpg`
}

export function getVideoPlayerUrl(videoId: string): string {
  return `https://vz-${BUNNY_CONFIG.LIBRARY_ID}.b-cdn.net/${videoId}/playlist.m3u8`
}

// File type validation
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm']
  const maxSize = 2 * 1024 * 1024 * 1024 // 2GB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only MP4, MOV, AVI, and WebM are allowed.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size too large. Maximum size is 2GB.' }
  }

  return { valid: true }
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size too large. Maximum size is 10MB.' }
  }

  return { valid: true }
}

export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024 // 50MB

  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Invalid file type. Only PDF files are allowed.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size too large. Maximum size is 50MB.' }
  }

  return { valid: true }
}

// Export singleton instance
export const bunnyCDN = new BunnyCDNClient()