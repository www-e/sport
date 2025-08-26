'use client'

import { useState } from 'react'
import { 
  BookOpen, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Eye,
  Award,
  PlayCircle,
  BarChart3,
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
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6 text-green-600" />
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

interface CourseCardProps {
  course: {
    id: string
    title: string
    category?: {
      name: string
    }
    _count?: {
      enrollments: number
      lessons: number
    }
    published: boolean
  }
}

function CourseCard({ course }: CourseCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <BookOpen className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 truncate">{course.title}</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">{course.category?.name}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {course._count?.enrollments || 0} students
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <PlayCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {course._count?.lessons || 0} lessons
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end space-y-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            course.published
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {course.published ? 'Published' : 'Draft'}
          </span>
          <button className="text-green-600 hover:text-green-800 p-1">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfessorDashboardOverview() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  
  // Fetch professor dashboard stats
  const { data: overview, isLoading: overviewLoading } = api.professor.getDashboardOverview.useQuery()
  
  // Fetch professor courses
  const { data: coursesData, isLoading: coursesLoading } = api.professor.getMyCourses.useQuery({
    page: 1,
    limit: 6
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
            Monitor your courses and track student engagement.
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
          title="My Courses"
          value={overview?.courses.total || 0}
          change={`${overview?.courses.published || 0} published`}
          changeType="positive"
          icon={BookOpen}
          loading={overviewLoading}
        />
        <StatCard
          title="Total Students"
          value={formatNumber(overview?.students.total || 0)}
          change={`+${overview?.students.recent || 0} this month`}
          changeType="positive"
          icon={Users}
          loading={overviewLoading}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(Number(overview?.revenue.total || 0))}
          change="+8.2%"
          changeType="positive"
          icon={DollarSign}
          loading={overviewLoading}
        />
        <StatCard
          title="Avg. Rating"
          value="4.8"
          change="+0.3"
          changeType="positive"
          icon={Award}
          loading={overviewLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Courses */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">My Courses</h3>
                <a 
                  href="/professor/courses"
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  View all
                </a>
              </div>
            </div>
            <div className="p-6">
              {coursesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : coursesData?.courses && coursesData.courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {coursesData.courses.slice(0, 4).map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No courses created yet</p>
                  <p className="text-sm text-gray-400 mt-1">Contact admin to create your first course</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">New enrollment in "React Basics"</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Student completed "Advanced JavaScript"</p>
                  <p className="text-xs text-gray-500">5 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Course "Python for Beginners" was published</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Received 5-star review</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Trends */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Enrollment Trends</h3>
            <p className="text-sm text-gray-500 mt-1">Student enrollments over time</p>
          </div>
          <div className="p-6">
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Chart placeholder</p>
                <p className="text-xs text-gray-400">Enrollment data visualization</p>
              </div>
            </div>
          </div>
        </div>

        {/* Student Progress */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Student Progress</h3>
            <p className="text-sm text-gray-500 mt-1">Course completion rates</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {overview?.topCourses?.slice(0, 3).map((course, index) => (
                <div key={course.id} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{course.title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${Math.random() * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.floor(Math.random() * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {course._count?.enrollments || 0}
                    </p>
                    <p className="text-xs text-gray-500">students</p>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8">
                  <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No progress data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          <p className="text-sm text-gray-500 mt-1">Common professor tasks</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/professor/courses"
              className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <div className="text-center">
                <BookOpen className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">View Courses</p>
              </div>
            </a>
            
            <a
              href="/professor/students"
              className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <div className="text-center">
                <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Student Progress</p>
              </div>
            </a>
            
            <a
              href="/professor/analytics"
              className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <div className="text-center">
                <BarChart3 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">View Analytics</p>
              </div>
            </a>
            
            <a
              href="/professor/revenue"
              className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <div className="text-center">
                <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Revenue Report</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}