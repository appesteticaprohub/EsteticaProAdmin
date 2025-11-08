// src/components/DashboardStats.tsx

'use client'

import { useEffect, useState } from 'react'
import UsersStatsCard from './UsersStatsCard'
import PostsStatsCard from './PostsStatsCard'
import RevenueStatsCard from './RevenueStatsCard'
import SystemStatusCard from './SystemStatusCard'

interface SystemData {
  serverStatus: 'active' | 'inactive'
  databaseStatus: 'connected' | 'disconnected'
  version: string
}

export default function DashboardStats() {
  const [systemData, setSystemData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSystemStatus()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/dashboard/stats')
      
      if (!response.ok) {
        throw new Error('Error al cargar estado del sistema')
      }
      
      const result = await response.json()
      setSystemData(result.system)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error fetching system status:', err)
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
          <p className="text-red-800 font-medium">Error al cargar estado del sistema</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchSystemStatus}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Card de Usuarios */}
        <UsersStatsCard />

        {/* Card de Posts */}
        <PostsStatsCard />

        {/* Card de Ingresos */}
        <RevenueStatsCard />
      </div>

      {/* System Status */}
      {systemData && (
        <div className="mt-8">
          <SystemStatusCard
            serverStatus={systemData.serverStatus}
            databaseStatus={systemData.databaseStatus}
            version={systemData.version}
          />
        </div>
      )}
    </div>
  )
}