'use client'

import { useState } from 'react'
import { 
  Search, 
  Eye, 
  Edit, 
  CheckCircle, 
  XCircle,
  Users,
  BookOpen,
  ShoppingCart,
  Award,
  User
} from 'lucide-react'
import { api } from '@/lib/trpc'

interface User {
  id: string
  username: string
  email: string
  name: string
  role: 'STUDENT' | 'PROFESSOR'
  verified: boolean
  avatar: string | null
  createdAt: Date
  _count: {
    createdCourses: number
    enrollments: number
    orders: number
  }
}

interface UserTableProps {
  users: User[]
  loading: boolean
  onView: (userId: string) => void
  onToggleVerification: (userId: string, currentStatus: boolean) => void
}

function UserTable({ users, loading, onView, onToggleVerification }: UserTableProps) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="w-20 h-4 bg-gray-200 rounded"></div>
                <div className="w-24 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-500">No users match your current filters.</p>
        </div>
      </div>
    )
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'PROFESSOR': return 'bg-purple-100 text-purple-800'
      case 'STUDENT': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                    {user.role.toLowerCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.verified ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-700">Verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-500 mr-1" />
                        <span className="text-sm text-red-700">Unverified</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {user.role === 'PROFESSOR' ? (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <BookOpen className="w-4 h-4 text-gray-400 mr-1" />
                          <span>{user._count.createdCourses} courses</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-gray-400 mr-1" />
                          <span>{user._count.enrollments} students</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Award className="w-4 h-4 text-gray-400 mr-1" />
                          <span>{user._count.enrollments} enrollments</span>
                        </div>
                        <div className="flex items-center">
                          <ShoppingCart className="w-4 h-4 text-gray-400 mr-1" />
                          <span>{user._count.orders} orders</span>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onView(user.id)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                      title="View user"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onToggleVerification(user.id, user.verified)}
                      className={`p-1 rounded ${
                        user.verified 
                          ? 'text-red-600 hover:text-red-900 hover:bg-red-50' 
                          : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                      }`}
                      title={user.verified ? 'Unverify user' : 'Verify user'}
                    >
                      {user.verified ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'STUDENT' | 'PROFESSOR' | undefined>(undefined)
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)

  // Fetch users
  const { data: usersData, isLoading: usersLoading, refetch } = api.admin.getUsers.useQuery({
    page,
    limit,
    search: searchTerm || undefined,
    role: roleFilter,
    verified: verifiedFilter,
  })

  // Update user status mutation
  const updateUserStatus = api.admin.updateUserStatus.useMutation({
    onSuccess: () => {
      refetch()
    },
    onError: (error: any) => {
      console.error('Failed to update user status:', error)
      alert('Failed to update user status')
    }
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    refetch()
  }

  const handleView = (userId: string) => {
    // Navigate to user details page
    console.log('View user:', userId)
    // TODO: Implement view functionality
  }

  const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      await updateUserStatus.mutateAsync({
        userId,
        verified: !currentStatus
      })
    } catch (error) {
      console.error('Failed to toggle user verification:', error)
    }
  }

  const users = usersData?.users || []
  const pagination = usersData?.pagination

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">
            Manage user accounts, verify users, and monitor platform activity.
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-white rounded-lg shadow px-4 py-2">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-100 rounded-full mr-2"></div>
                <span className="text-gray-600">Students: {users.filter((u: User) => u.role === 'STUDENT').length}</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-100 rounded-full mr-2"></div>
                <span className="text-gray-600">Professors: {users.filter((u: User) => u.role === 'PROFESSOR').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={roleFilter || ''}
                onChange={(e) => setRoleFilter(e.target.value as 'STUDENT' | 'PROFESSOR' || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="STUDENT">Students</option>
                <option value="PROFESSOR">Professors</option>
              </select>
            </div>

            {/* Verification Filter */}
            <div>
              <select
                value={verifiedFilter === undefined ? '' : verifiedFilter.toString()}
                onChange={(e) => setVerifiedFilter(
                  e.target.value === '' ? undefined : e.target.value === 'true'
                )}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
              disabled={usersLoading}
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setRoleFilter(undefined)
                setVerifiedFilter(undefined)
                setPage(1)
                refetch()
              }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </form>
      </div>

      {/* User Table */}
      <UserTable
        users={users}
        loading={usersLoading}
        onView={handleView}
        onToggleVerification={handleToggleVerification}
      />

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(pagination.pages, page + 1))}
              disabled={page === pagination.pages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(page * limit, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                  const pageNum = i + 1
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === pageNum
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}