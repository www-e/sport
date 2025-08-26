import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../init'
import { professorMiddleware, courseOwnershipMiddleware } from '../middleware/admin'
import { TRPCError } from '@trpc/server'
import { z as zod } from 'zod'

// Professor procedure with middleware
const professorProcedure = protectedProcedure.use(professorMiddleware)

export const professorRouter = createTRPCRouter({
  // Dashboard Overview
  getDashboardOverview: professorProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          })
        }
        
        const professorId = ctx.user.id

        const [
          totalCourses,
          publishedCourses,
          totalStudents,
          totalRevenue,
          recentEnrollments,
          topPerformingCourses
        ] = await Promise.all([
          // Total courses created by professor
          ctx.prisma.course.count({
            where: { creatorId: professorId }
          }),

          // Published courses
          ctx.prisma.course.count({
            where: { 
              creatorId: professorId,
              published: true 
            }
          }),

          // Total unique students across all courses
          ctx.prisma.enrollment.count({
            where: {
              course: {
                creatorId: professorId
              }
            }
          }),

          // Total revenue from professor's courses
          ctx.prisma.order.aggregate({
            where: {
              status: 'PAID',
              items: {
                some: {
                  order: {
                    items: {
                      some: {
                        courseId: {
                          in: await ctx.prisma.course.findMany({
                            where: { creatorId: professorId },
                            select: { id: true }
                          }).then(courses => courses.map(c => c.id))
                        }
                      }
                    }
                  }
                }
              }
            },
            _sum: { total: true }
          }).then(result => result._sum.total || 0),

          // Recent enrollments (last 30 days)
          ctx.prisma.enrollment.count({
            where: {
              course: {
                creatorId: professorId
              },
              enrolledAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          }),

          // Top performing courses by enrollment
          ctx.prisma.course.findMany({
            where: { creatorId: professorId },
            take: 5,
            include: {
              category: {
                select: {
                  id: true,
                  name: true
                }
              },
              _count: {
                select: {
                  enrollments: true,
                  lessons: true
                }
              }
            },
            orderBy: {
              enrollments: {
                _count: 'desc'
              }
            }
          })
        ])

        return {
          courses: {
            total: totalCourses,
            published: publishedCourses,
            draft: totalCourses - publishedCourses
          },
          students: {
            total: totalStudents,
            recent: recentEnrollments
          },
          revenue: {
            total: totalRevenue
          },
          topCourses: topPerformingCourses
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch dashboard overview'
        })
      }
    }),

  // Get Professor's Courses
  getMyCourses: professorProcedure
    .input(zod.object({
      page: zod.number().int().min(1).default(1),
      limit: zod.number().int().min(1).max(50).default(10),
      search: zod.string().optional(),
      published: zod.boolean().optional(),
      categoryId: zod.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        })
      }
      
      const { page, limit, search, published, categoryId } = input
      const skip = (page - 1) * limit
      const professorId = ctx.user.id

      const where = {
        creatorId: professorId,
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } }
          ]
        }),
        ...(published !== undefined && { published }),
        ...(categoryId && { categoryId }),
      }

      const [courses, total] = await Promise.all([
        ctx.prisma.course.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            _count: {
              select: {
                lessons: true,
                enrollments: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' }
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

  // Get Course Details with Analytics
  getCourseAnalytics: professorProcedure
    .use(courseOwnershipMiddleware)
    .input(z.object({ courseId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId },
          include: {
            category: true,
            lessons: {
              include: {
                _count: {
                  select: {
                    progress: true
                  }
                }
              },
              orderBy: { order: 'asc' }
            },
            enrollments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true
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
            },
            _count: {
              select: {
                enrollments: true,
                lessons: true
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

        // Calculate course completion rates
        const completionStats = await ctx.prisma.studentProgress.findMany({
          where: { courseId: input.courseId },
          select: {
            completionRate: true,
            totalWatchTime: true
          }
        })

        const avgCompletionRate = completionStats.length > 0 
          ? completionStats.reduce((sum, stat) => sum + stat.completionRate, 0) / completionStats.length 
          : 0

        const totalWatchTime = completionStats.reduce((sum, stat) => sum + stat.totalWatchTime, 0)

        // Get revenue data for this course
        const revenueData = await ctx.prisma.order.aggregate({
          where: {
            status: 'PAID',
            items: {
              some: {
                courseId: input.courseId
              }
            }
          },
          _sum: { total: true },
          _count: true
        })

        return {
          course,
          analytics: {
            enrollmentCount: course._count.enrollments,
            lessonCount: course._count.lessons,
            avgCompletionRate,
            totalWatchTime,
            revenue: {
              total: revenueData._sum.total || 0,
              orderCount: revenueData._count
            }
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch course analytics'
        })
      }
    }),

  // Get Student Progress for a Course
  getCourseStudentProgress: professorProcedure
    .use(courseOwnershipMiddleware)
    .input(z.object({
      courseId: z.string().cuid(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      completionFilter: z.enum(['all', 'completed', 'in_progress', 'not_started']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const { courseId, page, limit, search, completionFilter } = input
      const skip = (page - 1) * limit

      // Build where clause for student progress
      const progressWhere: {
        courseId: string;
        completionRate?: {
          gte?: number;
          gt?: number;
          lt?: number;
          equals?: number;
        };
        user?: {
          OR: Array<{
            name?: { contains: string; mode: 'insensitive' };
            email?: { contains: string; mode: 'insensitive' };
          }>;
        };
      } = { courseId }

      if (completionFilter !== 'all') {
        switch (completionFilter) {
          case 'completed':
            progressWhere.completionRate = { gte: 100 }
            break
          case 'in_progress':
            progressWhere.completionRate = { gt: 0, lt: 100 }
            break
          case 'not_started':
            progressWhere.completionRate = { equals: 0 }
            break
        }
      }

      // Add user search filter
      if (search) {
        progressWhere.user = {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      }

      const [studentProgress, total] = await Promise.all([
        ctx.prisma.studentProgress.findMany({
          where: progressWhere,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true
              }
            },
            lessonProgress: {
              include: {
                lesson: {
                  select: {
                    id: true,
                    title: true,
                    order: true
                  }
                }
              },
              orderBy: {
                lesson: {
                  order: 'asc'
                }
              }
            }
          },
          orderBy: { lastAccessedAt: 'desc' }
        }),
        ctx.prisma.studentProgress.count({ where: progressWhere })
      ])

      return {
        studentProgress,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Get Lesson Analytics
  getLessonAnalytics: professorProcedure
    .input(zod.object({
      courseId: zod.string().cuid(),
      lessonId: zod.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          })
        }
        
        // Verify course ownership
        const course = await ctx.prisma.course.findUnique({
          where: { 
            id: input.courseId,
            creatorId: ctx.user.id 
          }
        })

        if (!course) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only view analytics for your own courses'
          })
        }

        const whereClause = {
          lesson: {
            courseId: input.courseId,
            ...(input.lessonId && { id: input.lessonId })
          }
        }

        const [lessonProgress, lessons] = await Promise.all([
          ctx.prisma.lessonProgress.findMany({
            where: whereClause,
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  videoDuration: true
                }
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }),
          ctx.prisma.lesson.findMany({
            where: {
              courseId: input.courseId,
              ...(input.lessonId && { id: input.lessonId })
            },
            include: {
              _count: {
                select: {
                  progress: true
                }
              }
            },
            orderBy: { order: 'asc' }
          })
        ])

        // Calculate analytics for each lesson
        const lessonAnalytics = lessons.map(lesson => {
          const progressData = lessonProgress.filter(p => p.lesson.id === lesson.id)
          const completedCount = progressData.filter(p => p.completed).length
          const totalWatchTime = progressData.reduce((sum, p) => sum + p.watchTime, 0)
          const avgWatchTime = progressData.length > 0 ? totalWatchTime / progressData.length : 0
          const completionRate = progressData.length > 0 ? (completedCount / progressData.length) * 100 : 0

          return {
            lesson: {
              id: lesson.id,
              title: lesson.title,
              order: lesson.order,
              videoDuration: lesson.videoDuration
            },
            analytics: {
              totalViews: progressData.length,
              completedViews: completedCount,
              completionRate,
              totalWatchTime,
              avgWatchTime,
              engagementRate: lesson.videoDuration && lesson.videoDuration > 0
                ? (avgWatchTime / lesson.videoDuration) * 100
                : 0
            }
          }
        })

        return {
          lessonAnalytics,
          summary: {
            totalLessons: lessons.length,
            totalViews: lessonProgress.length,
            avgCompletionRate: lessonAnalytics.length > 0
              ? lessonAnalytics.reduce((sum, l) => sum + l.analytics.completionRate, 0) / lessonAnalytics.length
              : 0,
            totalWatchTime: lessonProgress.reduce((sum, p) => sum + p.watchTime, 0)
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch lesson analytics'
        })
      }
    }),

  // Get Revenue Analytics
  getRevenueAnalytics: professorProcedure
    .input(zod.object({
      courseId: zod.string().cuid().optional(),
      timeRange: zod.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          })
        }
        
        const professorId = ctx.user.id
        const { timeRange, courseId } = input

        // Calculate date range
        let startDate: Date | undefined
        switch (timeRange) {
          case '7d':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            break
          case '90d':
            startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            break
          case '1y':
            startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            break
        }

        // Get professor's course IDs
        const professorCourses = await ctx.prisma.course.findMany({
          where: { 
            creatorId: professorId,
            ...(courseId && { id: courseId })
          },
          select: { id: true }
        })
        const courseIds = professorCourses.map(c => c.id)

        if (courseIds.length === 0) {
          return {
            totalRevenue: 0,
            orderCount: 0,
            avgOrderValue: 0,
            revenueByTime: [],
            topCourses: []
          }
        }

        const whereClause = {
          status: 'PAID' as const,
          items: {
            some: {
              courseId: { in: courseIds }
            }
          },
          ...(startDate && {
            createdAt: {
              gte: startDate
            }
          })
        }

        const [revenueData, orders, courseRevenue] = await Promise.all([
          // Total revenue and order count
          ctx.prisma.order.aggregate({
            where: whereClause,
            _sum: { total: true },
            _count: true
          }),

          // Orders for time-based analysis
          ctx.prisma.order.findMany({
            where: whereClause,
            select: {
              total: true,
              createdAt: true,
              items: {
                where: {
                  courseId: { in: courseIds }
                },
                select: {
                  courseId: true,
                  price: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          }),

          // Revenue by course
          ctx.prisma.order.findMany({
            where: whereClause,
            include: {
              items: {
                where: {
                  courseId: { in: courseIds }
                },
                include: {
                  order: {
                    select: {
                      id: true
                    }
                  }
                }
              }
            }
          })
        ])

        const totalRevenue = revenueData._sum.total || 0
        const orderCount = revenueData._count
        const avgOrderValue = orderCount > 0 ? Number(totalRevenue) / orderCount : 0

        // Calculate revenue by time (daily aggregation)
        const revenueByTime = orders.reduce((acc, order) => {
          const date = order.createdAt.toISOString().split('T')[0]
          const existing = acc.find(item => item.date === date)
          if (existing) {
            existing.revenue += Number(order.total)
            existing.orders += 1
          } else {
            acc.push({
              date,
              revenue: Number(order.total),
              orders: 1
            })
          }
          return acc
        }, [] as Array<{ date: string; revenue: number; orders: number }>)

        // Get top performing courses by revenue
        const courseRevenueMap = new Map<string, { revenue: number; orders: number }>()
        
        courseRevenue.forEach(order => {
          order.items.forEach(item => {
            if (courseIds.includes(item.courseId)) {
              const existing = courseRevenueMap.get(item.courseId) || { revenue: 0, orders: 0 }
              existing.revenue += Number(item.price)
              existing.orders += 1
              courseRevenueMap.set(item.courseId, existing)
            }
          })
        })

        const topCourses = await Promise.all(
          Array.from(courseRevenueMap.entries())
            .sort(([, a], [, b]) => b.revenue - a.revenue)
            .slice(0, 5)
            .map(async ([courseId, stats]) => {
              const course = await ctx.prisma.course.findUnique({
                where: { id: courseId },
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  price: true
                }
              })
              return {
                course,
                revenue: stats.revenue,
                orders: stats.orders
              }
            })
        )

        return {
          totalRevenue: Number(totalRevenue),
          orderCount,
          avgOrderValue,
          revenueByTime,
          topCourses: topCourses.filter(item => item.course !== null)
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch revenue analytics'
        })
      }
    }),

  // Get Course Statistics Summary
  getCourseStats: professorProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          })
        }
        
        const professorId = ctx.user.id

        const [courses, totalEnrollments, totalRevenue] = await Promise.all([
          ctx.prisma.course.findMany({
            where: { creatorId: professorId },
            include: {
              _count: {
                select: {
                  enrollments: true,
                  lessons: true
                }
              }
            }
          }),
          ctx.prisma.enrollment.count({
            where: {
              course: {
                creatorId: professorId
              }
            }
          }),
          ctx.prisma.order.aggregate({
            where: {
              status: 'PAID',
              items: {
                some: {
                  courseId: {
                    in: await ctx.prisma.course.findMany({
                      where: { creatorId: professorId },
                      select: { id: true }
                    }).then(courses => courses.map(c => c.id))
                  }
                }
              }
            },
            _sum: { total: true }
          }).then(result => result._sum.total || 0)
        ])

        const publishedCourses = courses.filter(c => c.published).length
        const totalLessons = courses.reduce((sum, course) => sum + course._count.lessons, 0)
        const avgEnrollmentsPerCourse = courses.length > 0 ? totalEnrollments / courses.length : 0

        return {
          totalCourses: courses.length,
          publishedCourses,
          draftCourses: courses.length - publishedCourses,
          totalLessons,
          totalEnrollments,
          avgEnrollmentsPerCourse,
          totalRevenue: Number(totalRevenue)
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch course statistics'
        })
      }
    })
})