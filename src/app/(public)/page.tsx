import Link from 'next/link'
import { auth } from '@/server/auth/auth'
import { prisma } from '@/server/db/client'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()
  
  // If user is signed in, check if they exist in our database
  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (user) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold mb-8">Sportology</h1>
        <p className="text-gray-600 mb-8">
          Your premier course selling platform
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/sign-up"
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          
          <Link 
            href="/sign-in"
            className="block w-full border border-gray-300 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
