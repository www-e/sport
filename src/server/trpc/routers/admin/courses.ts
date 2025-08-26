import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../../init'
import { adminMiddleware, superAdminMiddleware } from '../../middleware/admin'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().min(1),
  price: z.number().min(0),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  categoryId: z.string().cuid(),
  creatorId: z.string().cuid(), // Professor who will own this course
  language: z.string().default('en'),
  isFree: z.boolean().default(false),
  thumbnail: z.string().url().optional(),
  coverImage: z.string().url().optional(),
})

const updateCourseSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  categoryId: z.string().cuid().optional(),
  language: z.string().optional(),
  isFree: z.boolean().optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  thumbnail: z.string().url().optional(),
  coverImage: z.string().url().optional(),
})

const createLessonSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  order: z.number().int().min(1),
  videoUrl: z.string().url().optional(),
  videoDuration: z.number().int().min(0).optional(),
  thumbnail: z.string().url().optional(),
  transcript: z.string().optional(),
  freePreview: z.boolean().default(false),
  isRequired: z.boolean().default(true),
  canSkip: z.boolean().default(false),
})

const updateLessonSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  order: z.number().int().min(1).optional(),
  videoUrl: z.string().url().optional(),
  videoDuration: z.number().int().min(0).optional(),
  thumbnail: z.string().url().optional(),
  transcript: z.string().optional(),
  freePreview: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  canSkip: z.boolean().optional(),
})

const lessonAssetSchema = z.object({
  lessonId: z.string().cuid(),
  name: z.string().min(1),
  url: z.string().url(),
  type: z.enum(['VIDEO', 'PDF', 'IMAGE', 'DOCUMENT', 'AUDIO', 'ARCHIVE']),
  size: z.number().int().min(0),
  mimeType: z.string(),
  order: z.number().int().min(0).default(0),
})

// Admin procedure with middleware
const adminProcedure = publicProcedure.use(adminMiddleware)
const superAdminProcedure = publicProcedure.use(superAdminMiddleware)

