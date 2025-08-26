'use client'

import { useState } from 'react'
import ProfessorLayout from '@/components/professor/professor-layout'
import { api } from '@/lib/trpc'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen,
  Award,
  Eye,
  PlayCircle,
  Download,
} from 'lucide-react'

interface AnalyticsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  description?: string
}

function AnalyticsCard({ title, value, change, changeType, icon: Icon, description }: AnalyticsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="w-8 h-8 text-green-600" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-lg font-medium text-gray-900">{value}</dd>
            {description && (
              <dd className="text-xs text-gray-500">{description}</dd>
            )}
          </dl>
        </div>
      </div>
      {change && (
        <div className="mt-4">
          <div className="flex items-center">
            <span className={`text-sm font-medium ${
              changeType === 'positive' ? 'text-green-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {change}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs last period</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface CourseAnalyticsProps {
  course: {
    id: string
    title: string
    enrollments: number
    completionRate: number
    avgWatchTime: number
    revenue: number
    totalLessons: number
    avgRating: number
  }
}

function CourseAnalyticsRow({ course }: CourseAnalyticsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <BookOpen className="w-5 h-5 text-gray-400 mr-3" />
          <div>
            <div className="text-sm font-medium text-gray-900">{course.title}</div>
            <div className="text-sm text-gray-500">{course.totalLessons} lessons</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {course.enrollments}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
            <div 
              className="bg-green-600 h-2 rounded-full" 
              style={{ width: `${course.completionRate}%` }}
            ></div>
          </div>
          <span className="text-sm text-gray-900">{course.completionRate}%</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatTime(course.avgWatchTime)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex items-center">
          <Award className="w-4 h-4 text-yellow-500 mr-1" />
          {course.avgRating.toFixed(1)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
        {formatCurrency(course.revenue)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button className="text-green-600 hover:text-green-900">
          <Eye className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}

export default function ProfessorAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [courseFilter, setCourseFilter] = useState<string>('all')

  // Fetch analytics data - using existing methods
  const { data: analytics, isLoading: analyticsLoading } = api.professor.getCourseStats.useQuery()

  // Fetch courses for filter
  const { data: coursesData } = api.professor.getMyCourses.useQuery({
    page: 1,
    limit: 100
  })

  const courses = coursesData?.courses || []

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  // Mock course analytics data
  const courseAnalytics = courses.map((course: { id: string; title: string; _count?: { lessons: number } }) => ({
    id: course.id,
    title: course.title,
    enrollments: Math.floor(Math.random() * 200) + 10,
    completionRate: Math.floor(Math.random() * 60) + 40,
    avgWatchTime: Math.floor(Math.random() * 300) + 30,
    revenue: Math.floor(Math.random() * 5000) + 500,
    totalLessons: course._count?.lessons || 0,
    avgRating: 4.0 + Math.random() * 1
  }))

  return (
    <ProfessorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-500 mt-1">
              Detailed insights into your course performance and student engagement.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            
            <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnalyticsCard
            title="Total Students"
            value={formatNumber(analytics?.totalEnrollments || 0)}
            change="+12.5%"
            changeType="positive"
            icon={Users}
          />
          <AnalyticsCard
            title="Course Views"
            value={formatNumber(8967)} // Mock data
            change="+8.2%"
            changeType="positive"
            icon={Eye}
          />
          <AnalyticsCard
            title="Avg. Completion"
            value="73%" // Mock data
            change="+4.1%"
            changeType="positive"
            icon={TrendingUp}
          />
          <AnalyticsCard
            title="Total Revenue"
            value={formatCurrency(Number(analytics?.totalRevenue || 0))}
            change="+18.7%"
            changeType="positive"
            icon={BarChart3}
          />
        </div>

        {/* Engagement Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student Engagement */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Student Engagement</h3>
              <p className="text-sm text-gray-500 mt-1">Activity patterns over time</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Average Watch Time</span>
                  <span className="text-sm text-gray-900">24.5 minutes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Session Duration</span>
                  <span className="text-sm text-gray-900">18.2 minutes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Return Rate</span>
                  <span className="text-sm text-gray-900">67%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Drop-off Rate</span>
                  <span className="text-sm text-gray-900">23%</span>
                </div>
              </div>
              
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Weekly Activity</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{day}</div>
                      <div 
                        className="bg-green-600 rounded"
                        style={{ 
                          height: `${20 + Math.random() * 40}px`,
                          opacity: 0.6 + Math.random() * 0.4
                        }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Content */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Top Performing Content</h3>
              <p className="text-sm text-gray-500 mt-1">Most engaging lessons and videos</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <PlayCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        Lesson {index + 1}: Advanced Techniques
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500">85% completion</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500">12 min avg</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-xs text-green-600 font-medium">
                        {Math.floor(Math.random() * 500) + 100} views
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Course Performance Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Course Performance</h3>
                <p className="text-sm text-gray-500 mt-1">Detailed metrics for each course</p>
              </div>
              
              <div className="flex items-center space-x-3">
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Courses</option>
                  {courses.map((course: { id: string; title: string }) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg. Watch Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courseAnalytics.map((course: {
                  id: string;
                  title: string;
                  enrollments: number;
                  completionRate: number;
                  avgWatchTime: number;
                  revenue: number;
                  totalLessons: number;
                  avgRating: number;
                }) => (
                  <CourseAnalyticsRow key={course.id} course={course} />
                ))}
              </tbody>
            </table>
          </div>
          
          {courseAnalytics.length === 0 && (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data</h3>
              <p className="text-gray-500">
                Analytics will appear here once students start engaging with your courses.
              </p>
            </div>
          )}
        </div>
      </div>
    </ProfessorLayout>
  )
}