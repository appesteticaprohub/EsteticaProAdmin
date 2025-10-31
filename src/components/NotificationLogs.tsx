'use client'

import { useState, useEffect, useCallback } from 'react'

interface EmailLog {
  id: string
  user_id: string
  template_key: string
  email: string
  status: string
  resend_id: string | null
  error_message: string | null
  sent_at: string
}

interface EmailLog {
  id: string
  user_id: string
  template_key: string
  email: string
  status: string
  resend_id: string | null
  error_message: string | null
  sent_at: string
}

interface Template {
  template_key: string
  subject: string
  is_active: boolean
}

interface LogsFilters {
  status?: string
  template_key?: string
  user_email?: string
  date_from?: string
  date_to?: string
  limit?: number
  page?: number
}

export default function NotificationLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LogsFilters>({
    limit: 50,
    page: 1
  })
  const [totalLogs, setTotalLogs] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
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

      const response = await fetch(`/api/admin/notifications/logs?${params}`)
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        
        const combinedLogs = [
          ...(data.email_logs || []).map((log: EmailLog) => ({
            id: log.id,
            user_id: log.user_id,
            template_key: log.template_key,
            email: log.email,
            status: log.status,
            resend_id: log.resend_id,
            error_message: log.error_message,
            sent_at: log.sent_at
          }))
        ]
        
        if (currentFilters.page === 1) {
          setLogs(combinedLogs)
        } else {
          // Evitar duplicados al agregar nuevos logs
          setLogs(prev => {
            const existingIds = new Set(prev.map(log => log.id))
            const newLogs = combinedLogs.filter(log => !existingIds.has(log.id))
            return [...prev, ...newLogs]
          })
        }
        
        setTotalLogs(data.pagination?.total_records || combinedLogs.length)
        setHasMore(data.pagination?.has_next || false)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogsWithFilters(filters)
    fetchAvailableTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAvailableTemplates = async () => {
    try {
      const response = await fetch('/api/admin/notifications/templates')
      if (response.ok) {
        const data = await response.json()
        const templateKeys = data.templates?.map((t: Template) => t.template_key) || []
        setAvailableTemplates(templateKeys)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const loadMore = () => {
    const newFilters = { ...filters, page: (filters.page || 1) + 1 }
    setFilters(newFilters)
    fetchLogsWithFilters(newFilters)
  }

  const clearFilters = () => {
    setFilters({
      limit: 50,
      page: 1
    })
    setLogs([])
    fetchLogsWithFilters({
      limit: 50,
      page: 1
    })
  }

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && key !== 'limit' && key !== 'offset') {
          params.append(key, value.toString())
        }
      })
      params.append('export', 'true')

      const response = await fetch(`/api/admin/notifications/logs?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `notification-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting logs:', error)
      alert('Error al exportar logs')
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado'
      case 'failed': return 'Fallido'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return '✅'
      case 'failed': return '❌'
      default: return '⏳'
    }
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
      const response = await fetch('/api/admin/notifications/logs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          log_ids: selectedLogs,
          type: 'email'
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
        <h2 className="text-2xl font-bold text-gray-900">Logs de Emails</h2>
        <p className="text-gray-600 mt-1">Historial completo de emails enviados por el sistema</p>
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
              onClick={exportLogs}
              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              Exportar CSV
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => {
                  const newFilters = { ...filters, status: e.target.value || undefined, page: 1 }
                  setFilters(newFilters)
                  fetchLogsWithFilters(newFilters)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="sent">Enviado</option>
                <option value="failed">Fallido</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template
              </label>
              <select
                value={filters.template_key || ''}
                onChange={(e) => {
                  const newFilters = { ...filters, template_key: e.target.value || undefined, page: 1 }
                  setFilters(newFilters)
                  fetchLogsWithFilters(newFilters)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {availableTemplates.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={filters.user_email || ''}
                onChange={(e) => {
                  const newFilters = { ...filters, user_email: e.target.value || undefined, page: 1 }
                  setFilters(newFilters)
                  fetchLogsWithFilters(newFilters)
                }}
                placeholder="usuario@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha desde
              </label>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => {
                  const newFilters = { ...filters, date_from: e.target.value || undefined, page: 1 }
                  setFilters(newFilters)
                  fetchLogsWithFilters(newFilters)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha hasta
              </label>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => {
                  const newFilters = { ...filters, date_to: e.target.value || undefined, page: 1 }
                  setFilters(newFilters)
                  fetchLogsWithFilters(newFilters)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span>Mostrando {logs?.length || 0} de {totalLogs} registros</span>
            {loading && (
              <span className="inline-flex items-center text-blue-600">
                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando...
              </span>
            )}
          </div>
          {selectedLogs.length > 0 && (
            <span className="text-blue-600 font-medium">
              {selectedLogs.length} seleccionados
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading && (!logs || logs.length === 0) ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-b border-gray-200 pb-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : logs && logs.length > 0 ? (
          <>
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLogs.length === logs.length && logs.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Seleccionar todos ({logs.length})
                </span>
              </label>
            </div>

            <div className="divide-y divide-gray-200">
              {logs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedLogs.includes(log.id)}
                      onChange={() => toggleSelectLog(log.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg">{getStatusIcon(log.status)}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {getStatusText(log.status)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {log.email}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Template:</span>
                          <p className="text-gray-900">{log.template_key}</p>
                        </div>
                        
                        <div>
                          <span className="font-medium">Fecha:</span>
                          <p className="text-gray-900">{formatDate(log.sent_at)}</p>
                        </div>
                        
                        {log.resend_id && (
                          <div>
                            <span className="font-medium">ID Resend:</span>
                            <p className="text-gray-900 font-mono text-xs">{log.resend_id}</p>
                          </div>
                        )}
                        
                        <div>
                          <span className="font-medium">Usuario ID:</span>
                          <p className="text-gray-900 font-mono text-xs">{log.user_id.substring(0, 8)}...</p>
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                          <span className="text-sm font-medium text-red-800">Error:</span>
                          <p className="text-sm text-red-700 mt-1">{log.error_message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="p-6 text-center border-t border-gray-200">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center space-x-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{loading ? 'Cargando...' : `Cargar Más (${totalLogs - logs.length} restantes)`}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">
              {Object.keys(filters).some(key => key !== 'limit' && key !== 'page' && filters[key as keyof LogsFilters] !== undefined && filters[key as keyof LogsFilters] !== '')
                ? 'No se encontraron logs con los filtros aplicados'
                : 'No hay logs disponibles'
              }
            </p>
          </div>
        )}
      </div>

      {logs && logs.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de la Consulta</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {logs.filter(log => log.status === 'sent').length}
              </p>
              <p className="text-sm text-gray-600">Exitosos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {logs.filter(log => log.status === 'failed').length}
              </p>
              <p className="text-sm text-gray-600">Fallidos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {new Set(logs.map(log => log.template_key)).size}
              </p>
              <p className="text-sm text-gray-600">Templates Únicos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {new Set(logs.map(log => log.email)).size}
              </p>
              <p className="text-sm text-gray-600">Usuarios Únicos</p>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Eliminación
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de eliminar {selectedLogs.length} log{selectedLogs.length > 1 ? 's' : ''}?
              <br />
              <span className="text-red-600 font-medium">Esta acción no se puede deshacer.</span>
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
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