import type { NextAuthConfig } from 'next-auth'
 
export const authConfig = {
  pages: {
    signIn: '/sign-in',
    // Remove signUp - NextAuth doesn't have this option
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')
      
      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) return true
        return false
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }
      
      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
