import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../../init'
import { adminMiddleware, superAdminMiddleware } from '../../middleware/admin'
import { adminCoursesRouter } from './courses'
import { adminCategoriesRouter } from './categories'
import { adminCouponsRouter } from './coupons'
import { TRPCError } from '@trpc/server'

// Admin procedure with middleware
const adminProcedure = publicProcedure.use(adminMiddleware)
const superAdminProcedure = publicProcedure.use(superAdminMiddleware)

export const adminRouter = createTRPCRouter({
  // Sub-routers
  courses: adminCoursesRouter,
  categories: adminCategoriesRouter,
  coupons: adminCouponsRouter,

  // Dashboard Statistics
  getDashboardStats: adminProcedure
    .query(async ({ ctx }) => {
      try {
        const [
          totalCourses,
          publishedCourses,
          totalStudents,
          totalProfessors,
          totalEnrollments,
          totalRevenue,
          recentEnrollments,
          topCourses,
          categoryStats,
          couponStats
        ] = await Promise.all([
          // Course statistics
          ctx.prisma.course.count(),
          ctx.prisma.course.count({ where: { published: true } }),
          
          // User statistics
          ctx.prisma.user.count({ where: { role: 'STUDENT' } }),
          ctx.prisma.user.count({ where: { role: 'PROFESSOR' } }),
          
          // Enrollment statistics
          ctx.prisma.enrollment.count(),
          
          // Revenue calculation
          ctx.prisma.order.aggregate({
            where: { status: 'PAID' },
            _sum: { total: true }
          }).then(result => result._sum.total || 0),
          
          // Recent enrollments (last 7 days)
          ctx.prisma.enrollment.count({
            where: {
              enrolledAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              }
            }
          }),
          
          // Top courses by enrollment
          ctx.prisma.course.findMany({
            take: 5,
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
          }),
          
          // Category distribution
          ctx.prisma.category.findMany({
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  courses: true
                }
              }
            },
            orderBy: {
              courses: {
                _count: 'desc'
              }
            },
            take: 10
          }),
          
          // Coupon usage
          ctx.prisma.coupon.aggregate({
            _sum: { usedCount: true },
            _count: true
          })
        ])

        return {
          courses: {
            total: totalCourses,
            published: publishedCourses,
            draft: totalCourses - publishedCourses,
            topCourses
          },
          users: {
            totalStudents,
            totalProfessors,
            total: totalStudents + totalProfessors
          },
          enrollments: {
            total: totalEnrollments,
            recent: recentEnrollments
          },
          revenue: {
            total: totalRevenue,
            // You could add more revenue metrics here
          },
          categories: categoryStats,
          coupons: {
            total: couponStats._count,
            totalUsage: couponStats._sum.usedCount || 0
          }
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch dashboard statistics'
        })
      }
    }),

  // User Management
  getUsers: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(10),
      search: z.string().optional(),
      role: z.enum(['STUDENT', 'PROFESSOR']).optional(),
      verified: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, role, verified } = input
      const skip = (page - 1) * limit

      const where = {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } }
          ]
        }),
        ...(role && { role }),
        ...(verified !== undefined && { verified }),
      }

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            verified: true,
            avatar: true,
            createdAt: true,
            _count: {
              select: {
                createdCourses: true,
                enrollments: true,
                orders: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        ctx.prisma.user.count({ where })
      ])

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  updateUserStatus: adminProcedure
    .input(z.object({
      userId: z.string().cuid(),
      verified: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { verified: input.verified },
          select: {
            id: true,
            name: true,
            email: true,
            verified: true
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: input.verified ? 'VERIFY_USER' : 'UNVERIFY_USER',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: user.id,
            resourceType: 'USER',
            metadata: {
              userName: user.name,
              userEmail: user.email
            }
          }
        })

        return user
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user status'
        })
      }
    }),

  // Enrollment Management
  getEnrollments: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(10),
      courseId: z.string().cuid().optional(),
      userId: z.string().cuid().optional(),
      status: z.enum(['ACTIVE', 'EXPIRED', 'REFUNDED']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, courseId, userId, status } = input
      const skip = (page - 1) * limit

      const where = {
        ...(courseId && { courseId }),
        ...(userId && { userId }),
        ...(status && { status }),
      }

      const [enrollments, total] = await Promise.all([
        ctx.prisma.enrollment.findMany({
          where,
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
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                thumbnail: true
              }
            },
            appliedCoupon: {
              select: {
                id: true,
                code: true,
                name: true,
                discountType: true,
                discountValue: true
              }
            }
          },
          orderBy: { enrolledAt: 'desc' }
        }),
        ctx.prisma.enrollment.count({ where })
      ])

      return {
        enrollments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Orders Management
  getOrders: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(10),
      status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
      userId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status, userId } = input
      const skip = (page - 1) * limit

      const where = {
        ...(status && { status }),
        ...(userId && { userId }),
      }

      const [orders, total] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            items: {
              include: {
                order: {
                  select: {
                    id: true
                  }
                }
              }
            },
            payments: {
              select: {
                id: true,
                amount: true,
                method: true,
                status: true,
                createdAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        ctx.prisma.order.count({ where })
      ])

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Audit Log
  getAuditLogs: superAdminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      action: z.string().optional(),
      actorId: z.string().optional(),
      resourceType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, action, actorId, resourceType } = input
      const skip = (page - 1) * limit

      const where = {
        ...(action && { action }),
        ...(actorId && { actorId }),
        ...(resourceType && { resourceType }),
      }

      const [logs, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        ctx.prisma.auditLog.count({ where })
      ])

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // System Health Check
  systemHealth: adminProcedure
    .query(async ({ ctx }) => {
      try {
        // Test database connection
        await ctx.prisma.$queryRaw`SELECT 1`
        
        // Get database stats
        const dbStats = await ctx.prisma.$queryRaw`
          SELECT 
            schemaname,
            tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes
          FROM pg_stat_user_tables 
          WHERE schemaname IN ('public', 'admin')
        ` as Array<{
          schemaname: string
          tablename: string
          inserts: bigint
          updates: bigint
          deletes: bigint
        }>

        return {
          status: 'healthy',
          timestamp: new Date(),
          database: {
            connected: true,
            tables: dbStats.length,
            totalOperations: dbStats.reduce((acc, table) => 
              acc + Number(table.inserts) + Number(table.updates) + Number(table.deletes), 0
            )
          }
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
          database: {
            connected: false
          }
        }
      }
    }),

  // Recent Activity
  getRecentActivity: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(10)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const activities = await ctx.prisma.auditLog.findMany({
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            actorType: true,
            resourceType: true,
            metadata: true,
            createdAt: true
          }
        })

        return activities.map(activity => ({
          id: activity.id,
          message: formatActivityMessage(activity.action, activity.metadata),
          type: getActivityType(activity.action),
          timestamp: activity.createdAt
        }))
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recent activity'
        })
      }
    })
})

