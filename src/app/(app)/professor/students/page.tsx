'use client'

import { useState } from 'react'
import ProfessorLayout from '@/components/professor/professor-layout'
import { api } from '@/lib/trpc'
import { 
  Users, 
  Search,
  BookOpen,
  Clock,
  Award,
  TrendingUp,
  Download,
  Eye,
  Mail
} from 'lucide-react'

interface StudentProgressCardProps {
  student: {
    id: string
    name: string
    email: string
    enrolledAt: Date
    progress: {
      courseId: string
      courseTitle: string
      completedLessons: number
      totalLessons: number
      lastAccessedAt: Date | null
      completionPercentage: number
    }[]
  }
}

function StudentProgressCard({ student }: StudentProgressCardProps) {
  const overallProgress = student.progress.length > 0
    ? student.progress.reduce((sum, p) => sum + p.completionPercentage, 0) / student.progress.length
    : 0

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never'
    const now = new Date()
    const diffTime = now.getTime() - new Date(date).getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return new Date(date).toLocaleDateString()
  }

  const getLastAccessed = () => {
    const lastAccessed = student.progress
      .map(p => p.lastAccessedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
    
    return formatDate(lastAccessed)
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
            <p className="text-sm text-gray-500">{student.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              Enrolled {new Date(student.enrolledAt).toLocaleDateString()}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="text-gray-400 hover:text-green-600 p-1">
              <Mail className="w-4 h-4" />
            </button>
            <button className="text-gray-400 hover:text-green-600 p-1">
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-500">{Math.round(overallProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Course Progress */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 flex items-center">
            <BookOpen className="w-4 h-4 mr-2" />
            Enrolled Courses ({student.progress.length})
          </h4>
          
          {student.progress.length > 0 ? (
            <div className="space-y-2">
              {student.progress.slice(0, 3).map((progress, index) => (
                <div key={progress.courseId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {progress.courseTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      {progress.completedLessons}/{progress.totalLessons} lessons
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-600 h-1.5 rounded-full" 
                        style={{ width: `${progress.completionPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {Math.round(progress.completionPercentage)}%
                    </span>
                  </div>
                </div>
              ))}
              
              {student.progress.length > 3 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  +{student.progress.length - 3} more courses
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No course progress data
            </p>
          )}
        </div>

        {/* Last Activity */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              Last active
            </span>
            <span className="text-gray-900">{getLastAccessed()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfessorStudentsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [progressFilter, setProgressFilter] = useState<'all' | 'active' | 'completed' | 'inactive'>('all')

  // Fetch professor courses for filter
  const { data: coursesData } = api.professor.getMyCourses.useQuery({
    page: 1,
    limit: 100
  })

  // Since getStudentProgress doesn't exist, let's use a placeholder approach
  // We'll need to get this data from multiple courses or create a new endpoint
  const { data: studentsData, isLoading } = api.professor.getDashboardOverview.useQuery()
  
  // Mock students data for now - in real implementation, you'd create a proper endpoint
  const students = [] as any[] // Empty for now until proper endpoint is created
  const courses = coursesData?.courses || []

  // Filter students based on progress
  const filteredStudents = students.filter((student: { progress: Array<{ lastAccessedAt: Date | null; completionPercentage: number }> }) => {
    if (progressFilter === 'all') return true
    
    const hasActiveProgress = student.progress.some((p: { lastAccessedAt: Date | null }) => p.lastAccessedAt && 
      new Date(p.lastAccessedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    )
    const hasCompletedCourse = student.progress.some((p: { completionPercentage: number }) => p.completionPercentage >= 100)
    const isInactive = !hasActiveProgress

    switch (progressFilter) {
      case 'active':
        return hasActiveProgress
      case 'completed':
        return hasCompletedCourse
      case 'inactive':
        return isInactive
      default:
        return true
    }
  })

  const totalStudents = students.length
  const activeStudents = students.filter((s: { progress: Array<{ lastAccessedAt: Date | null }> }) => 
    s.progress.some((p: { lastAccessedAt: Date | null }) => p.lastAccessedAt && 
      new Date(p.lastAccessedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    )
  ).length
  const completedStudents = students.filter((s: { progress: Array<{ completionPercentage: number }> }) => 
    s.progress.some((p: { completionPercentage: number }) => p.completionPercentage >= 100)
  ).length

  return (
    <ProfessorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Students</h1>
            <p className="text-gray-500 mt-1">
              Monitor student progress and engagement across your courses.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Students</p>
                <p className="text-2xl font-bold text-gray-900">{activeStudents}</p>
                <p className="text-xs text-gray-500">Last 7 days</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Award className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed Courses</p>
                <p className="text-2xl font-bold text-gray-900">{completedStudents}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Course Filter */}
            <div>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Courses</option>
                {courses.map((course: { id: string; title: string }) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Progress Filter */}
            <div>
              <select
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value as 'all' | 'active' | 'completed' | 'inactive')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Students</option>
                <option value="active">Active (7 days)</option>
                <option value="completed">Completed</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow animate-pulse">
                <div className="p-6 space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student: {
              id: string;
              name: string;
              email: string;
              enrolledAt: Date;
              progress: {
                courseId: string;
                courseTitle: string;
                completedLessons: number;
                totalLessons: number;
                lastAccessedAt: Date | null;
                completionPercentage: number;
              }[];
            }) => (
              <StudentProgressCard key={student.id} student={student} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-500">
              {searchTerm || courseFilter !== 'all' || progressFilter !== 'all'
                ? 'No students match your current filters.'
                : 'No students have enrolled in your courses yet.'}
            </p>
          </div>
        )}
      </div>
    </ProfessorLayout>
  )
}