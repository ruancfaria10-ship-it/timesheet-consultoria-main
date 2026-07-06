// src/routes/admin.tsx
import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

export const Route = createFileRoute('/admin')({
  component: AdminComponent,
})

function AdminComponent() {
  return (
    // Trocamos o 'fixed inset-0 z-50' por um contêiner flexível que respeita a barra mestre do __root,
    // mas que trava a altura no limite do monitor para o rodapé interno nunca mais cortar!
    <div className="w-full h-screen max-h-screen flex flex-col min-h-0 overflow-hidden bg-muted/20 dark:bg-background m-0 p-0">
      <AdminDashboard />
    </div>
  )
}