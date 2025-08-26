import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/trpc/routers/_app'
import { createTRPCContext } from '@/server/trpc/context'

// Force Node.js runtime for database and auth operations
export const runtime = 'nodejs'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  })

export { handler as GET, handler as POST }