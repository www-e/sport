import { TRPCError } from '@trpc/server'
import { createTRPCMiddleware } from '../init'

// Admin middleware to ensure only admin users can access admin routes
export const adminMiddleware = createTRPCMiddleware(async ({ ctx, next }) => {
  // Check if user is authenticated
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }

  // Check if user has admin role
  // Note: We'll need to add admin role to the User model or create separate admin check
  // For now, we'll check if the user exists in the AdminUser table
  try {
    const adminUser = await ctx.prisma.adminUser.findUnique({
      where: { 
        email: ctx.user.email 
      }
    })

    if (!adminUser) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      })
    }

    // Add admin user info to context
    return next({
      ctx: {
        ...ctx,
        admin: adminUser,
      },
    })
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify admin status',
    })
  }
})

// Super admin middleware for critical operations
export const superAdminMiddleware = createTRPCMiddleware(async ({ ctx, next }) => {
  // First check if user is authenticated
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }

  try {
    const adminUser = await ctx.prisma.adminUser.findUnique({
      where: { 
        email: ctx.user.email 
      }
    })

    if (!adminUser || adminUser.role !== 'SUPER_ADMIN') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      })
    }

    return next({
      ctx: {
        ...ctx,
        admin: adminUser,
      },
    })
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify super admin status',
    })
  }
})

// Professor middleware to check if user is a professor
export const professorMiddleware = createTRPCMiddleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }

  if (ctx.user.role !== 'PROFESSOR') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You must be a professor to access this resource',
    })
  }

  return next({
    ctx,
  })
})

// Course ownership middleware - professor can only access their own courses
export const courseOwnershipMiddleware = createTRPCMiddleware(async ({ ctx, next, input }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }

  // Extract courseId from input
  const courseId = (input as any)?.courseId || (input as any)?.id
  
  if (!courseId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Course ID is required',
    })
  }

  try {
    const course = await ctx.prisma.course.findUnique({
      where: { id: courseId },
      select: { creatorId: true }
    })

    if (!course) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Course not found',
      })
    }

    if (course.creatorId !== ctx.user.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only access courses you created',
      })
    }

    return next({
      ctx,
    })
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify course ownership',
    })
  }
})