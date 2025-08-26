import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../../init'
import { adminMiddleware, superAdminMiddleware } from '../../middleware/admin'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
})

const updateCategorySchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
})

// Admin procedure with middleware
const adminProcedure = publicProcedure.use(adminMiddleware)
const superAdminProcedure = publicProcedure.use(superAdminMiddleware)

export const adminCategoriesRouter = createTRPCRouter({
  // Create Category
  createCategory: adminProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if name already exists
        const existingName = await ctx.prisma.category.findUnique({
          where: { name: input.name }
        })
        
        if (existingName) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A category with this name already exists'
          })
        }

        // Check if slug already exists
        const existingSlug = await ctx.prisma.category.findUnique({
          where: { slug: input.slug }
        })
        
        if (existingSlug) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A category with this slug already exists'
          })
        }

        const category = await ctx.prisma.category.create({
          data: input,
          include: {
            _count: {
              select: {
                courses: true
              }
            }
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'CREATE_CATEGORY',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: category.id,
            resourceType: 'CATEGORY',
            metadata: {
              categoryName: category.name,
              slug: category.slug
            }
          }
        })

        return category
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create category'
        })
      }
    }),

  // Update Category
  updateCategory: adminProcedure
    .input(updateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, name, slug, ...updateData } = input

        // Check if category exists
        const existingCategory = await ctx.prisma.category.findUnique({
          where: { id }
        })

        if (!existingCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Check name uniqueness if provided
        if (name && name !== existingCategory.name) {
          const nameExists = await ctx.prisma.category.findUnique({
            where: { name }
          })
          
          if (nameExists) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'A category with this name already exists'
            })
          }
        }

        // Check slug uniqueness if provided
        if (slug && slug !== existingCategory.slug) {
          const slugExists = await ctx.prisma.category.findUnique({
            where: { slug }
          })
          
          if (slugExists) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'A category with this slug already exists'
            })
          }
        }

        const category = await ctx.prisma.category.update({
          where: { id },
          data: { 
            ...updateData, 
            ...(name && { name }), 
            ...(slug && { slug }) 
          },
          include: {
            _count: {
              select: {
                courses: true
              }
            }
          }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'UPDATE_CATEGORY',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: category.id,
            resourceType: 'CATEGORY',
            metadata: {
              categoryName: category.name,
              changes: { ...updateData, ...(name && { name }), ...(slug && { slug }) }
            }
          }
        })

        return category
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update category'
        })
      }
    }),

  // Delete Category
  deleteCategory: superAdminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const category = await ctx.prisma.category.findUnique({
          where: { id: input.id },
          include: {
            courses: true
          }
        })

        if (!category) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Check if category has courses
        if (category.courses.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cannot delete category with existing courses. Move courses to another category first.'
          })
        }

        await ctx.prisma.category.delete({
          where: { id: input.id }
        })

        // Log admin action
        await ctx.prisma.auditLog.create({
          data: {
            action: 'DELETE_CATEGORY',
            actorId: ctx.admin.id,
            actorType: 'ADMIN',
            resourceId: input.id,
            resourceType: 'CATEGORY',
            metadata: {
              categoryName: category.name
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
          message: 'Failed to delete category'
        })
      }
    }),

  // Get All Categories
  getCategories: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search } = input
      const skip = (page - 1) * limit

      const where = {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } }
          ]
        })
      }

      const [categories, total] = await Promise.all([
        ctx.prisma.category.findMany({
          where,
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                courses: true
              }
            }
          },
          orderBy: { name: 'asc' }
        }),
        ctx.prisma.category.count({ where })
      ])

      return {
        categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    }),

  // Get Category by ID
  getCategory: adminProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findUnique({
        where: { id: input.id },
        include: {
          courses: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              _count: {
                select: {
                  lessons: true,
                  enrollments: true
                }
              }
            },
            orderBy: { title: 'asc' }
          },
          _count: {
            select: {
              courses: true
            }
          }
        }
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found'
        })
      }

      return category
    }),

  // Get Categories for Selection (without pagination)
  getCategoriesForSelection: adminProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          icon: true,
          _count: {
            select: {
              courses: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      return categories
    }),

  // Get Category Statistics
  getCategoryStats: adminProcedure
    .query(async ({ ctx }) => {
      const [totalCategories, categoriesWithCourses, totalCourses] = await Promise.all([
        ctx.prisma.category.count(),
        ctx.prisma.category.count({
          where: {
            courses: {
              some: {}
            }
          }
        }),
        ctx.prisma.course.count()
      ])

      const categoriesWithStats = await ctx.prisma.category.findMany({
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
        take: 5
      })

      return {
        totalCategories,
        categoriesWithCourses,
        categoriesWithoutCourses: totalCategories - categoriesWithCourses,
        totalCourses,
        topCategories: categoriesWithStats,
        averageCoursesPerCategory: totalCategories > 0 ? totalCourses / totalCategories : 0
      }
    }),
})