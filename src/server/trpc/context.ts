import { auth } from '@/server/auth/auth'
import { prisma } from '../db/client'
import type { User } from '@prisma/client'

export async function createTRPCContext() {
  const session = await auth()
  
  let user: User | null = null
  
  if (session?.user?.id) {
    user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
  }

  return {
    prisma,
    session,
    user,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>
