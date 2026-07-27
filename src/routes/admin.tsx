// src/routes/admin.tsx
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { usePerfil } from '@/hooks/use-perfil'

export const Route = createFileRoute('/admin')({
  component: AdminComponent,
})

function AdminComponent() {
  const { isAdmin, loading } = usePerfil();

  // Enquanto carrega as permissões do Supabase
  if (loading) return <div className="h-screen flex items-center justify-center bg-background text-primary">Verificando credenciais...</div>;
  
  // Se não for Admin, expulsa para a tela do consultor (ou login)
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="w-full h-screen max-h-screen flex flex-col min-h-0 overflow-hidden bg-muted/20 dark:bg-background m-0 p-0">
      <AdminDashboard />
    </div>
  )
}