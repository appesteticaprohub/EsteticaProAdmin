'use client'

import { useState, useEffect } from 'react'
import type { ImageSettings } from '@/types/admin'

export default function ImageSettingsPanel() {
  const [settings, setSettings] = useState<Partial<ImageSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Cargar configuración actual
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/image-settings')
      const data = await response.json()
      
      if (data.data) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setMessage({ type: 'error', text: 'Error al cargar configuración' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch('/api/admin/image-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Error al guardar configuración' })
    } finally {
      setSaving(false)
    }
  }

  const handleFormatToggle = (format: string) => {
    const currentFormats = settings.allowed_formats || []
    const newFormats = currentFormats.includes(format)
      ? currentFormats.filter(f => f !== format)
      : [...currentFormats, format]
    
    setSettings({ ...settings, allowed_formats: newFormats })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Imágenes</h2>
        <p className="text-gray-600 mt-1">Gestiona los límites y restricciones para la subida de imágenes</p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">💡 Nota:</span> Los cambios en la configuración de imágenes se reflejan en la aplicación de usuarios en un plazo máximo de 24 horas.
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Número máximo de imágenes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Número máximo de imágenes por post
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={settings.max_images_per_post || 3}
            onChange={(e) => setSettings({ ...settings, max_images_per_post: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">Entre 1 y 10 imágenes</p>
        </div>

        {/* Tamaño máximo por imagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamaño máximo por imagen (MB)
          </label>
          <input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={settings.max_image_size_mb || 2}
            onChange={(e) => setSettings({ ...settings, max_image_size_mb: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">Entre 0.5 y 10 MB</p>
        </div>

        {/* Calidad de compresión */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Calidad de compresión
          </label>
          <input
            type="number"
            min="0.1"
            max="1"
            step="0.1"
            value={settings.compression_quality || 0.8}
            onChange={(e) => setSettings({ ...settings, compression_quality: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">Entre 0.1 (baja calidad) y 1.0 (alta calidad)</p>
        </div>

        {/* Dimensiones máximas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ancho máximo (px)
            </label>
            <input
              type="number"
              min="500"
              max="4000"
              step="100"
              value={settings.max_width || 1920}
              onChange={(e) => setSettings({ ...settings, max_width: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alto máximo (px)
            </label>
            <input
              type="number"
              min="500"
              max="4000"
              step="100"
              value={settings.max_height || 1920}
              onChange={(e) => setSettings({ ...settings, max_height: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 -mt-4">Entre 500 y 4000 píxeles</p>

        {/* Formatos permitidos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Formatos permitidos
          </label>
          <div className="space-y-2">
            {['image/jpeg', 'image/png', 'image/webp'].map((format) => (
              <label key={format} className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allowed_formats?.includes(format) || false}
                  onChange={() => handleFormatToggle(format)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {format.replace('image/', '').toUpperCase()}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Botón guardar */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}