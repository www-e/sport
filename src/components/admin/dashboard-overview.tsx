'use client'

import { useState} from 'react'
import { 
  BookOpen, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Award,
  ShoppingCart
} from 'lucide-react'
import { api } from '@/lib/trpc'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  loading?: boolean
}

function StatCard({ title, value, change, changeType = 'neutral', icon: Icon, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            <div className="ml-4 flex-1">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change && (
              <p className={`ml-2 text-sm font-medium ${
                changeType === 'positive' ? 'text-green-600' : 
                changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {change}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TopCourseProps {
  course: {
    id: string
    title: string
    creator?: {
      name: string
    }
    category?: {
      name: string
    }
    _count?: {
      enrollments: number
      lessons: number
    }
  }
}

function TopCourseCard({ course }: TopCourseProps) {
  return (
    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
        <BookOpen className="w-6 h-6 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
        <p className="text-xs text-gray-500">
          by {course.creator?.name} • {course.category?.name}
        </p>
        <div className="flex items-center space-x-4 mt-1">
          <span className="text-xs text-gray-500">
            {course._count?.enrollments || 0} students
          </span>
          <span className="text-xs text-gray-500">
            {course._count?.lessons || 0} lessons
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        <TrendingUp className="w-4 h-4 text-green-500" />
      </div>
    </div>
  )
}

export default function DashboardOverview() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  
  // Fetch dashboard stats
  const { data: stats, isLoading } = api.admin.getDashboardStats.useQuery()
  
  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = api.admin.getRecentActivity.useQuery({
    limit: 5
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M'
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K'
    }
    return value.toString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your platform.
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Courses"
          value={stats?.courses.total || 0}
          change={`${stats?.courses.published || 0} published`}
          changeType="positive"
          icon={BookOpen}
          loading={isLoading}
        />
        <StatCard
          title="Total Students"
          value={formatNumber(stats?.users.totalStudents || 0)}
          change={`+${stats?.enrollments.recent || 0} this month`}
          changeType="positive"
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(Number(stats?.revenue.total || 0))}
          change="+12.5%"
          changeType="positive"
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard
          title="Total Enrollments"
          value={formatNumber(stats?.enrollments.total || 0)}
          change={`+${stats?.enrollments.recent || 0} recent`}
          changeType="positive"
          icon={Award}
          loading={isLoading}
        />
      </div>

      {/* Charts and Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Courses */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Top Performing Courses</h3>
            <p className="text-sm text-gray-500 mt-1">Most popular courses by enrollment</p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.courses.topCourses && stats.courses.topCourses.length > 0 ? (
              <div className="space-y-4">
                {stats.courses.topCourses.map((course: any) => (
                  <TopCourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No courses available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-500 mt-1">Common administrative tasks</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <a
                href="/admin/courses/new"
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Create Course</p>
                </div>
              </a>
              
              <a
                href="/admin/categories"
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <Award className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Manage Categories</p>
                </div>
              </a>
              
              <a
                href="/admin/coupons"
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Create Coupon</p>
                </div>
              </a>
              
              <a
                href="/admin/users"
                className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Manage Users</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Category Distribution</h3>
          <p className="text-sm text-gray-500 mt-1">Courses by category</p>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : stats?.categories && stats.categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.categories.map((category: any) => (
                <div key={category.id} className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl font-bold text-blue-600">
                      {category._count.courses}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{category.name}</p>
                  <p className="text-xs text-gray-500">courses</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No categories available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          <p className="text-sm text-gray-500 mt-1">Latest platform activities</p>
        </div>
        <div className="p-6">
          {activityLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4">
                  <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity: any) => {
                const getActivityColor = (type: string) => {
                  switch (type) {
                    case 'create': return 'bg-green-500'
                    case 'update': return 'bg-blue-500'
                    case 'delete': return 'bg-red-500'
                    case 'user': return 'bg-purple-500'
                    default: return 'bg-yellow-500'
                  }
                }
                
                const formatTimeAgo = (date: Date) => {
                  const now = new Date()
                  const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60))
                  
                  if (diffInMinutes < 1) return 'Just now'
                  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
                  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
                  return `${Math.floor(diffInMinutes / 1440)}d ago`
                }
                
                return (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500">No recent activity</p>
              <p className="text-sm text-gray-400">Activity will appear here as users interact with the platform</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}