import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../init'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const updateProgressSchema = z.object({
  lessonId: z.string().cuid(),
  watchTime: z.number().int().min(0), // seconds watched
  lastPosition: z.number().int().min(0), // current position in video
  completed: z.boolean().optional(),
})

const markLessonCompleteSchema = z.object({
  lessonId: z.string().cuid(),
  watchTime: z.number().int().min(0),
})

const enrollCourseSchema = z.object({
  courseId: z.string().cuid(),
  couponCode: z.string().optional(),
})

export const studentRouter = createTRPCRouter({
  // Enroll in a course
  enrollCourse: protectedProcedure
    .input(enrollCourseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { courseId, couponCode } = input
        const userId = ctx.user.id

        // Check if user is already enrolled
        const existingEnrollment = await ctx.prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId
            }
          }
        })

        if (existingEnrollment) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You are already enrolled in this course'
          })
        }

        // Get course details
        const course = await ctx.prisma.course.findUnique({
          where: { id: courseId },
          include: {
            lessons: {
              select: {
                id: true,
                order: true
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

        if (!course.published) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Course is not available for enrollment'
          })
        }

        let appliedCouponId: string | undefined = undefined

        // Validate coupon if provided
        if (couponCode) {
          const coupon = await ctx.prisma.coupon.findUnique({
            where: { code: couponCode },
            include: {
              courseCoupons: {
                where: { courseId }
              },
              couponUsage: {
                where: { userId }
              }
            }
          })

          if (!coupon || !coupon.isActive) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid or inactive coupon'
            })
          }

          // Check coupon validity
          const now = new Date()
          if (coupon.validFrom && coupon.validFrom > now) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Coupon is not yet valid'
            })
          }

          if (coupon.validUntil && coupon.validUntil < now) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Coupon has expired'
            })
          }

          // Check usage limits
          if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Coupon usage limit reached'
            })
          }

          if (coupon.maxUsesPerUser && coupon.couponUsage.length >= coupon.maxUsesPerUser) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'You have reached the usage limit for this coupon'
            })
          }

          // Check course applicability
          if (!coupon.isGlobal && coupon.courseCoupons.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Coupon is not applicable to this course'
            })
          }

          appliedCouponId = coupon.id
        }

        // Create enrollment and initial progress tracking in a transaction
        const result = await ctx.prisma.$transaction(async (tx) => {
          // Create enrollment
          const enrollment = await tx.enrollment.create({
            data: {
              userId,
              courseId,
              appliedCouponId,
              status: 'ACTIVE'
            },
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  slug: true
                }
              },
              appliedCoupon: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          })

          // Create initial student progress record
          const studentProgress = await tx.studentProgress.create({
            data: {
              userId,
              courseId,
              totalWatchTime: 0,
              completionRate: 0
            }
          })

          // Create initial lesson progress records for all lessons
          if (course.lessons.length > 0) {
            await tx.lessonProgress.createMany({
              data: course.lessons.map(lesson => ({
                userId,
                lessonId: lesson.id,
                studentProgressId: studentProgress.id,
                watchTime: 0,
                completed: false,
                lastPosition: 0
              }))
            })
          }

          // Update coupon usage if applicable
          if (appliedCouponId) {
            await tx.coupon.update({
              where: { id: appliedCouponId },
              data: { usedCount: { increment: 1 } }
            })

            await tx.couponUsage.create({
              data: {
                userId,
                couponId: appliedCouponId,
                courseId,
                discountAmount: 0 // Calculate based on coupon type
              }
            })
          }

          return enrollment
        })

        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to enroll in course'
        })
      }
    }),

  // Update lesson progress (called during video watching)
  updateLessonProgress: protectedProcedure
    .input(updateProgressSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { lessonId, watchTime, lastPosition, completed } = input
        const userId = ctx.user.id

        // Get lesson and verify enrollment
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: lessonId },
          include: {
            course: {
              include: {
                enrollments: {
                  where: { userId },
                  include: {
                    user: true
                  }
                }
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

        const enrollment = lesson.course.enrollments[0]
        if (!enrollment) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You must be enrolled in this course to track progress'
          })
        }

        // Get student progress record
        const studentProgress = await ctx.prisma.studentProgress.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId: lesson.courseId
            }
          }
        })

        if (!studentProgress) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Student progress record not found'
          })
        }

        // Update lesson progress
        const lessonProgress = await ctx.prisma.lessonProgress.upsert({
          where: {
            userId_lessonId: {
              userId,
              lessonId
            }
          },
          update: {
            watchTime: Math.max(watchTime, 0), // Ensure non-negative
            lastPosition,
            ...(completed !== undefined && { completed }),
            ...(completed && !await ctx.prisma.lessonProgress.findFirst({
              where: { userId, lessonId, completed: true }
            }) && { completedAt: new Date() })
          },
          create: {
            userId,
            lessonId,
            studentProgressId: studentProgress.id,
            watchTime: Math.max(watchTime, 0),
            lastPosition,
            completed: completed || false,
            ...(completed && { completedAt: new Date() })
          }
        })

        // Recalculate course completion rate
        await updateCourseProgress(ctx.prisma, userId, lesson.courseId)

        // Update student progress last accessed
        await ctx.prisma.studentProgress.update({
          where: { id: studentProgress.id },
          data: { lastAccessedAt: new Date() }
        })

        return lessonProgress
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update lesson progress'
        })
      }
    }),

  // Mark lesson as complete
  markLessonComplete: protectedProcedure
    .input(markLessonCompleteSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { lessonId, watchTime } = input
        const userId = ctx.user.id

        // Check if lesson can be marked complete (if it's required)
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: lessonId },
          include: {
            course: {
              include: {
                enrollments: {
                  where: { userId }
                }
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

        if (lesson.course.enrollments.length === 0) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You must be enrolled in this course'
          })
        }

        // Check if previous required lessons are completed (if this lesson is required)
        if (lesson.isRequired) {
          const previousRequiredLessons = await ctx.prisma.lesson.findMany({
            where: {
              courseId: lesson.courseId,
              order: { lt: lesson.order },
              isRequired: true
            },
            include: {
              progress: {
                where: {
                  userId,
                  completed: true
                }
              }
            }
          })

          const uncompletedRequired = previousRequiredLessons.filter(
            l => l.progress.length === 0
          )

          if (uncompletedRequired.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'You must complete all previous required lessons first'
            })
          }
        }

        // Update lesson progress
        const lessonProgress = await ctx.prisma.lessonProgress.upsert({
          where: {
            userId_lessonId: {
              userId,
              lessonId
            }
          },
          update: {
            completed: true,
            completedAt: new Date(),
            watchTime: Math.max(watchTime, 0)
          },
          create: {
            userId,
            lessonId,
            studentProgressId: (await ctx.prisma.studentProgress.findUniqueOrThrow({
              where: {
                userId_courseId: {
                  userId,
                  courseId: lesson.courseId
                }
              }
            })).id,
            completed: true,
            completedAt: new Date(),
            watchTime: Math.max(watchTime, 0),
            lastPosition: 0
          }
        })

        // Recalculate course progress
        await updateCourseProgress(ctx.prisma, userId, lesson.courseId)

        return lessonProgress
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to mark lesson as complete'
        })
      }
    }),

  // Get student's course progress
  getCourseProgress: protectedProcedure
    .input(z.object({ courseId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id
      const { courseId } = input

      // Verify enrollment
      const enrollment = await ctx.prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId
          }
        },
        include: {
          course: {
            include: {
              lessons: {
                include: {
                  progress: {
                    where: { userId }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })

      if (!enrollment) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not enrolled in this course'
        })
      }

      // Get overall progress
      const studentProgress = await ctx.prisma.studentProgress.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId
          }
        }
      })

      return {
        enrollment,
        progress: studentProgress,
        lessons: enrollment.course.lessons.map(lesson => ({
          ...lesson,
          userProgress: lesson.progress[0] || null
        }))
      }
    }),

  // Get student's enrolled courses
  getEnrolledCourses: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(10),
      status: z.enum(['ACTIVE', 'EXPIRED', 'REFUNDED']).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status, search } = input
      const skip = (page - 1) * limit
      const userId = ctx.user.id

      const where = {
        userId,
        ...(status && { status }),
        ...(search && {
          course: {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        })
      }

      const [enrollments, total] = await Promise.all([
        ctx.prisma.enrollment.findMany({
          where,
          skip,
          take: limit,
          include: {
            course: {
              include: {
                creator: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                category: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                _count: {
                  select: {
                    lessons: true
                  }
                }
              }
            },
            appliedCoupon: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          },
          orderBy: { enrolledAt: 'desc' }
        }),
        ctx.prisma.enrollment.count({ where })
      ])

      // Get progress for each course
      const enrollmentsWithProgress = await Promise.all(
        enrollments.map(async (enrollment) => {
          const progress = await ctx.prisma.studentProgress.findUnique({
            where: {
              userId_courseId: {
                userId,
                courseId: enrollment.courseId
              }
            }
          })

          return {
            ...enrollment,
            progress
          }
        })
      )

      return {
        enrollments: enrollmentsWithProgress,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Get lesson for study (with next/previous lesson info)
  getLessonForStudy: protectedProcedure
    .input(z.object({
      lessonId: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id
      const { lessonId } = input

      const lesson = await ctx.prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          course: {
            include: {
              enrollments: {
                where: { userId }
              },
              lessons: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  isRequired: true,
                  canSkip: true
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          lessonAssets: {
            orderBy: { order: 'asc' }
          },
          progress: {
            where: { userId }
          }
        }
      })

      if (!lesson) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lesson not found'
        })
      }

      if (lesson.course.enrollments.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be enrolled in this course to access lessons'
        })
      }

      // Find next and previous lessons
      const currentIndex = lesson.course.lessons.findIndex(l => l.id === lessonId)
      const previousLesson = currentIndex > 0 ? lesson.course.lessons[currentIndex - 1] : null
      const nextLesson = currentIndex < lesson.course.lessons.length - 1 
        ? lesson.course.lessons[currentIndex + 1] : null

      // Check if lesson is accessible (previous required lessons completed)
      let canAccess = true
      if (lesson.isRequired && previousLesson) {
        const previousRequiredLessons = lesson.course.lessons
          .slice(0, currentIndex)
          .filter(l => l.isRequired)

        if (previousRequiredLessons.length > 0) {
          const completedRequired = await ctx.prisma.lessonProgress.count({
            where: {
              userId,
              lessonId: { in: previousRequiredLessons.map(l => l.id) },
              completed: true
            }
          })

          canAccess = completedRequired === previousRequiredLessons.length
        }
      }

      return {
        lesson: {
          ...lesson,
          userProgress: lesson.progress[0] || null
        },
        navigation: {
          previous: previousLesson,
          next: nextLesson,
          canAccess
        }
      }
    })
})

// Helper function to update course completion rate
async function updateCourseProgress(prisma: any, userId: string, courseId: string) {
  const [totalLessons, completedLessons, totalWatchTime] = await Promise.all([
    prisma.lesson.count({
      where: { courseId }
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        lesson: { courseId },
        completed: true
      }
    }),
    prisma.lessonProgress.aggregate({
      where: {
        userId,
        lesson: { courseId }
      },
      _sum: { watchTime: true }
    }).then((result: any) => result._sum.watchTime || 0)
  ])

  const completionRate = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  await prisma.studentProgress.update({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    data: {
      completionRate,
      totalWatchTime
    }
  })

  // Update enrollment progress
  await prisma.enrollment.update({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    data: {
      progress: completionRate,
      ...(completionRate === 100 && { completedAt: new Date() })
    }
  })
}