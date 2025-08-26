import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../../init'
import { adminMiddleware, superAdminMiddleware } from '../../middleware/admin'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const createCouponSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/, 'Coupon code must contain only uppercase letters, numbers, underscores, and hyphens'),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: z.number().min(0),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
  isGlobal: z.boolean().default(false),
  courseIds: z.array(z.string().cuid()).optional(), // For course-specific coupons
  isActive: z.boolean().default(true),
}).refine((data) => {
  // Validate discount value based on type
  if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue']
}).refine((data) => {
  // Validate date range
  if (data.validFrom && data.validUntil && data.validFrom >= data.validUntil) {
    return false
  }
  return true
}, {
  message: 'Valid until date must be after valid from date',
  path: ['validUntil']
})

const updateCouponSchema = z.object({
  id: z.string().cuid(),
  code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  discountValue: z.number().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
  isGlobal: z.boolean().optional(),
  courseIds: z.array(z.string().cuid()).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.discountType === 'PERCENTAGE' && data.discountValue && data.discountValue > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue']
})

const validateCouponSchema = z.object({
  code: z.string(),
  courseId: z.string().cuid().optional(),
  userId: z.string().cuid(),
})

// Admin procedure with middleware
const adminProcedure = publicProcedure.use(adminMiddleware)
const superAdminProcedure = publicProcedure.use(superAdminMiddleware)

