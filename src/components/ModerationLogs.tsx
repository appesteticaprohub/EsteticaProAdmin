'use client'

import { useState, useEffect, useCallback } from 'react'

interface ModerationLog {
  id: string
  admin_id: string
  action_type: 'ban_user' | 'unban_user' | 'delete_post' | 'delete_comment' | 'approve_post' | 'restore_post' | 'restore_comment'
  target_type: 'user' | 'post' | 'comment'
  target_id: string
  reason: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  admin: {
    id: string
    full_name: string | null
    email: string
  } | null
}

interface LogsFilters {
  actionType?: string
  targetType?: string
  adminId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export default function ModerationLogs() {
  const [logs, setLogs] = useState<ModerationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LogsFilters>({
    page: 1,
    limit: 50
  })
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLogs, setSelectedLogs] = useState<string[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchLogsWithFilters = useCallback(async (currentFilters: LogsFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/admin/moderation/logs?${params}`)
      if (response.ok) {
        const result = await response.json()
        setLogs(result.data || [])
        setTotalRecords(result.pagination?.total_records || 0)
        setTotalPages(result.pagination?.total_pages || 0)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogsWithFilters(filters)
  }, [filters, fetchLogsWithFilters])

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
    setSelectedLogs([])
  }

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50
    })
    setSelectedLogs([])
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const utcDay = String(date.getUTCDate()).padStart(2, '0')
    const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
    const utcYear = date.getUTCFullYear()
    const utcHours = date.getUTCHours()
    const utcMinutes = String(date.getUTCMinutes()).padStart(2, '0')
    const utcSeconds = String(date.getUTCSeconds()).padStart(2, '0')
    const ampm = utcHours >= 12 ? 'p. m.' : 'a. m.'
    const hours12 = utcHours % 12 || 12
    
    return `${utcDay}/${utcMonth}/${utcYear}, ${String(hours12).padStart(2, '0')}:${utcMinutes}:${utcSeconds} ${ampm} UTC`
  }

  const getActionTypeText = (actionType: string) => {
    const texts: Record<string, string> = {
      'ban_user': 'Bannear Usuario',
      'unban_user': 'Desbanear Usuario',
      'delete_post': 'Eliminar Post',
      'delete_comment': 'Eliminar Comentario',
      'approve_post': 'Aprobar Post',
      'restore_post': 'Restaurar Post',
      'restore_comment': 'Restaurar Comentario'
    }
    return texts[actionType] || actionType
  }

  const getActionTypeColor = (actionType: string) => {
    const colors: Record<string, string> = {
      'ban_user': 'bg-red-100 text-red-800',
      'unban_user': 'bg-green-100 text-green-800',
      'delete_post': 'bg-orange-100 text-orange-800',
      'delete_comment': 'bg-orange-100 text-orange-800',
      'approve_post': 'bg-blue-100 text-blue-800',
      'restore_post': 'bg-teal-100 text-teal-800',
      'restore_comment': 'bg-teal-100 text-teal-800'
    }
    return colors[actionType] || 'bg-gray-100 text-gray-800'
  }

  const getTargetTypeText = (targetType: string) => {
    const texts: Record<string, string> = {
      'user': 'Usuario',
      'post': 'Post',
      'comment': 'Comentario'
    }
    return texts[targetType] || targetType
  }

  const toggleSelectLog = (logId: string) => {
    setSelectedLogs(prev =>
      prev.includes(logId)
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedLogs.length === logs.length) {
      setSelectedLogs([])
    } else {
      setSelectedLogs(logs.map(log => log.id))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedLogs.length === 0) {
      alert('Selecciona al menos un log para eliminar')
      return
    }
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch('/api/admin/moderation/logs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          log_ids: selectedLogs
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`${result.data.deleted_count} logs eliminados exitosamente`)
        setSelectedLogs([])
        setShowDeleteModal(false)
        fetchLogsWithFilters(filters)
      } else {
        const error = await response.json()
        alert(`Error al eliminar: ${error.error}`)
      }
    } catch (error) {
      console.error('Error eliminando logs:', error)
      alert('Error al eliminar logs')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Logs de Moderación</h2>
        <p className="text-gray-600 mt-1">Historial completo de acciones de moderación realizadas</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedLogs.length === 0}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Eliminar ({selectedLogs.length})
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Acción
              </label>
              <select
                value={filters.actionType || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, actionType: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="ban_user">Bannear Usuario</option>
                <option value="unban_user">Desbanear Usuario</option>
                <option value="delete_post">Eliminar Post</option>
                <option value="delete_comment">Eliminar Comentario</option>
                <option value="approve_post">Aprobar Post</option>
                <option value="restore_post">Restaurar Post</option>
                <option value="restore_comment">Restaurar Comentario</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Target
              </label>
              <select
                value={filters.targetType || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, targetType: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="user">Usuario</option>
                <option value="post">Post</option>
                <option value="comment">Comentario</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value || undefined, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          Mostrando {logs.length} de {totalRecords} registros
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">Cargando logs...</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No hay logs de moderación disponibles</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLogs.length === logs.length && logs.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Admin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Razón
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedLogs.includes(log.id)}
                          onChange={() => toggleSelectLog(log.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionTypeColor(log.action_type)}`}>
                          {getActionTypeText(log.action_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{getTargetTypeText(log.target_type)}</div>
                          <div className="text-xs text-gray-500 font-mono">{log.target_id.substring(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{log.admin?.full_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{log.admin?.email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {log.reason || <span className="text-gray-400 italic">Sin razón</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Página {filters.page} de {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange((filters.page || 1) - 1)}
                  disabled={filters.page === 1}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => handlePageChange((filters.page || 1) + 1)}
                  disabled={filters.page === totalPages}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar {selectedLogs.length} log(s) de moderación? 
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}