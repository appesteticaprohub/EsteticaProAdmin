// src/components/DashboardStats.tsx

'use client'

import { useEffect, useState } from 'react'
import StatsCard from './StatsCard'
import SystemStatusCard from './SystemStatusCard'

interface InitialData {
  users: {
    total: number
  }
  posts: {
    total: number
  }
  subscriptions: {
    active: number
  }
  system: {
    serverStatus: 'active' | 'inactive'
    databaseStatus: 'connected' | 'disconnected'
    version: string
  }
}

interface PeriodData {
  count: number
  previousCount: number
  growthPercentage: number
  label: string
  period: string
}

interface CardData {
  value: number
  label: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  isLoading: boolean
}

export default function DashboardStats() {
  const [initialData, setInitialData] = useState<InitialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados individuales para cada card
  const [usersData, setUsersData] = useState<CardData>({
    value: 0,
    label: 'Total Usuarios',
    change: '',
    changeType: 'neutral',
    isLoading: false
  })

  const [postsData, setPostsData] = useState<CardData>({
    value: 0,
    label: 'Total Posts',
    change: '',
    changeType: 'neutral',
    isLoading: false
  })

  const [subscriptionsData, setSubscriptionsData] = useState<CardData>({
    value: 0,
    label: 'Suscripciones Activas',
    change: '',
    changeType: 'neutral',
    isLoading: false
  })

  useEffect(() => {
    fetchInitialStats()
  }, [])

  const fetchInitialStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/dashboard/stats')
      
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas')
      }
      
      const result = await response.json()
      setInitialData(result)

      // Inicializar las cards con los totales
      setUsersData({
        value: result.users.total,
        label: 'Total Usuarios',
        change: '',
        changeType: 'neutral',
        isLoading: false
      })

      setPostsData({
        value: result.posts.total,
        label: 'Total Posts',
        change: '',
        changeType: 'neutral',
        isLoading: false
      })

      setSubscriptionsData({
        value: result.subscriptions.active,
        label: 'Suscripciones Activas',
        change: '',
        changeType: 'neutral',
        isLoading: false
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUsersPeriodChange = async (period: string) => {
    if (period === 'total' && initialData) {
      setUsersData({
        value: initialData.users.total,
        label: 'Total Usuarios',
        change: '',
        changeType: 'neutral',
        isLoading: false
      })
      return
    }

    try {
      setUsersData(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetch(`/api/admin/dashboard/users?period=${period}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos de usuarios')
      }
      
      const result: PeriodData = await response.json()
      
      setUsersData({
        value: result.count,
        label: result.label,
        change: formatChange(result.growthPercentage, result.count, result.previousCount),
        changeType: getChangeType(result.growthPercentage),
        isLoading: false
      })

    } catch (err) {
      console.error('Error fetching users period data:', err)
      setUsersData(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handlePostsPeriodChange = async (period: string) => {
    if (period === 'total' && initialData) {
      setPostsData({
        value: initialData.posts.total,
        label: 'Total Posts',
        change: '',
        changeType: 'neutral',
        isLoading: false
      })
      return
    }

    try {
      setPostsData(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetch(`/api/admin/dashboard/posts?period=${period}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos de posts')
      }
      
      const result: PeriodData = await response.json()
      
      setPostsData({
        value: result.count,
        label: result.label,
        change: formatChange(result.growthPercentage, result.count, result.previousCount),
        changeType: getChangeType(result.growthPercentage),
        isLoading: false
      })

    } catch (err) {
      console.error('Error fetching posts period data:', err)
      setPostsData(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleSubscriptionsPeriodChange = async (period: string) => {
    if (period === 'total' && initialData) {
      setSubscriptionsData({
        value: initialData.subscriptions.active,
        label: 'Suscripciones Activas',
        change: '',
        changeType: 'neutral',
        isLoading: false
      })
      return
    }

    try {
      setSubscriptionsData(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetch(`/api/admin/dashboard/subscriptions?period=${period}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos de suscripciones')
      }
      
      const result: PeriodData = await response.json()
      
      setSubscriptionsData({
        value: result.count,
        label: result.label,
        change: formatChange(result.growthPercentage, result.count, result.previousCount),
        changeType: getChangeType(result.growthPercentage),
        isLoading: false
      })

    } catch (err) {
      console.error('Error fetching subscriptions period data:', err)
      setSubscriptionsData(prev => ({ ...prev, isLoading: false }))
    }
  }

  const formatChange = (percentage: number, current: number, previous: number): string => {
    const diff = current - previous
    const sign = percentage >= 0 ? '+' : ''
    return `${sign}${percentage.toFixed(1)}% (${sign}${diff}) vs período anterior`
  }

  const getChangeType = (percentage: number): 'positive' | 'negative' | 'neutral' => {
    if (percentage > 0) return 'positive'
    if (percentage < 0) return 'negative'
    return 'neutral'
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
            onClick={fetchInitialStats}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!initialData) return null

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card Usuarios */}
        <StatsCard
          title={usersData.label}
          value={usersData.value}
          change={usersData.change}
          changeType={usersData.changeType}
          icon="👥"
          onPeriodChange={handleUsersPeriodChange}
          isLoading={usersData.isLoading}
        />

        {/* Card Posts */}
        <StatsCard
          title={postsData.label}
          value={postsData.value}
          change={postsData.change}
          changeType={postsData.changeType}
          icon="📄"
          onPeriodChange={handlePostsPeriodChange}
          isLoading={postsData.isLoading}
        />

        {/* Card Suscripciones */}
        <StatsCard
          title={subscriptionsData.label}
          value={subscriptionsData.value}
          change={subscriptionsData.change}
          changeType={subscriptionsData.changeType}
          icon="⭐"
          onPeriodChange={handleSubscriptionsPeriodChange}
          isLoading={subscriptionsData.isLoading}
        />
      </div>

      {/* System Status */}
      <div className="mt-8">
        <SystemStatusCard
          serverStatus={initialData.system.serverStatus}
          databaseStatus={initialData.system.databaseStatus}
          version={initialData.system.version}
        />
      </div>
    </div>
  )
}