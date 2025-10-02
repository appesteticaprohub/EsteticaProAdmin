'use client'

import { useState, useEffect } from 'react'
import type { StorageStats } from '@/types/admin'

export default function StorageStatsPanel() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/storage-stats')
      const data = await response.json()
      
      if (data.data) {
        setStats(data.data)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError('Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-200">
          {error || 'Error al cargar estadísticas'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estadísticas de Almacenamiento</h2>
          <p className="text-gray-600 mt-1">Información sobre el uso de imágenes en el sistema</p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Cards de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Imágenes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_images}</p>
            </div>
            <div className="text-4xl">🖼️</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Almacenamiento</p>
              <p className="text-3xl font-bold text-gray-900">{stats.storage_used_mb}</p>
              <p className="text-xs text-gray-500">MB ({stats.storage_used_gb} GB)</p>
            </div>
            <div className="text-4xl">💾</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Este Mes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.images_this_month}</p>
            </div>
            <div className="text-4xl">📅</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Promedio/Post</p>
              <p className="text-3xl font-bold text-gray-900">{stats.average_images_per_post}</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top uploaders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            👥 Top Usuarios con Más Imágenes
          </h3>
          {stats.top_uploaders.length > 0 ? (
            <div className="space-y-3">
              {stats.top_uploaders.map((uploader, index) => (
                <div
                  key={uploader.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-bold text-gray-400">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{uploader.user_name}</p>
                      <p className="text-xs text-gray-500">{uploader.user_id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{uploader.image_count}</p>
                    <p className="text-xs text-gray-500">imágenes</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay datos disponibles</p>
          )}
        </div>

        {/* Tendencia mensual */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Tendencia Mensual (Últimos 6 meses)
          </h3>
          <div className="space-y-3">
            {stats.monthly_trend.map((month) => {
              const maxCount = Math.max(...stats.monthly_trend.map(m => m.count))
              const percentage = maxCount > 0 ? (month.count / maxCount) * 100 : 0
              
              return (
                <div key={month.month}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{month.month}</span>
                    <span className="font-semibold text-gray-900">{month.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">ℹ️</span>
          <div>
            <p className="text-sm text-blue-900 font-medium">Información</p>
            <p className="text-sm text-blue-700 mt-1">
              Esta semana se han subido <strong>{stats.images_this_week}</strong> imágenes.
              El almacenamiento mostrado es una estimación basada en el número de imágenes (promedio 0.5 MB por imagen).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}