// Helper functions for activity formatting
function formatActivityMessage(action: string, metadata: any): string {
  switch (action) {
    case 'CREATE_COURSE':
      return `New course "${metadata?.courseName || 'Unknown'}" was published`
    case 'USER_ENROLLMENT':
      return `User "${metadata?.userName || 'Unknown'}" enrolled in "${metadata?.courseName || 'Unknown'}"`
    case 'CREATE_COUPON':
      return `New coupon "${metadata?.couponCode || 'Unknown'}" was created`
    case 'VERIFY_USER':
      return `User "${metadata?.userEmail || 'Unknown'}" was verified`
    case 'UNVERIFY_USER':
      return `User "${metadata?.userEmail || 'Unknown'}" was unverified`
    case 'DELETE_COURSE':
      return `Course "${metadata?.courseName || 'Unknown'}" was deleted`
    case 'UPDATE_COURSE':
      return `Course "${metadata?.courseName || 'Unknown'}" was updated`
    default:
      return `${action.replace(/_/g, ' ').toLowerCase()}`
  }
}

function getActivityType(action: string): 'create' | 'update' | 'delete' | 'user' | 'other' {
  if (action.startsWith('CREATE_')) return 'create'
  if (action.startsWith('UPDATE_')) return 'update'
  if (action.startsWith('DELETE_')) return 'delete'
  if (action.includes('USER') || action.includes('ENROLLMENT')) return 'user'
  return 'other'
}