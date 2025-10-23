'use client'

import { useState, useEffect } from 'react'
import { BackupConfig } from '@/types/backup'

export default function BackupPanel() {
  // Estados del formulario
  const [backupType, setBackupType] = useState<'full' | 'selective'>('full')
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [availableTables, setAvailableTables] = useState<string[]>([])
  const [loadingTables, setLoadingTables] = useState(true)
  
  // Opciones de backup
  const [options, setOptions] = useState({
    includeStructure: true,
    includeData: true,
    includeRLS: true,
    includeTriggers: false,
    includeIndexes: true,
    includeExtensions: true
  })
  
  // Filtros de fecha
  const [useDateFilter, setUseDateFilter] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Formato de salida
  const [format, setFormat] = useState<'sql' | 'json'>('sql')
  
  // Estados de UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Efecto para cargar las tablas disponibles al montar el componente
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoadingTables(true)
        const response = await fetch('/api/admin/backup/tables')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Error al cargar tablas')
        }

        if (result.success && result.tables) {
          setAvailableTables(result.tables)
          // Si es modo completo, seleccionar todas automáticamente
          if (backupType === 'full') {
            setSelectedTables(result.tables)
          }
        }
      } catch (err) {
        console.error('Error cargando tablas:', err)
        setError('Error al cargar la lista de tablas disponibles')
      } finally {
        setLoadingTables(false)
      }
    }

    fetchTables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo se ejecuta al montar el componente

  // Efecto para seleccionar todas las tablas y opciones cuando cambia a modo completo
  useEffect(() => {
    if (backupType === 'full') {
      setSelectedTables(availableTables)
      // Marcar todas las opciones en modo completo
      setOptions({
        includeStructure: true,
        includeData: true,
        includeRLS: true,
        includeTriggers: true,
        includeIndexes: true,
        includeExtensions: true
      })
    }
  }, [backupType, availableTables])

  // Handler para seleccionar/deseleccionar todas las tablas
  const handleToggleAllTables = () => {
    if (selectedTables.length === availableTables.length) {
      setSelectedTables([])
    } else {
      setSelectedTables(availableTables)
    }
  }

  // Handler para seleccionar/deseleccionar una tabla
  const handleToggleTable = (table: string) => {
    if (selectedTables.includes(table)) {
      setSelectedTables(selectedTables.filter(t => t !== table))
    } else {
      setSelectedTables([...selectedTables, table])
    }
  }

  // Validación del formulario
  const validateForm = (): string | null => {
    if (backupType === 'selective' && selectedTables.length === 0) {
      return 'Debes seleccionar al menos una tabla para el backup selectivo'
    }

    if (useDateFilter) {
      if (!dateFrom || !dateTo) {
        return 'Debes especificar ambas fechas (desde y hasta)'
      }
      if (new Date(dateFrom) > new Date(dateTo)) {
        return 'La fecha "desde" no puede ser mayor que la fecha "hasta"'
      }
    }

    const hasAnyOption = Object.values(options).some(v => v === true)
    if (!hasAnyOption) {
      return 'Debes seleccionar al menos una opción de contenido'
    }

    return null
  }

  // Handler principal para generar backup
  const handleGenerateBackup = async () => {
    // Limpiar mensajes previos
    setError(null)
    setSuccess(null)

    // Validar formulario
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      // Construir configuración del backup
      const config: BackupConfig = {
        type: backupType,
        tables: backupType === 'full' ? undefined : selectedTables,
        options: options,
        format: format
      }

      // Agregar filtros de fecha si están habilitados
      if (useDateFilter && dateFrom && dateTo) {
        config.dateFrom = dateFrom
        config.dateTo = dateTo
      }

      // Llamar al endpoint
      const response = await fetch('/api/admin/backup/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al generar el backup')
      }

      // Obtener información del backup desde los headers
      const backupSize = response.headers.get('X-Backup-Size')
      const backupTables = response.headers.get('X-Backup-Tables')
      
      // Obtener el blob del archivo
      const blob = await response.blob()
      
      // Crear URL temporal para descarga
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Nombre del archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      a.download = `esteticapro_backup_${timestamp}.${format}`
      
      // Simular click para descargar
      document.body.appendChild(a)
      a.click()
      
      // Limpiar
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Mostrar mensaje de éxito
      setSuccess(
        `Backup generado y descargado correctamente. ` +
        `Tamaño: ${backupSize} MB. ` +
        `Tablas incluidas: ${backupTables}.`
      )

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al generar el backup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sistema de Backups</h2>
        <p className="text-gray-600 mt-1">
          Genera y descarga backups completos o selectivos de la base de datos
        </p>
      </div>

      {/* Mensajes de error/éxito */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-red-600 text-xl mr-3">⚠️</span>
            <div className="text-red-800">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-green-600 text-xl mr-3">✅</span>
            <div className="text-green-800">{success}</div>
          </div>
        </div>
      )}

      {/* Formulario principal */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        
        {/* Tipo de backup */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tipo de Backup
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="backupType"
                value="full"
                checked={backupType === 'full'}
                onChange={() => setBackupType('full')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-gray-700">Completo (todas las tablas)</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="backupType"
                value="selective"
                checked={backupType === 'selective'}
                onChange={() => setBackupType('selective')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-gray-700">Selectivo (elegir tablas)</span>
            </label>
          </div>
        </div>

        {/* Selector de tablas (solo en modo selectivo) */}
        {backupType === 'selective' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Seleccionar Tablas
              </label>
              <button
                onClick={handleToggleAllTables}
                disabled={loading || loadingTables}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {selectedTables.length === availableTables.length
                  ? 'Deseleccionar todas'
                  : 'Seleccionar todas'}
              </button>
            </div>
            
            {loadingTables ? (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                <div className="animate-pulse">Cargando tablas disponibles...</div>
              </div>
            ) : availableTables.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-yellow-700">
                No se encontraron tablas disponibles
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                  {availableTables.map(table => (
                    <label key={table} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table)}
                        onChange={() => handleToggleTable(table)}
                        disabled={loading}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">{table}</span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {selectedTables.length} de {availableTables.length} tablas seleccionadas
                </p>
              </>
            )}
          </div>
        )}

        {/* Filtros de fecha */}
        <div>
          <label className="flex items-center cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={useDateFilter}
              onChange={(e) => setUseDateFilter(e.target.checked)}
              disabled={loading}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">
              Filtrar por rango de fechas
            </span>
          </label>
          
          {useDateFilter && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Opciones de contenido */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Contenido a Incluir
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeStructure}
                onChange={(e) => setOptions({...options, includeStructure: e.target.checked})}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Estructura de tablas</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeData}
                onChange={(e) => setOptions({...options, includeData: e.target.checked})}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Datos</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeRLS}
                onChange={(e) => setOptions({...options, includeRLS: e.target.checked})}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Políticas RLS</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeTriggers}
                onChange={(e) => setOptions({...options, includeTriggers: e.target.checked})}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Triggers y funciones</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeIndexes}
                onChange={(e) => setOptions({...options, includeIndexes: e.target.checked})}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Índices</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeExtensions}
                onChange={(e) => setOptions({...options, includeExtensions: e.target.checked})}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Extensiones PostgreSQL</span>
            </label>
          </div>
        </div>

        {/* Formato de salida */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Formato de Salida
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="format"
                value="sql"
                checked={format === 'sql'}
                onChange={() => setFormat('sql')}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-gray-700">SQL (.sql)</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === 'json'}
                onChange={() => setFormat('json')}
                disabled={loading}
                className="mr-2"
              />
              <span className="text-gray-700">JSON (.json)</span>
            </label>
          </div>
        </div>

        {/* Botón de acción */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleGenerateBackup}
            disabled={loading}
            className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando backup...
              </span>
            ) : (
              '💾 Generar y Descargar Backup'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}