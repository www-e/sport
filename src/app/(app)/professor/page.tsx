import { Metadata } from 'next'
import ProfessorLayout from '@/components/professor/professor-layout'
import ProfessorDashboardOverview from '@/components/professor/dashboard-overview'

export const metadata: Metadata = {
  title: 'Professor Dashboard - Sportology',
  description: 'Professor dashboard for course management and student monitoring',
}

export default function ProfessorDashboardPage() {
  return (
    <ProfessorLayout>
      <ProfessorDashboardOverview />
    </ProfessorLayout>
  )
}