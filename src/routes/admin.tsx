import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

export const Route = createFileRoute('/admin')({
  component: AdminComponent,
})

function AdminComponent() {
  return (
    <div className="w-full h-full bg-muted/20 dark:bg-background m-0 p-0 overflow-hidden">
      <AdminDashboard />
    </div>
  )
}