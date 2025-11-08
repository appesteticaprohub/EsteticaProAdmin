// src/components/UsersStatsCard.tsx
'use client'

import { useState } from 'react'
import DateRangeFilter from './DateRangeFilter'
import type { DashboardUsersResponse } from '@/types/admin'

// Estados válidos del sistema
const VALID_SUBSCRIPTION_STATES = [
  'Active',
  'Cancelled', 
  'Suspended',
  'Expired',
  'Payment_Failed',
  'Grace_Period'
] as const

export default function UsersStatsCard() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DashboardUsersResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtros
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('all')

  const fetchData = async (filters?: { dateFrom?: string; dateTo?: string; subscriptionStatus?: string }) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters?.dateTo) params.append('dateTo', filters.dateTo)
      if (filters?.subscriptionStatus && filters.subscriptionStatus !== 'all') {
        params.append('subscriptionStatus', filters.subscriptionStatus)
      }

      const response = await fetch(`/api/admin/dashboard/users?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos de usuarios')
      }
      
      const result: DashboardUsersResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error fetching users stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilters = () => {
    fetchData({ dateFrom, dateTo, subscriptionStatus })
  }

  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setSubscriptionStatus('all')
    fetchData()
  }

  const handleStatusChange = (status: string) => {
    setSubscriptionStatus(status)
  }

  // Cargar datos iniciales
  useState(() => {
    fetchData()
  })

  // Función para obtener icono según el estado
  const getStatusIcon = (status: string): string => {
    const icons: Record<string, string> = {
      'Active': '✅',
      'Cancelled': '🚫',
      'Suspended': '⏸️',
      'Expired': '❌',
      'Payment_Failed': '⚠️',
      'Grace_Period': '⏳'
    }
    return icons[status] || '❓'
  }

  // Filtrar solo estados válidos del breakdown
const getFilteredBreakdown = (breakdown: Record<string, number>) => {
  return Object.entries(breakdown)
    .filter(([status]) => (VALID_SUBSCRIPTION_STATES as readonly string[]).includes(status))
    .sort(([, a], [, b]) => b - a) // Ordenar por cantidad descendente
}

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">👥 Usuarios</h3>
            <p className="text-sm text-gray-500 mt-1">Registrados</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-6 border-b border-gray-200">
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          isLoading={loading}
        />

        {/* Filtro de Estado */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Estado de Suscripción:
          </label>
          <select
            value={subscriptionStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="all">Todos</option>
            <option value="Active">Active</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Suspended">Suspended</option>
            <option value="Expired">Expired</option>
            <option value="Payment_Failed">Payment_Failed</option>
            <option value="Grace_Period">Grace_Period</option>
          </select>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {data.total.toLocaleString('es-CO')}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Registrados</p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 uppercase mb-3">
                Por Estado de Suscripción:
              </p>
              <div className="space-y-2">
                {getFilteredBreakdown(data.statusBreakdown).map(([status, count]) => {
                  const percentage = data.total > 0 ? ((count / data.total) * 100).toFixed(1) : '0.0'
                  const icon = getStatusIcon(status)
                  
                  return (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {icon} {status}:
                      </span>
                      <span className="font-semibold text-gray-900">
                        {count.toLocaleString('es-CO')} ({percentage}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}