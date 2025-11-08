// src/components/PostsStatsCard.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import DateRangeFilter from './DateRangeFilter'
import type { DashboardPostsResponse } from '@/types/admin'

export default function PostsStatsCard() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DashboardPostsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtros
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [postStatus, setPostStatus] = useState('all')
  const hasFetchedInitialData = useRef(false)

  const fetchData = async (filters?: { dateFrom?: string; dateTo?: string; postStatus?: string }) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters?.dateTo) params.append('dateTo', filters.dateTo)
      if (filters?.postStatus && filters.postStatus !== 'all') {
        params.append('postStatus', filters.postStatus)
      }

      const url = `/api/admin/dashboard/posts${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos de posts')
      }
      
      const result: DashboardPostsResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error fetching posts stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilters = () => {
    fetchData({ dateFrom, dateTo, postStatus })
  }

  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setPostStatus('all')
    fetchData()
  }

  const handleStatusChange = (status: string) => {
    setPostStatus(status)
  }

  // Cargar datos iniciales solo una vez
  useEffect(() => {
    if (!hasFetchedInitialData.current) {
      hasFetchedInitialData.current = true
      fetchData()
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">📄 Posts Creados</h3>
            <p className="text-sm text-gray-500 mt-1">Publicaciones</p>
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
            Estado:
          </label>
          <select
            value={postStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="deleted">Eliminados</option>
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
              <p className="text-sm text-gray-500 mt-1">Total Publicados</p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 uppercase mb-3">
                Por Estado:
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">✅ Activos:</span>
                  <span className="font-semibold text-gray-900">
                    {data.statusBreakdown.active.toLocaleString('es-CO')} (
                    {data.total > 0 
                      ? ((data.statusBreakdown.active / data.total) * 100).toFixed(1) 
                      : '0.0'}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">🗑️ Eliminados:</span>
                  <span className="font-semibold text-gray-900">
                    {data.statusBreakdown.deleted.toLocaleString('es-CO')} (
                    {data.total > 0 
                      ? ((data.statusBreakdown.deleted / data.total) * 100).toFixed(1) 
                      : '0.0'}%)
                  </span>
                </div>
              </div>
            </div>

            {data.averagePerDay > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Promedio: <span className="font-semibold text-gray-900">{data.averagePerDay}</span> posts/día
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}