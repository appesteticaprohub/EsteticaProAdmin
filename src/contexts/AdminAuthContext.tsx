'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface Admin {
  id: string
  email: string
  full_name: string | null
}

interface AdminAuthContextType {
  admin: Admin | null
  loading: boolean
  signOut: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    try {
      const response = await fetch('/api/auth/admin-session')
      if (response.ok) {
        const data = await response.json()
        setAdmin(data.admin)
      } else {
        setAdmin(null)
      }
    } catch (error) {
      console.error('Error checking session:', error)
      setAdmin(null)
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    try {
      await fetch('/api/auth/admin-logout', { method: 'POST' })
      setAdmin(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return context
}