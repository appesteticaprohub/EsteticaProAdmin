'use client'

import { useState, useEffect } from 'react'

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

interface LogsFilters {
  status?: string
  template_key?: string
  email?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

interface LogsResponse {
  logs: EmailLog[]
  total: number
  has_more: boolean
}

export default function NotificationLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LogsFilters>({
    limit: 20,
    offset: 0
  })
  const [totalLogs, setTotalLogs] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchLogs()
    fetchAvailableTemplates()
  }, [])

  useEffect(() => {
    // Reset pagination when filters change
    const newFilters = { ...filters, offset: 0 }
    setFilters(newFilters)
    fetchLogsWithFilters(newFilters)
  }, [filters.status, filters.template_key, filters.email, filters.start_date, filters.end_date])

  const fetchLogs = () => {
    fetchLogsWithFilters(filters)
  }

  const fetchLogsWithFilters = async (currentFilters: LogsFilters) => {
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
        
        // Combinar email_logs y notifications en un solo array
        const combinedLogs = [
          ...(data.email_logs || []).map((log: any) => ({
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
        
        if (currentFilters.offset === 0) {
          setLogs(combinedLogs)
        } else {
          setLogs(prev => [...prev, ...combinedLogs])
        }
        
        setTotalLogs(data.pagination?.total_records || combinedLogs.length)
        setHasMore(data.pagination?.has_next || false)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableTemplates = async () => {
    try {
      const response = await fetch('/api/admin/notifications/templates')
      if (response.ok) {
        const data = await response.json()
        const templateKeys = data.templates?.map((t: any) => t.template_key) || []
        setAvailableTemplates(templateKeys)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const loadMore = () => {
    const newFilters = { ...filters, offset: logs.length }
    setFilters(newFilters)
    fetchLogsWithFilters(newFilters)
  }

  const clearFilters = () => {
    setFilters({
      limit: 20,
      offset: 0
    })
    setLogs([])
    fetchLogsWithFilters({
      limit: 20,
      offset: 0
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
    // Interpretar como UTC y mostrar UTC
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
      case 'delivered': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado'
      case 'delivered': return 'Entregado'
      case 'failed': return 'Fallido'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return '📧'
      case 'delivered': return '✅'
      case 'failed': return '❌'
      default: return '⏳'
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Logs de Notificaciones</h2>
        <p className="text-gray-600 mt-1">Historial completo de emails y notificaciones enviadas</p>
      </div>

      {/* Filtros */}
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
              onClick={clearFilters}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="sent">Enviado</option>
                <option value="delivered">Entregado</option>
                <option value="failed">Fallido</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template
              </label>
              <select
                value={filters.template_key || ''}
                onChange={(e) => setFilters({ ...filters, template_key: e.target.value || undefined })}
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
                value={filters.email || ''}
                onChange={(e) => setFilters({ ...filters, email: e.target.value || undefined })}
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
                value={filters.start_date || ''}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Mostrando {logs?.length || 0} de {totalLogs} registros
        </div>
      </div>

      {/* Lista de logs */}
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
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
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

            {hasMore && (
              <div className="p-6 text-center border-t border-gray-200">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Cargando...' : 'Cargar Más'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">
              {Object.keys(filters).some(key => key !== 'limit' && key !== 'offset' && filters[key as keyof LogsFilters] !== undefined && filters[key as keyof LogsFilters] !== '')
                ? 'No se encontraron logs con los filtros aplicados'
                : 'No hay logs disponibles'
              }
            </p>
          </div>
        )}
      </div>

      {/* Estadísticas rápidas */}
      {logs && logs.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de la Consulta</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {logs.filter(log => log.status === 'sent' || log.status === 'delivered').length}
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
    </div>
  )
}