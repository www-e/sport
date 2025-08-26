import { auth } from '@/server/auth/auth'
import { prisma } from '@/server/db/client'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/sign-in')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Welcome, {user.name}!
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
          <div className="space-y-2">
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Role:</strong> {user.role}</p>
            <p><strong>Phone:</strong> {user.phone}</p>
            {user.secondPhone && <p><strong>Second Phone:</strong> {user.secondPhone}</p>}
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Joined:</strong> {user.createdAt.toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
