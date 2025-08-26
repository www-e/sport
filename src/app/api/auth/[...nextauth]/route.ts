import { handlers } from '@/server/auth/auth'

// Force Node.js runtime to avoid bcryptjs Edge Runtime issues
export const runtime = 'nodejs'

export const { GET, POST } = handlers
