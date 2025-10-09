'use client'

import { useState, useEffect } from 'react'

export default function AnonymousLimitSettings() {
  const [limit, setLimit] = useState<number>(1)
  const [newLimit, setNewLimit] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar límite actual
  useEffect(() => {
    fetchLimit()
  }, [])

  const fetchLimit = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/anonymous-limit')
      const result = await response.json()

      if (result.error) {
        setError(result.error)
      } else {
        setLimit(result.data.limit)
        setNewLimit(result.data.limit)
      }
    } catch (error) {
      console.error('Error cargando límite:', error)
      setError('Error al cargar límite')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (newLimit < 0 || newLimit > 100) {
      setError('El límite debe estar entre 0 y 100')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/admin/anonymous-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: newLimit })
      })

      const result = await response.json()

      if (result.error) {
        setError(result.error)
      } else {
        setLimit(newLimit)
      }
    } catch (error) {
      console.error('Error guardando límite:', error)
      setError('Error al guardar límite')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setNewLimit(limit)
    setError(null)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-32 mb-6"></div>
              <div className="h-10 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasChanges = newLimit !== limit

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Límite de Posts para Usuarios Anónimos</h1>
          <p className="text-gray-600 mt-2">
            Configura cuántos posts puede ver un usuario sin registro antes de requerir suscripción
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Panel izquierdo - Configuración */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Límite de Posts Gratuitos
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newLimit}
                    onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-600">posts</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Valor entre 0 y 100. Si es 0, los usuarios anónimos no podrán ver ningún post completo.
                </p>

                {/* Botones de acción */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      saving || !hasChanges
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  
                  {hasChanges && (
                    <button
                      onClick={handleReset}
                      disabled={saving}
                      className="px-6 py-2 rounded-lg font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Panel derecho - Información */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <span>ℹ️</span>
                  ¿Cómo funciona?
                </h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>Los usuarios sin registro pueden ver <strong>{limit} {limit === 1 ? 'post completo' : 'posts completos'}</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>Después del límite, verán contenido truncado con CTA de suscripción</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>El límite es permanente (cookie de 1 año) para obligar la suscripción</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>Los cambios se aplican inmediatamente en la app de usuarios</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}