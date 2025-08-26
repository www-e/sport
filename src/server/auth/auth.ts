import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { z } from 'zod'
import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { UserRole } from "@prisma/client"

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
})

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials)

        if (parsedCredentials.success) {
          const { username, password } = parsedCredentials.data
          
          const user = await prisma.user.findUnique({
            where: { username }
          })
          
          if (!user) return null
          
          const passwordsMatch = await bcrypt.compare(password, user.password)
          
          if (passwordsMatch) {
            return {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name,
              role: user.role,
            }
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Type assertions to handle unknown types
        token.role = user.role as UserRole
        token.username = user.username as string
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!
        // Type assertions for unknown token properties
        session.user.role = token.role as UserRole
        session.user.username = token.username as string
      }
      return session
    },
  },
})
