import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../init'
import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'

const phoneRegex = /^\+[1-9]\d{1,14}$/

const signUpSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).max(50),
  phone: z.string().regex(phoneRegex, 'Invalid phone number format (+1234567890)'),
  secondPhone: z.string().regex(phoneRegex).optional().or(z.literal('')),
  role: z.enum(['STUDENT', 'PROFESSOR']).default('STUDENT'),
})

export const authRouter = createTRPCRouter({
  // Register new user
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if username exists
      const existingUsername = await ctx.prisma.user.findUnique({
        where: { username: input.username }
      })
      if (existingUsername) {
        throw new TRPCError({ 
          code: 'CONFLICT', 
          message: 'Username already taken' 
        })
      }

      // Check if email exists
      const existingEmail = await ctx.prisma.user.findUnique({
        where: { email: input.email }
      })
      if (existingEmail) {
        throw new TRPCError({ 
          code: 'CONFLICT', 
          message: 'Email already registered' 
        })
      }

      // Check if phone exists
      const existingPhone = await ctx.prisma.user.findUnique({
        where: { phone: input.phone }
      })
      if (existingPhone) {
        throw new TRPCError({ 
          code: 'CONFLICT', 
          message: 'Phone number already registered' 
        })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 12)

      // Create user
      const user = await ctx.prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: hashedPassword,
          name: input.name,
          phone: input.phone,
          secondPhone: input.secondPhone || null,
          role: input.role,
        }
      })

      const { password, ...userWithoutPassword } = user
      return { user: userWithoutPassword }
    }),

  // Get current user
  getCurrentUser: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.user
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(50).optional(),
      secondPhone: z.string().regex(phoneRegex).optional().or(z.literal('')),
    }))
    .mutation(async ({ ctx, input }) => {
      const updatedUser = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          ...input,
          secondPhone: input.secondPhone || null,
        }
      })
      
      const { password, ...userWithoutPassword } = updatedUser
      return { user: userWithoutPassword }
    }),
})
