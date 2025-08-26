import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../init'
import { adminMiddleware } from '../middleware/admin'
import { TRPCError } from '@trpc/server'
import { 
  uploadCourseVideo, 
  uploadCourseThumbnail, 
  uploadLessonThumbnail, 
  uploadLessonDocument,
  type VideoUploadResult,
  type FileUploadResult 
} from '@/lib/file-upload'

// Input validation schemas
const createCourseStepOneSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().min(10),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  categoryId: z.string().cuid(),
  creatorId: z.string().cuid(), // Professor who will own this course
  language: z.string().default('en'),
  isFree: z.boolean().default(false),
  price: z.number().min(0),
})

const updateCourseBasicInfoSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  categoryId: z.string().cuid().optional(),
  language: z.string().optional(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).optional(),
})

const uploadThumbnailSchema = z.object({
  courseId: z.string().cuid(),
  fileData: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    data: z.string(), // base64 encoded file data
  }),
})

const addLessonSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  order: z.number().int().min(1),
  freePreview: z.boolean().default(false),
  isRequired: z.boolean().default(true),
  canSkip: z.boolean().default(false),
})

const uploadLessonVideoSchema = z.object({
  lessonId: z.string().cuid(),
  fileData: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    data: z.string(), // base64 encoded file data
  }),
})

const uploadLessonAssetSchema = z.object({
  lessonId: z.string().cuid(),
  assetType: z.enum(['PDF', 'IMAGE', 'DOCUMENT']),
  fileData: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    data: z.string(), // base64 encoded file data
  }),
})

const publishCourseSchema = z.object({
  courseId: z.string().cuid(),
  published: z.boolean(),
})

const bulkAddLessonsSchema = z.object({
  courseId: z.string().cuid(),
  lessons: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    order: z.number().int().min(1),
    freePreview: z.boolean().default(false),
    isRequired: z.boolean().default(true),
    canSkip: z.boolean().default(false),
  })).min(1).max(50), // Limit to 50 lessons at once
})

// Admin procedure with middleware
const adminProcedure = protectedProcedure.use(adminMiddleware)

