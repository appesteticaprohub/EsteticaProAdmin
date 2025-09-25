'use client'

import { useState, useEffect } from 'react'

interface DetailedStats {
  emails: {
    today: number
    week: number
    month: number
    success_rate: number
  }
  notifications: {
    active: number
    total_sent: number
    unread_count: number
  }
  templates: {
    total: number
    active: number
    system: number
  }
  users: {
    total_recipients: number
    email_enabled: number
    promotional_enabled: number
  }
}

interface RecentEmail {
  id: string
  email: string
  template_key: string
  status: string
  sent_at: string
}

export default function NotificationDashboard() {
  const [stats, setStats] = useState<DetailedStats | null>(null)
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchRecentEmails()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/notifications/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchRecentEmails = async () => {
    try {
      const response = await fetch('/api/admin/notifications/logs?limit=5')
      if (response.ok) {
        const data = await response.json()
        setRecentEmails(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching recent emails:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'delivered': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado'
      case 'failed': return 'Fallido'
      case 'delivered': return 'Entregado'
      default: return status
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard de Notificaciones</h2>
        <p className="text-gray-600 mt-1">Estadísticas y actividad del sistema de notificaciones</p>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">
                Emails Enviados Hoy
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.emails?.today || 0}
              </p>
              <p className="text-sm text-blue-600 mt-2">
                {stats?.emails?.success_rate || 0}% éxito
              </p>
            </div>
            <div className="text-3xl">📧</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">
                Notificaciones Activas
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.notifications?.active || 0}
              </p>
              <p className="text-sm text-green-600 mt-2">
                {stats?.notifications?.unread_count || 0} no leídas
              </p>
            </div>
            <div className="text-3xl">🔔</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">
                Templates Activos
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.templates?.active || 0}
              </p>
              <p className="text-sm text-purple-600 mt-2">
                {stats?.templates?.total || 0} total
              </p>
            </div>
            <div className="text-3xl">📝</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">
                Usuarios Activos
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.users?.email_enabled || 0}
              </p>
              <p className="text-sm text-indigo-600 mt-2">
                {stats?.users?.promotional_enabled || 0} promociones
              </p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
      </div>

      {/* Actividad reciente y resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Emails Recientes</h3>
          <div className="space-y-4">
            {recentEmails.length > 0 ? (
              recentEmails.map((email) => (
                <div key={email.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{email.email}</p>
                    <p className="text-xs text-gray-500">
                      {email.template_key} • {formatDate(email.sent_at)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(email.status)}`}>
                    {getStatusText(email.status)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No hay emails recientes</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen Semanal</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Emails enviados</span>
              <span className="text-sm font-medium text-gray-900">{stats?.emails?.week || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Notificaciones enviadas</span>
              <span className="text-sm font-medium text-gray-900">{stats?.notifications?.total_sent || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tasa de éxito</span>
              <span className="text-sm font-medium text-green-600">{stats?.emails?.success_rate || 0}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Templates del sistema</span>
              <span className="text-sm font-medium text-gray-900">{stats?.templates?.system || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}