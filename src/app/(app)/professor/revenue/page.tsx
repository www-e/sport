'use client'

import { useState } from 'react'
import ProfessorLayout from '@/components/professor/professor-layout'
import { api } from '@/lib/trpc'
import { 
  DollarSign, 
  TrendingUp, 
  Download,
  CreditCard,
  BookOpen,
  Users,
  Eye,
} from 'lucide-react'

interface RevenueCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  description?: string
}

function RevenueCard({ title, value, change, changeType, icon: Icon, description }: RevenueCardProps) {
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

interface PayoutRowProps {
  payout: {
    id: string
    amount: number
    date: Date
    status: 'pending' | 'processing' | 'completed' | 'failed'
    method: string
    courses: number
  }
}

function PayoutRow({ payout }: PayoutRowProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {formatCurrency(payout.amount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {new Date(payout.date).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payout.status)}`}>
          {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {payout.method}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {payout.courses} course{payout.courses !== 1 ? 's' : ''}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button className="text-green-600 hover:text-green-900">
          <Eye className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}

interface CourseRevenueRowProps {
  course: {
    id: string
    title: string
    price: number
    sales: number
    revenue: number
    commission: number
    netRevenue: number
  }
}

function CourseRevenueRow({ course }: CourseRevenueRowProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <BookOpen className="w-5 h-5 text-gray-400 mr-3" />
          <div>
            <div className="text-sm font-medium text-gray-900">{course.title}</div>
            <div className="text-sm text-gray-500">{formatCurrency(course.price)} per sale</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {course.sales}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatCurrency(course.revenue)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        -{formatCurrency(course.commission)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {formatCurrency(course.netRevenue)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button className="text-green-600 hover:text-green-900">
          <Eye className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}

export default function ProfessorRevenuePage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'completed'>('all')

  // Fetch revenue data - using existing methods
  const { data: revenueData, isLoading } = api.professor.getRevenueAnalytics.useQuery({
    timeRange
  })
  
  // Fetch course statistics
  const { data: courseStats } = api.professor.getCourseStats.useQuery()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  // Calculate derived data from real API responses
  const totalRevenue = revenueData?.totalRevenue || 0
  const totalSales = revenueData?.orderCount || 0
  const avgOrderValue = revenueData?.avgOrderValue || 0
  
  // Calculate platform fee (assuming 10% commission)
  const platformFeeRate = 0.10
  const totalCommission = totalRevenue * platformFeeRate
  const totalNetRevenue = totalRevenue - totalCommission
  
  // Mock pending payout (would normally come from a payments/payout system)
  const pendingPayout = totalNetRevenue * 0.15 // Assume 15% is pending
  
  // Transform course revenue data
  const courseRevenueData = revenueData?.topCourses?.map(item => ({
    id: item.course?.id || '',
    title: item.course?.title || 'Unknown Course',
    price: Number(item.course?.price || 0),
    sales: item.orders,
    revenue: item.revenue,
    commission: item.revenue * platformFeeRate,
    netRevenue: item.revenue * (1 - platformFeeRate)
  })) || []
  
  // Mock payout history (would normally come from payment provider)
  const mockPayouts = [
    {
      id: '1',
      amount: totalNetRevenue * 0.6,
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      status: 'completed' as const,
      method: 'PayPal',
      courses: courseStats?.publishedCourses || 0
    },
    {
      id: '2',
      amount: totalNetRevenue * 0.25,
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      status: 'completed' as const,
      method: 'Bank Transfer',
      courses: Math.max(1, (courseStats?.publishedCourses || 1) - 1)
    },
    ...(pendingPayout > 0 ? [{
      id: '3',
      amount: pendingPayout,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
      method: 'PayPal',
      courses: courseStats?.publishedCourses || 0
    }] : [])
  ]
  
  const filteredPayouts = mockPayouts.filter(payout => {
    if (payoutFilter === 'all') return true
    return payout.status === payoutFilter
  })

  return (
    <ProfessorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
            <p className="text-gray-500 mt-1">
              Track your earnings and manage payouts across all your courses.
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
              Export Report
            </button>
          </div>
        </div>

        {/* Revenue Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
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
            ))
          ) : (
            <>
              <RevenueCard
                title="Total Revenue"
                value={formatCurrency(totalRevenue)}
                change={revenueData?.revenueByTime && revenueData.revenueByTime.length > 1 ? 
                  `+${((totalRevenue / Math.max(1, totalRevenue - (revenueData.revenueByTime[revenueData.revenueByTime.length-1]?.revenue || 0))) * 100 - 100).toFixed(1)}%` : undefined}
                changeType="positive"
                icon={DollarSign}
              />
              <RevenueCard
                title="Net Earnings"
                value={formatCurrency(totalNetRevenue)}
                description="After platform fees (10%)"
                icon={TrendingUp}
              />
              <RevenueCard
                title="Total Sales"
                value={totalSales.toString()}
                description={`Avg: ${formatCurrency(avgOrderValue)}`}
                icon={Users}
              />
              <RevenueCard
                title="Pending Payout"
                value={formatCurrency(pendingPayout)}
                description={pendingPayout > 0 ? "Next payout in 5 days" : "No pending payouts"}
                icon={CreditCard}
              />
            </>
          )}
        </div>

        {/* Revenue Chart Placeholder */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Revenue Trends</h3>
            <p className="text-sm text-gray-500 mt-1">Monthly revenue over time</p>
          </div>
          <div className="p-6">
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Revenue chart will be displayed here</p>
                <p className="text-sm text-gray-400">Integration with charting library needed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Course Revenue Breakdown */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Revenue by Course</h3>
              <p className="text-sm text-gray-500 mt-1">Performance breakdown for each course</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                      </tr>
                    ))
                  ) : courseRevenueData.length > 0 ? (
                    courseRevenueData.map((course) => (
                      <CourseRevenueRow key={course.id} course={course} />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No course revenue yet</h3>
                        <p className="text-gray-500">Revenue data will appear here once students start purchasing your courses.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payout History */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Payout History</h3>
                  <p className="text-sm text-gray-500 mt-1">Recent payment transactions</p>
                </div>
                
                <select
                  value={payoutFilter}
                  onChange={(e) => setPayoutFilter(e.target.value as 'all' | 'pending' | 'completed')}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Payouts</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Courses
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayouts.map((payout) => (
                    <PayoutRow key={payout.id} payout={payout} />
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredPayouts.length === 0 && (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No payouts found</h3>
                <p className="text-gray-500">
                  {payoutFilter !== 'all' 
                    ? `No ${payoutFilter} payouts to display.`
                    : 'Payouts will appear here once you start earning revenue.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payout Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Payout Settings</h3>
            <p className="text-sm text-gray-500 mt-1">Manage your payment preferences</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="paypal"
                      name="payment-method"
                      defaultChecked
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <label htmlFor="paypal" className="ml-3 text-sm text-gray-700">
                      PayPal (recommended)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="bank"
                      name="payment-method"
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <label htmlFor="bank" className="ml-3 text-sm text-gray-700">
                      Bank Transfer
                    </label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Payout Amount
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="50">$50</option>
                  <option value="100">$100</option>
                  <option value="200">$200</option>
                  <option value="500">$500</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Payouts are processed monthly when this threshold is met
                </p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Update Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProfessorLayout>
  )
}