export const uploadRouter = createTRPCRouter({
  // Step 1: Create course basic information
  createCourseStep1: adminProcedure
    .input(createCourseStepOneSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify professor exists
        const professor = await ctx.prisma.user.findUnique({
          where: { id: input.creatorId },
          select: { id: true, role: true }
        })

        if (!professor || professor.role !== 'PROFESSOR') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid professor ID'
          })
        }

        // Check if slug already exists
        const existingCourse = await ctx.prisma.course.findUnique({
          where: { slug: input.slug }
        })
        
        if (existingCourse) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A course with this slug already exists'
          })
        }

        // Verify category exists
        const category = await ctx.prisma.category.findUnique({
          where: { id: input.categoryId }
        })

        if (!category) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        const course = await ctx.prisma.course.create({
          data: {
            ...input,
            creatorId: input.creatorId,
            published: false, // Always start as draft
          },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            category: true
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'CREATE_COURSE_DRAFT',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: course.id,
            resourceType: 'COURSE',
            metadata: {
              courseTitle: course.title,
              step: 'basic_info'
            }
          }
        })

        return {
          course,
          nextStep: 'thumbnail'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create course'
        })
      }
    }),

  // Step 2: Upload course thumbnail
  uploadCourseThumbnail: adminProcedure
    .input(uploadThumbnailSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { courseId, fileData } = input

        // Verify course exists and is owned by current admin's assigned professor
        const course = await ctx.prisma.course.findUnique({
          where: { id: courseId }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(fileData.data, 'base64')
        
        // Create File object from buffer
        const file = new File([buffer], fileData.name, { type: fileData.type })

        // Upload thumbnail to Bunny CDN
        const uploadResult = await uploadCourseThumbnail(file, courseId)

        if (!uploadResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: uploadResult.error || 'Failed to upload thumbnail'
          })
        }

        // Update course with thumbnail URL
        const updatedCourse = await ctx.prisma.course.update({
          where: { id: courseId },
          data: { thumbnail: uploadResult.url },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            category: true
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'UPLOAD_COURSE_THUMBNAIL',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: courseId,
            resourceType: 'COURSE',
            metadata: {
              thumbnailUrl: uploadResult.url,
              step: 'thumbnail'
            }
          }
        })

        return {
          course: updatedCourse,
          thumbnail: {
            url: uploadResult.url,
            path: uploadResult.path
          },
          nextStep: 'lessons'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload course thumbnail'
        })
      }
    }),

  // Step 3: Add lessons to course
  addLesson: adminProcedure
    .input(addLessonSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify course exists
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId },
          include: {
            lessons: {
              select: {
                order: true
              }
            }
          }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        // Check if order already exists
        const existingLesson = await ctx.prisma.lesson.findFirst({
          where: {
            courseId: input.courseId,
            order: input.order
          }
        })

        if (existingLesson) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A lesson with this order already exists'
          })
        }

        const lesson = await ctx.prisma.lesson.create({
          data: input,
          include: {
            course: {
              select: {
                id: true,
                title: true
              }
            }
          }
        })

        return {
          lesson,
          nextStep: 'video_upload'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add lesson'
        })
      }
    }),

  // Bulk add lessons
  bulkAddLessons: adminProcedure
    .input(bulkAddLessonsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { courseId, lessons } = input

        // Verify course exists
        const course = await ctx.prisma.course.findUnique({
          where: { id: courseId }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        // Check for duplicate orders
        const orders = lessons.map(l => l.order)
        const uniqueOrders = new Set(orders)
        if (orders.length !== uniqueOrders.size) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Duplicate lesson orders are not allowed'
          })
        }

        // Check if any orders already exist
        const existingLessons = await ctx.prisma.lesson.findMany({
          where: {
            courseId,
            order: { in: orders }
          },
          select: { order: true }
        })

        if (existingLessons.length > 0) {
          const conflictingOrders = existingLessons.map(l => l.order)
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Lessons with orders ${conflictingOrders.join(', ')} already exist`
          })
        }

        // Create lessons in transaction
        const createdLessons = await ctx.prisma.$transaction(
          lessons.map(lesson =>
            ctx.prisma.lesson.create({
              data: {
                ...lesson,
                courseId
              }
            })
          )
        )

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'BULK_ADD_LESSONS',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: courseId,
            resourceType: 'COURSE',
            metadata: {
              lessonCount: createdLessons.length,
              step: 'lessons'
            }
          }
        })

        return {
          lessons: createdLessons,
          nextStep: 'video_uploads'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk add lessons'
        })
      }
    }),

  // Step 4: Upload lesson video
  uploadLessonVideo: adminProcedure
    .input(uploadLessonVideoSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { lessonId, fileData } = input

        // Verify lesson exists
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: lessonId },
          include: {
            course: {
              select: {
                id: true,
                title: true
              }
            }
          }
        })

        if (!lesson) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          })
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(fileData.data, 'base64')
        
        // Create File object from buffer
        const file = new File([buffer], fileData.name, { type: fileData.type })

        // Upload video to Bunny Stream
        const uploadResult = await uploadCourseVideo(
          file,
          lesson.courseId,
          lessonId,
          `${lesson.course.title} - ${lesson.title}`
        )

        if (!uploadResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: uploadResult.error || 'Failed to upload video'
          })
        }

        // Update lesson with video information
        const updatedLesson = await ctx.prisma.lesson.update({
          where: { id: lessonId },
          data: {
            videoUrl: uploadResult.url,
            videoDuration: uploadResult.duration,
            thumbnail: uploadResult.thumbnailUrl
          },
          include: {
            course: {
              select: {
                id: true,
                title: true
              }
            }
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'UPLOAD_LESSON_VIDEO',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: lessonId,
            resourceType: 'LESSON',
            metadata: {
              videoUrl: uploadResult.url,
              duration: uploadResult.duration,
              step: 'video_upload'
            }
          }
        })

        return {
          lesson: updatedLesson,
          video: {
            url: uploadResult.url,
            thumbnailUrl: uploadResult.thumbnailUrl,
            embedUrl: uploadResult.embedUrl,
            duration: uploadResult.duration
          },
          nextStep: 'assets'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload lesson video'
        })
      }
    }),

  // Step 5: Upload lesson assets (PDFs, documents)
  uploadLessonAsset: adminProcedure
    .input(uploadLessonAssetSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { lessonId, assetType, fileData } = input

        // Verify lesson exists
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: lessonId },
          include: {
            course: {
              select: {
                id: true,
                title: true
              }
            }
          }
        })

        if (!lesson) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          })
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(fileData.data, 'base64')
        
        // Create File object from buffer
        const file = new File([buffer], fileData.name, { type: fileData.type })

        let uploadResult: FileUploadResult

        // Upload based on asset type
        if (assetType === 'PDF') {
          uploadResult = await uploadLessonDocument(file, lesson.courseId, lessonId)
        } else if (assetType === 'IMAGE') {
          uploadResult = await uploadLessonThumbnail(file, lesson.courseId, lessonId)
        } else {
          uploadResult = await uploadLessonDocument(file, lesson.courseId, lessonId)
        }

        if (!uploadResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: uploadResult.error || 'Failed to upload asset'
          })
        }

        // Create lesson asset record
        const asset = await ctx.prisma.lessonAsset.create({
          data: {
            lessonId,
            name: fileData.name,
            url: uploadResult.url!,
            type: assetType,
            size: fileData.size,
            mimeType: fileData.type,
            order: 0 // You could make this configurable
          }
        })

        return {
          asset,
          nextStep: 'review'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload lesson asset'
        })
      }
    }),

  // Step 6: Review and publish course
  getCourseForReview: adminProcedure
    .input(z.object({ courseId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          category: true,
          lessons: {
            include: {
              lessonAssets: true
            },
            orderBy: { order: 'asc' }
          }
        }
      })

      if (!course) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Course not found'
        })
      }

      // Calculate completion status
      const completionChecks = {
        hasBasicInfo: !!(course.title && course.description && course.categoryId),
        hasThumbnail: !!course.thumbnail,
        hasLessons: course.lessons.length > 0,
        allLessonsHaveVideos: course.lessons.every(lesson => lesson.videoUrl),
        hasPrice: course.isFree || course.price.toNumber() > 0
      }

      const isReadyToPublish = Object.values(completionChecks).every(check => check)

      return {
        course,
        completionChecks,
        isReadyToPublish,
        totalLessons: course.lessons.length,
        totalAssets: course.lessons.reduce((sum, lesson) => sum + lesson.lessonAssets.length, 0)
      }
    }),

  // Publish course
  publishCourse: adminProcedure
    .input(publishCourseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { courseId, published } = input

        // Get course for validation
        const course = await ctx.prisma.course.findUnique({
          where: { id: courseId },
          include: {
            lessons: true
          }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        // Validate course is ready for publishing
        if (published) {
          const validationErrors = []

          if (!course.title || !course.description) {
            validationErrors.push('Course must have title and description')
          }

          if (!course.thumbnail) {
            validationErrors.push('Course must have a thumbnail')
          }

          if (course.lessons.length === 0) {
            validationErrors.push('Course must have at least one lesson')
          }

          if (!course.isFree && course.price.toNumber() <= 0) {
            validationErrors.push('Paid course must have a price greater than 0')
          }

          const lessonsWithoutVideos = course.lessons.filter(lesson => !lesson.videoUrl)
          if (lessonsWithoutVideos.length > 0) {
            validationErrors.push(`${lessonsWithoutVideos.length} lessons are missing videos`)
          }

          if (validationErrors.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Course is not ready for publishing: ${validationErrors.join(', ')}`
            })
          }
        }

        // Update course publication status
        const updatedCourse = await ctx.prisma.course.update({
          where: { id: courseId },
          data: { published },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            category: true,
            _count: {
              select: {
                lessons: true
              }
            }
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: published ? 'PUBLISH_COURSE' : 'UNPUBLISH_COURSE',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: courseId,
            resourceType: 'COURSE',
            metadata: {
              courseTitle: course.title,
              lessonCount: course.lessons.length
            }
          }
        })

        return {
          course: updatedCourse,
          message: published ? 'Course published successfully!' : 'Course unpublished successfully!'
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update course publication status'
        })
      }
    }),

  // Get upload progress for a course
  getUploadProgress: adminProcedure
    .input(z.object({ courseId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.courseId },
        include: {
          lessons: {
            include: {
              lessonAssets: true
            }
          }
        }
      })

      if (!course) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Course not found'
        })
      }

      const steps = [
        {
          step: 'basic_info',
          name: 'Basic Information',
          completed: !!(course.title && course.description && course.categoryId),
          required: true
        },
        {
          step: 'thumbnail',
          name: 'Course Thumbnail',
          completed: !!course.thumbnail,
          required: true
        },
        {
          step: 'lessons',
          name: 'Lessons',
          completed: course.lessons.length > 0,
          required: true,
          details: {
            total: course.lessons.length,
            withVideos: course.lessons.filter(l => l.videoUrl).length,
            withAssets: course.lessons.filter(l => l.lessonAssets.length > 0).length
          }
        },
        {
          step: 'pricing',
          name: 'Pricing',
          completed: course.isFree || course.price.toNumber() > 0,
          required: true
        },
        {
          step: 'review',
          name: 'Review & Publish',
          completed: course.published,
          required: false
        }
      ]

      const completedSteps = steps.filter(s => s.completed).length
      const totalSteps = steps.length
      const progressPercentage = (completedSteps / totalSteps) * 100

      return {
        course: {
          id: course.id,
          title: course.title,
          published: course.published
        },
        steps,
        progress: {
          completed: completedSteps,
          total: totalSteps,
          percentage: progressPercentage
        }
      }
    })
})