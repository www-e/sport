import AdminLayout from '@/components/admin/admin-layout'
import UserManagement from '@/components/admin/user-management'

export default function AdminUsersPage() {
  return (
    <AdminLayout>
      <UserManagement />
    </AdminLayout>
  )
}