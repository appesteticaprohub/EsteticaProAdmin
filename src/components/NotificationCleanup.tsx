'use client'

import { useState } from 'react'

interface CleanupPreview {
  notifications_count: number
  email_logs_count: number
  breakdown: {
    by_category: Record<string, number>
    by_type: Record<string, number>
    by_read_status: { read: number; unread: number }
  }
}

export default function NotificationCleanup() {
  const [dateBefore, setDateBefore] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [isRead, setIsRead] = useState<string>('all')
  const [preview, setPreview] = useState<CleanupPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<any>(null)

  const handlePreview = async () => {
    if (!dateBefore) {
      alert('Por favor selecciona una fecha')
      return
    }

    setLoading(true)
    setPreview(null)
    
    try {
      const params = new URLSearchParams({
        date_before: dateBefore,
        ...(category !== 'all' && { category }),
        ...(type !== 'all' && { type }),
        ...(isRead !== 'all' && { is_read: isRead })
      })

      const response = await fetch(`/api/admin/notifications/cleanup?${params}`)
      const result = await response.json()

      if (response.ok && result.data) {
        setPreview(result.data)
      } else {
        alert(result.error || 'Error al obtener preview')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al obtener preview')
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    setLoading(true)
    setShowConfirmModal(false)
    
    try {
      const response = await fetch('/api/admin/notifications/cleanup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_before: dateBefore,
          ...(category !== 'all' && { category }),
          ...(type !== 'all' && { type }),
          ...(isRead !== 'all' && { is_read: isRead === 'true' })
        })
      })

      const result = await response.json()

      if (response.ok && result.data) {
        setCleanupResult(result.data)
        setPreview(null)
        setDateBefore('')
      } else {
        alert(result.error || 'Error al ejecutar limpieza')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al ejecutar limpieza')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Limpieza de Notificaciones</h2>
        <p className="text-gray-600">
          Elimina notificaciones antiguas y logs de emails para mantener la base de datos optimizada
        </p>
      </div>

      {/* Advertencia */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Acción Irreversible</h3>
            <p className="text-sm text-yellow-700">
              Esta operación eliminará permanentemente las notificaciones y logs de email. 
              Esta acción no se puede deshacer. Usa el preview para verificar antes de eliminar.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros de Limpieza</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eliminar registros anteriores a: *
            </label>
            <input
              type="date"
              value={dateBefore}
              onChange={(e) => setDateBefore(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las categorías</option>
              <option value="critical">Críticas</option>
              <option value="important">Importantes</option>
              <option value="normal">Normales</option>
              <option value="promotional">Promocionales</option>
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los tipos</option>
              <option value="in_app">Solo In-App</option>
              <option value="email">Solo Email</option>
            </select>
          </div>

          {/* Estado de lectura */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={isRead}
              onChange={(e) => setIsRead(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              <option value="true">Solo leídas</option>
              <option value="false">Solo no leídas</option>
            </select>
          </div>
        </div>

        {/* Botón Preview */}
        <div className="mt-6">
          <button
            onClick={handlePreview}
            disabled={loading || !dateBefore}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-md transition-colors"
          >
            {loading ? 'Cargando...' : 'Ver Preview'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview de Eliminación</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Total notificaciones */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600 mb-1">Notificaciones In-App</p>
              <p className="text-3xl font-bold text-red-700">{preview.notifications_count}</p>
            </div>

            {/* Total email logs */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600 mb-1">Logs de Email</p>
              <p className="text-3xl font-bold text-red-700">{preview.email_logs_count}</p>
            </div>
          </div>

          {/* Breakdown */}
          {preview.notifications_count > 0 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Por Categoría:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(preview.breakdown.by_category).map(([cat, count]) => (
                    <div key={cat} className="bg-gray-50 px-3 py-2 rounded text-sm">
                      <span className="font-medium">{cat}:</span> {count}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Por Tipo:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(preview.breakdown.by_type).map(([t, count]) => (
                    <div key={t} className="bg-gray-50 px-3 py-2 rounded text-sm">
                      <span className="font-medium">{t}:</span> {count}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Por Estado:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 px-3 py-2 rounded text-sm">
                    <span className="font-medium">Leídas:</span> {preview.breakdown.by_read_status.read}
                  </div>
                  <div className="bg-gray-50 px-3 py-2 rounded text-sm">
                    <span className="font-medium">No leídas:</span> {preview.breakdown.by_read_status.unread}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón Ejecutar */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-md transition-colors"
            >
              Ejecutar Limpieza
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {cleanupResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-green-800 mb-2">Limpieza Completada</h3>
              <div className="space-y-1 text-sm text-green-700">
                <p>Notificaciones eliminadas: <strong>{cleanupResult.notifications_deleted}</strong></p>
                <p>Email logs eliminados: <strong>{cleanupResult.email_logs_deleted}</strong></p>
                <p>Total eliminado: <strong>{cleanupResult.total_deleted}</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Eliminación</h3>
            <p className="text-gray-600 mb-6">
              Estás a punto de eliminar <strong>{(preview?.notifications_count || 0) + (preview?.email_logs_count || 0)}</strong> registros.
              Esta acción es <strong>irreversible</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCleanup}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}