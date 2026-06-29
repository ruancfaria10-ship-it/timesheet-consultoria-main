// src/hooks/use-perfil.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function usePerfil() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verificarPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setIsAuthenticated(false)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      setIsAuthenticated(true)

      // Verifica se o usuário logado possui nível admin
      const { data } = await supabase
        .from('consultores')
        .select('perfil')
        .eq('id', user.id)
        .single()

      if (data?.perfil === 'admin') {
        setIsAdmin(true)
      }
      
      setLoading(false)
    }

    verificarPerfil()

    // Escuta em tempo real se o usuário fez login ou logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAuthenticated(false)
        setIsAdmin(false)
      } else {
        verificarPerfil()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { isAdmin, isAuthenticated, loading }
}