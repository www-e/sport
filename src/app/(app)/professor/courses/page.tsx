'use client'

import { Decimal } from '@prisma/client/runtime/library'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProfessorLayout from '@/components/professor/professor-layout'
import { api } from '@/lib/trpc'
import { 
  BookOpen, 
  Users, 
  PlayCircle, 
  Eye, 
  Search,
  MoreVertical,
  BarChart3
} from 'lucide-react'

interface CourseCardProps {
  course: {
    id: string
    title: string
    description: string | null
    thumbnail: string | null
    price: Decimal
    published: boolean
    createdAt: Date
    category: { name: string } | null
    _count: {
      lessons: number
      enrollments: number
    }
  }
}

function CourseCard({ course }: CourseCardProps) {
  const router = useRouter()

  const formatCurrency = (value: Decimal) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(value))
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="aspect-w-16 aspect-h-9">
        <img
          src={course.thumbnail || '/placeholder-course.jpg'}
          alt={course.title}
          className="w-full h-48 object-cover rounded-t-lg"
        />
      </div>
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
              {course.title}
            </h3>
            <p className="text-sm text-gray-500">{course.category?.name}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              course.published
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {course.published ? 'Published' : 'Draft'}
            </span>
            
            <div className="relative">
              <button className="text-gray-400 hover:text-gray-600 p-1">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {course.description || 'No description available'}
        </p>
        
        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div className="flex items-center space-x-2">
            <PlayCircle className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{course._count.lessons} lessons</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{course._count.enrollments} students</span>
          </div>
          <div className="text-right">
            <span className="font-semibold text-gray-900">
              {formatCurrency(course.price)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push(`/professor/courses/${course.id}`)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800"
            >
              <Eye className="w-4 h-4 mr-1" />
              View Details
            </button>
            
            <button
              onClick={() => router.push(`/professor/courses/${course.id}/analytics`)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Analytics
            </button>
          </div>
          
          <span className="text-xs text-gray-500">
            Created {new Date(course.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ProfessorCoursesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'students' | 'title'>('newest')

  // Fetch professor courses
  const { data: coursesData, isLoading } = api.professor.getMyCourses.useQuery({
    page: 1,
    limit: 50,
    search: searchTerm || undefined,
    published: statusFilter === 'all' ? undefined : statusFilter === 'published'
  })

  const courses = coursesData?.courses || []

  // Filter and sort courses
  const filteredAndSortedCourses = courses
    .filter((course: { published: boolean }) => {
      if (statusFilter === 'published' && !course.published) return false
      if (statusFilter === 'draft' && course.published) return false
      return true
    })
    .sort((a: { createdAt: Date; _count?: { enrollments: number }; title: string }, b: { createdAt: Date; _count?: { enrollments: number }; title: string }) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'students':
          return (b._count?.enrollments || 0) - (a._count?.enrollments || 0)
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

  return (
    <ProfessorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
            <p className="text-gray-500 mt-1">
              Manage and monitor your course offerings.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0">
            <span className="text-sm text-gray-500">
              {courses.length} course{courses.length !== 1 ? 's' : ''} total
            </span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            
            {/* Sort */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'students' | 'title')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="students">Most Students</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow animate-pulse">
                <div className="w-full h-48 bg-gray-200 rounded-t-lg"></div>
                <div className="p-6 space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCourses.map((course: {
              id: string;
              title: string;
              description: string | null;
              thumbnail: string | null;
              price: Decimal;
              published: boolean;
              createdAt: Date;
              category: { name: string } | null;
              _count: { lessons: number; enrollments: number };
            }) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'No courses match your current filters.'
                : 'You haven\'t created any courses yet.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => window.location.href = '/admin/courses/create'}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Create Your First Course
              </button>
            )}
          </div>
        )}
      </div>
    </ProfessorLayout>
  )
}