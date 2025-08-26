import { auth } from '@/server/auth/auth'
 
export default auth((req) => {
  // req.auth contains the session
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isPublicRoute = ['/', '/sign-in', '/sign-up'].includes(nextUrl.pathname)
  const isAuthRoute = ['/sign-in', '/sign-up'].includes(nextUrl.pathname)

  if (isApiAuthRoute) {
    return // Allow all API auth routes
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL('/dashboard', nextUrl))
    }
    return // Allow access to auth routes
  }

  if (!isLoggedIn && !isPublicRoute) {
    return Response.redirect(new URL('/sign-in', nextUrl))
  }

  return // Allow the request to continue
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