export const adminCoursesRouter = createTRPCRouter({
  // Course Management
  createCourse: adminProcedure
    .input(createCourseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
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

        // Verify the creator exists and is a professor
        const creator = await ctx.prisma.user.findUnique({
          where: { id: input.creatorId }
        })

        if (!creator || creator.role !== 'PROFESSOR') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Creator must be a valid professor'
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
          data: input,
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            category: true,
            _count: {
              select: {
                lessons: true,
                enrollments: true
              }
            }
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'CREATE_COURSE',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: course.id,
            resourceType: 'COURSE',
            metadata: {
              courseTitle: course.title,
              creatorId: course.creatorId
            }
          }
        })

        return course
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

  updateCourse: adminProcedure
    .input(updateCourseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, slug, ...updateData } = input

        // Check if course exists
        const existingCourse = await ctx.prisma.course.findUnique({
          where: { id }
        })

        if (!existingCourse) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        // Check slug uniqueness if provided
        if (slug && slug !== existingCourse.slug) {
          const slugExists = await ctx.prisma.course.findUnique({
            where: { slug }
          })
          
          if (slugExists) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'A course with this slug already exists'
            })
          }
        }

        const course = await ctx.prisma.course.update({
          where: { id },
          data: { ...updateData, ...(slug && { slug }) },
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            category: true,
            _count: {
              select: {
                lessons: true,
                enrollments: true
              }
            }
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'UPDATE_COURSE',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: course.id,
            resourceType: 'COURSE',
            metadata: {
              courseTitle: course.title,
              changes: updateData
            }
          }
        })

        return course
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update course'
        })
      }
    }),

  deleteCourse: superAdminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.id },
          include: {
            enrollments: true,
            lessons: true
          }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        // Check if course has active enrollments
        if (course.enrollments.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cannot delete course with active enrollments'
          })
        }

        await ctx.prisma.course.delete({
          where: { id: input.id }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'DELETE_COURSE',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: input.id,
            resourceType: 'COURSE',
            metadata: {
              courseTitle: course.title,
              lessonCount: course.lessons.length
            }
          }
        })

        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete course'
        })
      }
    }),

  getCourses: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(10),
      search: z.string().optional(),
      categoryId: z.string().cuid().optional(),
      published: z.boolean().optional(),
      featured: z.boolean().optional(),
      creatorId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, categoryId, published, featured, creatorId } = input
      const skip = (page - 1) * limit

      const where = {
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { creator: { name: { contains: search, mode: 'insensitive' as const } } }
          ]
        }),
        ...(categoryId && { categoryId }),
        ...(published !== undefined && { published }),
        ...(featured !== undefined && { featured }),
        ...(creatorId && { creatorId }),
      }

      const [courses, total] = await Promise.all([
        ctx.prisma.course.findMany({
          where,
          skip,
          take: limit,
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            category: true,
            _count: {
              select: {
                lessons: true,
                enrollments: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        ctx.prisma.course.count({ where })
      ])

      return {
        courses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  getCourse: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.prisma.course.findUnique({
        where: { id: input.id },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          category: true,
          lessons: {
            include: {
              lessonAssets: true,
              _count: {
                select: {
                  progress: true
                }
              }
            },
            orderBy: { order: 'asc' }
          },
          assets: true,
          coupons: {
            include: {
              coupon: true
            }
          },
          _count: {
            select: {
              enrollments: true
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

      return course
    }),

  // Lesson Management
  createLesson: adminProcedure
    .input(createLessonSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify course exists
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
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

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'CREATE_LESSON',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: lesson.id,
            resourceType: 'LESSON',
            metadata: {
              lessonTitle: lesson.title,
              courseId: lesson.courseId,
              order: lesson.order
            }
          }
        })

        return lesson
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create lesson'
        })
      }
    }),

  updateLesson: adminProcedure
    .input(updateLessonSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...updateData } = input

        const lesson = await ctx.prisma.lesson.update({
          where: { id },
          data: updateData,
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
            action: 'UPDATE_LESSON',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: lesson.id,
            resourceType: 'LESSON',
            metadata: {
              lessonTitle: lesson.title,
              changes: updateData
            }
          }
        })

        return lesson
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update lesson'
        })
      }
    }),

  deleteLesson: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: input.id },
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

        await ctx.prisma.lesson.delete({
          where: { id: input.id }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'DELETE_LESSON',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: input.id,
            resourceType: 'LESSON',
            metadata: {
              lessonTitle: lesson.title,
              courseId: lesson.courseId
            }
          }
        })

        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete lesson'
        })
      }
    }),

  // Lesson Asset Management
  addLessonAsset: adminProcedure
    .input(lessonAssetSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const asset = await ctx.prisma.lessonAsset.create({
          data: input,
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                courseId: true
              }
            }
          }
        })

        return asset
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add lesson asset'
        })
      }
    }),

  removeLessonAsset: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.prisma.lessonAsset.delete({
          where: { id: input.id }
        })

        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove lesson asset'
        })
      }
    }),

  // Bulk operations
  bulkUpdateLessonOrder: adminProcedure
    .input(z.object({
      courseId: z.string().cuid(),
      lessons: z.array(z.object({
        id: z.string().cuid(),
        order: z.number().int().min(1)
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Update lesson orders in a transaction
        await ctx.prisma.$transaction(
          input.lessons.map(lesson =>
            ctx.prisma.lesson.update({
              where: { id: lesson.id },
              data: { order: lesson.order }
            })
          )
        )

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'BULK_UPDATE_LESSON_ORDER',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: input.courseId,
            resourceType: 'COURSE',
            metadata: {
              lessonUpdates: input.lessons.length
            }
          }
        })

        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update lesson order'
        })
      }
    }),
})