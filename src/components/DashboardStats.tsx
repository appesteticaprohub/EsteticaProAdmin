// src/components/DashboardStats.tsx

'use client'

import { useEffect, useState } from 'react'
import StatsCard from './StatsCard'
import SystemStatusCard from './SystemStatusCard'

interface DashboardData {
  users: {
    total: number
    growthPercentage: number
    newToday: number
    newThisWeek: number
    newThisMonth: number
    newThisYear: number
  }
  posts: {
    total: number
    deleted: number
    growthPercentage: number
    publishedToday: number
    publishedThisWeek: number
    publishedThisMonth: number
    publishedThisYear: number
  }
  subscriptions: {
    active: number
    growthPercentage: number
    activatedToday: number
    activatedThisWeek: number
    activatedThisMonth: number
    activatedThisYear: number
  }
  system: {
    serverStatus: 'active' | 'inactive'
    databaseStatus: 'connected' | 'disconnected'
    version: string
  }
}

export default function DashboardStats() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/dashboard/stats')
      
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas')
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error al cargar estadísticas</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchDashboardStats}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Usuarios */}
        <StatsCard
          title="Total Usuarios"
          value={data.users.total}
          change={`${data.users.growthPercentage >= 0 ? '+' : ''}${data.users.growthPercentage}%`}
          changeType={data.users.growthPercentage >= 0 ? 'positive' : 'negative'}
          icon="👥"
          details={[
            { label: 'Nuevos hoy', value: data.users.newToday },
            { label: 'Nuevos esta semana', value: data.users.newThisWeek },
            { label: 'Nuevos este mes', value: data.users.newThisMonth },
            { label: 'Nuevos este año', value: data.users.newThisYear }
          ]}
        />

        {/* Posts Publicados */}
        <StatsCard
          title="Posts Publicados"
          value={data.posts.total}
          change={`${data.posts.growthPercentage >= 0 ? '+' : ''}${data.posts.growthPercentage}%`}
          changeType={data.posts.growthPercentage >= 0 ? 'positive' : 'negative'}
          icon="📄"
          details={[
            { label: 'Posts activos', value: data.posts.total },
            { label: 'Posts eliminados', value: data.posts.deleted },
            { label: 'Publicados hoy', value: data.posts.publishedToday },
            { label: 'Publicados esta semana', value: data.posts.publishedThisWeek },
            { label: 'Publicados este mes', value: data.posts.publishedThisMonth },
            { label: 'Publicados este año', value: data.posts.publishedThisYear }
          ]}
        />

        {/* Suscripciones Activas */}
        <StatsCard
          title="Suscripciones Activas"
          value={data.subscriptions.active}
          change={`${data.subscriptions.growthPercentage >= 0 ? '+' : ''}${data.subscriptions.growthPercentage}%`}
          changeType={data.subscriptions.growthPercentage >= 0 ? 'positive' : 'negative'}
          icon="⭐"
          details={[
            { label: 'Activadas hoy', value: data.subscriptions.activatedToday },
            { label: 'Activadas esta semana', value: data.subscriptions.activatedThisWeek },
            { label: 'Activadas este mes', value: data.subscriptions.activatedThisMonth },
            { label: 'Activadas este año', value: data.subscriptions.activatedThisYear }
          ]}
        />
      </div>

      {/* System Status */}
      <div className="mt-8">
        <SystemStatusCard
          serverStatus={data.system.serverStatus}
          databaseStatus={data.system.databaseStatus}
          version={data.system.version}
        />
      </div>
    </div>
  )
}