import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../init'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const validateCouponSchema = z.object({
  code: z.string().min(1),
  courseId: z.string().cuid().optional(),
})

const applyCouponSchema = z.object({
  code: z.string().min(1),
  courseId: z.string().cuid(),
})

const calculateDiscountSchema = z.object({
  couponCode: z.string(),
  courseId: z.string().cuid(),
  originalPrice: z.number().min(0),
})

export const couponsRouter = createTRPCRouter({
  // Validate coupon (public - for checking before application)
  validateCoupon: publicProcedure
    .input(validateCouponSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { code, courseId } = input

        const coupon = await ctx.prisma.coupon.findUnique({
          where: { code: code.toUpperCase() },
          include: {
            courseCoupons: courseId ? {
              where: { courseId }
            } : undefined
          }
        })

        if (!coupon) {
          return {
            valid: false,
            error: 'Coupon not found'
          }
        }

        // Check if coupon is active
        if (!coupon.isActive) {
          return {
            valid: false,
            error: 'This coupon is no longer active'
          }
        }

        // Check date validity
        const now = new Date()
        if (coupon.validFrom && coupon.validFrom > now) {
          return {
            valid: false,
            error: 'This coupon is not yet valid'
          }
        }

        if (coupon.validUntil && coupon.validUntil < now) {
          return {
            valid: false,
            error: 'This coupon has expired'
          }
        }

        // Check usage limits
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          return {
            valid: false,
            error: 'This coupon has reached its usage limit'
          }
        }

        // Check course applicability
        if (!coupon.isGlobal && courseId) {
          if (coupon.courseCoupons.length === 0) {
            return {
              valid: false,
              error: 'This coupon is not applicable to this course'
            }
          }
        }

        return {
          valid: true,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            isGlobal: coupon.isGlobal,
            maxUses: coupon.maxUses,
            usedCount: coupon.usedCount,
            validUntil: coupon.validUntil
          }
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate coupon'
        })
      }
    }),

  // Calculate discount amount
  calculateDiscount: publicProcedure
    .input(calculateDiscountSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { couponCode, courseId, originalPrice } = input

        // First validate the coupon
        const validation = await ctx.prisma.coupon.findUnique({
          where: { code: couponCode.toUpperCase() },
          include: {
            courseCoupons: {
              where: { courseId }
            }
          }
        })

        if (!validation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Coupon not found'
          })
        }

        // Check coupon validity (same checks as validate)
        if (!validation.isActive) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon is not active'
          })
        }

        const now = new Date()
        if (validation.validFrom && validation.validFrom > now) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon is not yet valid'
          })
        }

        if (validation.validUntil && validation.validUntil < now) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon has expired'
          })
        }

        if (validation.maxUses && validation.usedCount >= validation.maxUses) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon usage limit reached'
          })
        }

        if (!validation.isGlobal && validation.courseCoupons.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon is not applicable to this course'
          })
        }

        // Calculate discount
        let discountAmount = 0
        if (validation.discountType === 'PERCENTAGE') {
          discountAmount = (originalPrice * Number(validation.discountValue)) / 100
        } else {
          // FIXED_AMOUNT
          discountAmount = Math.min(Number(validation.discountValue), originalPrice)
        }

        const finalPrice = Math.max(0, originalPrice - discountAmount)
        const discountPercentage = originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0

        return {
          originalPrice,
          discountAmount,
          finalPrice,
          discountPercentage,
          savings: discountAmount,
          coupon: {
            code: validation.code,
            name: validation.name,
            discountType: validation.discountType,
            discountValue: validation.discountValue
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to calculate discount'
        })
      }
    }),

  // Apply coupon (protected - requires authentication)
  applyCoupon: protectedProcedure
    .input(applyCouponSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { code, courseId } = input
        const userId = ctx.user.id

        const coupon = await ctx.prisma.coupon.findUnique({
          where: { code: code.toUpperCase() },
          include: {
            courseCoupons: {
              where: { courseId }
            },
            couponUsage: {
              where: { userId }
            }
          }
        })

        if (!coupon) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Coupon not found'
          })
        }

        // All the same validation checks
        if (!coupon.isActive) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon is not active'
          })
        }

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

        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon usage limit reached'
          })
        }

        // Check per-user usage limit
        if (coupon.maxUsesPerUser && coupon.couponUsage.length >= coupon.maxUsesPerUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You have reached the usage limit for this coupon'
          })
        }

        if (!coupon.isGlobal && coupon.courseCoupons.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon is not applicable to this course'
          })
        }

        // Check if user is already enrolled in this course
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

        // Get course details for price calculation
        const course = await ctx.prisma.course.findUnique({
          where: { id: courseId },
          select: {
            id: true,
            title: true,
            price: true,
            isFree: true
          }
        })

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Course not found'
          })
        }

        if (course.isFree) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupons cannot be applied to free courses'
          })
        }

        // Calculate discount
        const originalPrice = Number(course.price)
        let discountAmount = 0

        if (coupon.discountType === 'PERCENTAGE') {
          discountAmount = (originalPrice * Number(coupon.discountValue)) / 100
        } else {
          discountAmount = Math.min(Number(coupon.discountValue), originalPrice)
        }

        const finalPrice = Math.max(0, originalPrice - discountAmount)

        return {
          success: true,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name
          },
          pricing: {
            originalPrice,
            discountAmount,
            finalPrice,
            savings: discountAmount
          },
          course: {
            id: course.id,
            title: course.title
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to apply coupon'
        })
      }
    }),

  // Get user's coupon usage history
  getUserCouponHistory: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit } = input
      const skip = (page - 1) * limit
      const userId = ctx.user.id

      const [couponUsage, total] = await Promise.all([
        ctx.prisma.couponUsage.findMany({
          where: { userId },
          skip,
          take: limit,
          include: {
            coupon: {
              select: {
                id: true,
                code: true,
                name: true,
                discountType: true,
                discountValue: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        ctx.prisma.couponUsage.count({ where: { userId } })
      ])

      // Get course information for each usage
      const couponUsageWithCourses = await Promise.all(
        couponUsage.map(async (usage) => {
          let course = null
          if (usage.courseId) {
            course = await ctx.prisma.course.findUnique({
              where: { id: usage.courseId },
              select: {
                id: true,
                title: true,
                slug: true
              }
            })
          }

          return {
            ...usage,
            course
          }
        })
      )

      return {
        couponUsage: couponUsageWithCourses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Get available coupons for a course (public)
  getAvailableCoupons: publicProcedure
    .input(z.object({
      courseId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { courseId } = input
      const now = new Date()

      // Get active global coupons
      const globalCoupons = await ctx.prisma.coupon.findMany({
        where: {
          isActive: true,
          isGlobal: true,
          AND: [
            { validFrom: { lte: now } },
            {
              OR: [
                { validUntil: null },
                { validUntil: { gte: now } }
              ]
            },
            {
              OR: [
                { maxUses: null },
                { usedCount: { lt: ctx.prisma.coupon.fields.maxUses } }
              ]
            }
          ]
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          discountType: true,
          discountValue: true,
          validUntil: true,
          maxUses: true,
          usedCount: true
        },
        orderBy: { discountValue: 'desc' }
      })

      let courseSpecificCoupons: any[] = []

      // Get course-specific coupons if courseId provided
      if (courseId) {
        courseSpecificCoupons = await ctx.prisma.coupon.findMany({
          where: {
            isActive: true,
            isGlobal: false,
            courseCoupons: {
              some: {
                courseId
              }
            },
            AND: [
              { validFrom: { lte: now } },
              {
                OR: [
                  { validUntil: null },
                  { validUntil: { gte: now } }
                ]
              },
              {
                OR: [
                  { maxUses: null },
                  { usedCount: { lt: ctx.prisma.coupon.fields.maxUses } }
                ]
              }
            ]
          },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            discountType: true,
            discountValue: true,
            validUntil: true,
            maxUses: true,
            usedCount: true
          },
          orderBy: { discountValue: 'desc' }
        })
      }

      return {
        globalCoupons,
        courseSpecificCoupons,
        total: globalCoupons.length + courseSpecificCoupons.length
      }
    }),

  // Get coupon details by code (public)
  getCouponByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const coupon = await ctx.prisma.coupon.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          discountType: true,
          discountValue: true,
          isActive: true,
          isGlobal: true,
          validFrom: true,
          validUntil: true,
          maxUses: true,
          usedCount: true,
          courseCoupons: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  price: true
                }
              }
            }
          }
        }
      })

      if (!coupon) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Coupon not found'
        })
      }

      return coupon
    })
})