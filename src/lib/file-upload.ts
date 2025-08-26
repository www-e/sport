import { bunnyCDN, validateVideoFile, validateImageFile, validatePDFFile } from './bunny-cdn'
import type { VideoUploadProgress } from './bunny-cdn'

// Upload result interfaces
export interface VideoUploadResult {
  success: boolean
  videoId?: string
  url?: string
  thumbnailUrl?: string
  embedUrl?: string
  duration?: number
  error?: string
}

export interface FileUploadResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

export interface UploadProgressCallback {
  (progress: VideoUploadProgress): void
}

// Video upload with progress tracking
export async function uploadCourseVideo(
  file: File,
  courseId: string,
  lessonId: string,
  title: string,
  onProgress?: UploadProgressCallback
): Promise<VideoUploadResult> {
  try {
    // Validate video file
    const validation = validateVideoFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Upload to Bunny Stream
    const result = await bunnyCDN.uploadVideo(file, title, onProgress)
    
    return {
      success: true,
      videoId: result.guid,
      url: result.frameworkUrl,
      thumbnailUrl: result.thumbnailUrl,
      embedUrl: result.embedHtml,
      duration: result.length
    }
  } catch (error) {
    console.error('Video upload failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    }
  }
}

// Course thumbnail upload
export async function uploadCourseThumbnail(
  file: File,
  courseId: string
): Promise<FileUploadResult> {
  try {
    // Validate image file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `thumbnail-${timestamp}.${extension}`
    
    // Upload to Bunny Storage
    const result = await bunnyCDN.uploadFile(
      file,
      `courses/${courseId}/thumbnails`,
      fileName
    )
    
    return {
      success: true,
      url: result.url,
      path: result.path
    }
  } catch (error) {
    console.error('Thumbnail upload failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    }
  }
}

// Lesson thumbnail upload
export async function uploadLessonThumbnail(
  file: File,
  courseId: string,
  lessonId: string
): Promise<FileUploadResult> {
  try {
    // Validate image file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `lesson-thumbnail-${timestamp}.${extension}`
    
    // Upload to Bunny Storage
    const result = await bunnyCDN.uploadFile(
      file,
      `courses/${courseId}/lessons/${lessonId}/thumbnails`,
      fileName
    )
    
    return {
      success: true,
      url: result.url,
      path: result.path
    }
  } catch (error) {
    console.error('Lesson thumbnail upload failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    }
  }
}

// PDF/Document upload for lessons
export async function uploadLessonDocument(
  file: File,
  courseId: string,
  lessonId: string
): Promise<FileUploadResult> {
  try {
    // Validate PDF file
    const validation = validatePDFFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'pdf'
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}-${sanitizedName}`
    
    // Upload to Bunny Storage
    const result = await bunnyCDN.uploadFile(
      file,
      `courses/${courseId}/lessons/${lessonId}/documents`,
      fileName
    )
    
    return {
      success: true,
      url: result.url,
      path: result.path
    }
  } catch (error) {
    console.error('Document upload failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    }
  }
}

// Generic file upload for course assets
export async function uploadCourseAsset(
  file: File,
  courseId: string,
  assetType: 'image' | 'document' | 'video'
): Promise<FileUploadResult> {
  try {
    let validation
    
    // Validate based on asset type
    switch (assetType) {
      case 'image':
        validation = validateImageFile(file)
        break
      case 'document':
        validation = validatePDFFile(file)
        break
      case 'video':
        validation = validateVideoFile(file)
        break
      default:
        return { success: false, error: 'Invalid asset type' }
    }

    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'bin'
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}-${sanitizedName}`
    
    // Upload to Bunny Storage
    const result = await bunnyCDN.uploadFile(
      file,
      `courses/${courseId}/assets/${assetType}s`,
      fileName
    )
    
    return {
      success: true,
      url: result.url,
      path: result.path
    }
  } catch (error) {
    console.error('Asset upload failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    }
  }
}

// Batch upload utility for multiple files
export async function uploadMultipleFiles(
  files: File[],
  courseId: string,
  lessonId?: string,
  onProgress?: (fileIndex: number, progress: VideoUploadProgress) => void
): Promise<Array<FileUploadResult | VideoUploadResult>> {
  const results: Array<FileUploadResult | VideoUploadResult> = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    // Determine upload type based on file type
    if (file.type.startsWith('video/')) {
      if (lessonId) {
        const result = await uploadCourseVideo(
          file,
          courseId,
          lessonId,
          file.name,
          onProgress ? (progress) => onProgress(i, progress) : undefined
        )
        results.push(result)
      } else {
        results.push({ success: false, error: 'Lesson ID required for video uploads' })
      }
    } else if (file.type.startsWith('image/')) {
      const result = lessonId 
        ? await uploadLessonThumbnail(file, courseId, lessonId)
        : await uploadCourseThumbnail(file, courseId)
      results.push(result)
    } else if (file.type === 'application/pdf') {
      if (lessonId) {
        const result = await uploadLessonDocument(file, courseId, lessonId)
        results.push(result)
      } else {
        results.push({ success: false, error: 'Lesson ID required for document uploads' })
      }
    } else {
      results.push({ success: false, error: `Unsupported file type: ${file.type}` })
    }
  }
  
  return results
}

// Delete files utility
export async function deleteCourseFiles(filePaths: string[]): Promise<boolean[]> {
  const results: boolean[] = []
  
  for (const path of filePaths) {
    const success = await bunnyCDN.deleteFile(path)
    results.push(success)
  }
  
  return results
}

// File size formatter
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Progress formatter
export function formatUploadProgress(progress: VideoUploadProgress): string {
  return `${progress.percentage}% (${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)})`
}

// Utility to check if file is valid for upload
export function validateFileForUpload(
  file: File,
  type: 'video' | 'image' | 'pdf'
): { valid: boolean; error?: string } {
  switch (type) {
    case 'video':
      return validateVideoFile(file)
    case 'image':
      return validateImageFile(file)
    case 'pdf':
      return validatePDFFile(file)
    default:
      return { valid: false, error: 'Invalid file type specified' }
  }
}