export const adminCouponsRouter = createTRPCRouter({
  // Create Coupon
  createCoupon: adminProcedure
    .input(createCouponSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { courseIds, ...couponData } = input

        // Check if coupon code already exists
        const existingCoupon = await ctx.prisma.coupon.findUnique({
          where: { code: input.code }
        })

        if (existingCoupon) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A coupon with this code already exists'
          })
        }

        // If course-specific, validate courses exist
        if (courseIds && courseIds.length > 0) {
          const courses = await ctx.prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true }
          })

          if (courses.length !== courseIds.length) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'One or more courses not found'
            })
          }
        }

        const coupon = await ctx.prisma.coupon.create({
          data: {
            ...couponData,
            createdById: ctx.admin.id,
            validFrom: couponData.validFrom || new Date(),
          },
          include: {
            _count: {
              select: {
                enrollments: true,
                couponUsage: true,
                courseCoupons: true
              }
            }
          }
        })

        // Create course-coupon relationships if specified
        if (courseIds && courseIds.length > 0) {
          await ctx.prisma.courseCoupon.createMany({
            data: courseIds.map(courseId => ({
              couponId: coupon.id,
              courseId
            }))
          })
        }

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'CREATE_COUPON',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: coupon.id,
            resourceType: 'COUPON',
            metadata: {
              couponCode: coupon.code,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue.toString(),
              isGlobal: coupon.isGlobal,
              courseCount: courseIds?.length || 0
            }
          }
        })

        return coupon
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create coupon'
        })
      }
    }),

  // Update Coupon
  updateCoupon: adminProcedure
    .input(updateCouponSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, code, courseIds, ...updateData } = input

        // Check if coupon exists
        const existingCoupon = await ctx.prisma.coupon.findUnique({
          where: { id },
          include: {
            courseCoupons: true
          }
        })

        if (!existingCoupon) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Coupon not found'
          })
        }

        // Check code uniqueness if provided
        if (code && code !== existingCoupon.code) {
          const codeExists = await ctx.prisma.coupon.findUnique({
            where: { code }
          })

          if (codeExists) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'A coupon with this code already exists'
            })
          }
        }

        const coupon = await ctx.prisma.coupon.update({
          where: { id },
          data: {
            ...updateData,
            ...(code && { code })
          },
          include: {
            _count: {
              select: {
                enrollments: true,
                couponUsage: true,
                courseCoupons: true
              }
            }
          }
        })

        // Update course relationships if provided
        if (courseIds !== undefined) {
          // Remove existing relationships
          await ctx.prisma.courseCoupon.deleteMany({
            where: { couponId: id }
          })

          // Add new relationships
          if (courseIds.length > 0) {
            await ctx.prisma.courseCoupon.createMany({
              data: courseIds.map(courseId => ({
                couponId: id,
                courseId
              }))
            })
          }
        }

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'UPDATE_COUPON',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: coupon.id,
            resourceType: 'COUPON',
            metadata: {
              couponCode: coupon.code,
              changes: { ...updateData, ...(code && { code }) }
            }
          }
        })

        return coupon
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update coupon'
        })
      }
    }),

  // Delete Coupon
  deleteCoupon: superAdminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const coupon = await ctx.prisma.coupon.findUnique({
          where: { id: input.id },
          include: {
            enrollments: true,
            couponUsage: true
          }
        })

        if (!coupon) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Coupon not found'
          })
        }

        // Check if coupon has been used
        if (coupon.enrollments.length > 0 || coupon.couponUsage.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cannot delete coupon that has been used. Deactivate it instead.'
          })
        }

        await ctx.prisma.coupon.delete({
          where: { id: input.id }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'DELETE_COUPON',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: input.id,
            resourceType: 'COUPON',
            metadata: {
              couponCode: coupon.code
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
          message: 'Failed to delete coupon'
        })
      }
    }),

  // Get All Coupons
  getCoupons: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(10),
      search: z.string().optional(),
      isActive: z.boolean().optional(),
      isGlobal: z.boolean().optional(),
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, isActive, isGlobal, discountType } = input
      const skip = (page - 1) * limit

      const where = {
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } }
          ]
        }),
        ...(isActive !== undefined && { isActive }),
        ...(isGlobal !== undefined && { isGlobal }),
        ...(discountType && { discountType }),
      }

      const [coupons, total] = await Promise.all([
        ctx.prisma.coupon.findMany({
          where,
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                enrollments: true,
                couponUsage: true,
                courseCoupons: true
              }
            },
            courseCoupons: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    slug: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        ctx.prisma.coupon.count({ where })
      ])

      return {
        coupons,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Get Coupon by ID
  getCoupon: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const coupon = await ctx.prisma.coupon.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              enrollments: true,
              couponUsage: true,
              courseCoupons: true
            }
          },
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
          },
          couponUsage: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
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
    }),

  // Validate Coupon (for checking before application)
  validateCoupon: adminProcedure
    .input(validateCouponSchema)
    .query(async ({ ctx, input }) => {
      const { code, courseId, userId } = input

      const coupon = await ctx.prisma.coupon.findUnique({
        where: { code },
        include: {
          courseCoupons: {
            where: courseId ? { courseId } : undefined
          },
          couponUsage: {
            where: { userId }
          }
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
          error: 'Coupon is not active'
        }
      }

      // Check date validity
      const now = new Date()
      if (coupon.validFrom && coupon.validFrom > now) {
        return {
          valid: false,
          error: 'Coupon is not yet valid'
        }
      }

      if (coupon.validUntil && coupon.validUntil < now) {
        return {
          valid: false,
          error: 'Coupon has expired'
        }
      }

      // Check usage limits
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return {
          valid: false,
          error: 'Coupon usage limit reached'
        }
      }

      if (coupon.maxUsesPerUser && coupon.couponUsage.length >= coupon.maxUsesPerUser) {
        return {
          valid: false,
          error: 'User usage limit reached for this coupon'
        }
      }

      // Check course applicability
      if (!coupon.isGlobal && courseId) {
        if (coupon.courseCoupons.length === 0) {
          return {
            valid: false,
            error: 'Coupon is not applicable to this course'
          }
        }
      }

      return {
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          isGlobal: coupon.isGlobal
        }
      }
    }),

  // Calculate Discount
  calculateDiscount: adminProcedure
    .input(z.object({
      couponId: z.string().cuid(),
      originalPrice: z.number().min(0),
    }))
    .query(async ({ ctx, input }) => {
      const coupon = await ctx.prisma.coupon.findUnique({
        where: { id: input.couponId }
      })

      if (!coupon) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Coupon not found'
        })
      }

      let discountAmount = 0
      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = (input.originalPrice * Number(coupon.discountValue)) / 100
      } else {
        discountAmount = Math.min(Number(coupon.discountValue), input.originalPrice)
      }

      const finalPrice = Math.max(0, input.originalPrice - discountAmount)

      return {
        originalPrice: input.originalPrice,
        discountAmount,
        finalPrice,
        discountPercentage: input.originalPrice > 0 ? (discountAmount / input.originalPrice) * 100 : 0
      }
    }),

  // Get Coupon Statistics
  getCouponStats: adminProcedure
    .query(async ({ ctx }) => {
      const [
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalUsage,
        globalCoupons,
        courseSpecificCoupons
      ] = await Promise.all([
        ctx.prisma.coupon.count(),
        ctx.prisma.coupon.count({ where: { isActive: true } }),
        ctx.prisma.coupon.count({ 
          where: { 
            AND: [
              { validUntil: { lt: new Date() } },
              { isActive: true }
            ]
          } 
        }),
        ctx.prisma.couponUsage.count(),
        ctx.prisma.coupon.count({ where: { isGlobal: true } }),
        ctx.prisma.coupon.count({ where: { isGlobal: false } })
      ])

      const topCoupons = await ctx.prisma.coupon.findMany({
        orderBy: { usedCount: 'desc' },
        take: 5,
        select: {
          id: true,
          code: true,
          name: true,
          usedCount: true,
          discountType: true,
          discountValue: true
        }
      })

      return {
        totalCoupons,
        activeCoupons,
        inactiveCoupons: totalCoupons - activeCoupons,
        expiredCoupons,
        totalUsage,
        globalCoupons,
        courseSpecificCoupons,
        topCoupons
      }
    }),

  // Deactivate Expired Coupons (utility function)
  deactivateExpiredCoupons: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await ctx.prisma.coupon.updateMany({
          where: {
            AND: [
              { validUntil: { lt: new Date() } },
              { isActive: true }
            ]
          },
          data: { isActive: false }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'DEACTIVATE_EXPIRED_COUPONS',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: null,
            resourceType: 'COUPON',
            metadata: {
              deactivatedCount: result.count
            }
          }
        })

        return {
          success: true,
          deactivatedCount: result.count
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deactivate expired coupons'
        })
      }
    })
})