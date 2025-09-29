'use client'

import { useState, useEffect } from 'react'

interface BroadcastForm {
  type: 'email' | 'in_app' | 'both'
  audience: 'all' | 'active' | 'inactive' | 'by_country' | 'by_specialty'
  country?: string
  specialty?: string
  priority: 'normal' | 'important' | 'critical' | 'promotional'
  title: string
  message: string
  cta_text?: string
  cta_url?: string
}

interface AudiencePreview {
  count: number
  recipients: string[]
}

export default function BroadcastComposer() {
  const [form, setForm] = useState<BroadcastForm>({
    type: 'both',
    audience: 'all',
    priority: 'normal',
    title: '',
    message: ''
  })
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Obtener preview de audiencia cuando cambian los filtros
  useEffect(() => {
    if (form.audience) {
      fetchAudiencePreview()
    }
  }, [form.audience, form.country, form.specialty])

  const fetchAudiencePreview = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        audience_type: form.audience
      })

      if (form.country) {
        params.append('audience_filter', form.country)
      } else if (form.specialty) {
        params.append('audience_filter', form.specialty)
      }

      const response = await fetch(`/api/admin/notifications/broadcast?${params}`)
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        setAudiencePreview({
          count: data.count || 0,
          recipients: []
        })
      }
    } catch (error) {
      console.error('Error fetching audience preview:', error)
    } finally {
      setLoading(false)
    }
  }

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.message) return

    setSending(true)
    try {
      // Adaptar el formato al que espera el API
      const payload = {
        type: form.type,
        category: form.priority, // priority -> category
        title: form.title,
        message: form.message,
        cta_text: form.cta_text,
        cta_url: form.cta_url,
        audience: {
          type: form.audience,
          filter: form.country || form.specialty || undefined
        }
      }

      const response = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        alert(`¡Broadcast enviado exitosamente!\n\nEmails: ${data.email_count || 0}\nNotificaciones: ${data.notification_count || 0}`)
        
        // Limpiar formulario
        setForm({
          type: 'both',
          audience: 'all',
          priority: 'normal',
          title: '',
          message: ''
        })
        setShowPreview(false)
      } else {
        const error = await response.json()
        alert(`Error al enviar: ${error.error || error.message}`)
      }
    } catch (error) {
      console.error('Error sending broadcast:', error)
      alert('Error al enviar el broadcast')
    } finally {
      setSending(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'important': return 'bg-orange-100 text-orange-800'
      case 'promotional': return 'bg-purple-100 text-purple-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return '🚨'
      case 'important': return '⚠️'
      case 'promotional': return '🎉'
      default: return '📢'
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Broadcast Masivo</h2>
        <p className="text-gray-600 mt-1">Envía notificaciones masivas a usuarios segmentados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario principal */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración del Broadcast</h3>
              
              {/* Tipo de envío */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Envío
                </label>
                <div className="flex space-x-4">
                  {[
                    { value: 'email', label: 'Solo Email', icon: '📧' },
                    { value: 'in_app', label: 'Solo In-App', icon: '🔔' },
                    { value: 'both', label: 'Ambos', icon: '📱' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value={option.value}
                        checked={form.type === option.value}
                        onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                        className="mr-2"
                      />
                      <span className="mr-1">{option.icon}</span>
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Audiencia */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audiencia
                </label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los usuarios</option>
                  <option value="active">Suscripciones activas</option>
                  <option value="inactive">Suscripciones inactivas</option>
                  <option value="by_country">Por país</option>
                  <option value="by_specialty">Por especialidad</option>
                </select>
              </div>

              {/* Filtros adicionales */}
              {form.audience === 'by_country' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    País
                  </label>
                  <input
                    type="text"
                    value={form.country || ''}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="Ej: Colombia, México, España"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {form.audience === 'by_specialty' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Especialidad
                  </label>
                  <input
                    type="text"
                    value={form.specialty || ''}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    placeholder="Ej: Dermatología, Cirugía Plástica"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Prioridad */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridad
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Importante</option>
                  <option value="critical">Crítica</option>
                  <option value="promotional">Promocional</option>
                </select>
              </div>
            </div>

            {/* Contenido */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contenido del Mensaje</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título de la notificación"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje *
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Contenido del mensaje"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto del Botón (opcional)
                  </label>
                  <input
                    type="text"
                    value={form.cta_text || ''}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    placeholder="Ej: Ver más, Ir al sitio"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL del Botón (opcional)
                  </label>
                  <input
                    type="url"
                    value={form.cta_url || ''}
                    onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                    placeholder="https://ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {showPreview ? 'Ocultar' : 'Ver'} Preview
              </button>
              
              <button
                type="submit"
                disabled={sending || !form.title || !form.message}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Enviando...' : 'Enviar Broadcast'}
              </button>
            </div>
          </form>
        </div>

        {/* Panel lateral - Audiencia y Preview */}
        <div className="space-y-6">
          {/* Preview de audiencia */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Audiencia</h3>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ) : audiencePreview ? (
              <div>
                <p className="text-2xl font-bold text-blue-600 mb-2">
                  {audiencePreview.count}
                </p>
                <p className="text-sm text-gray-600 mb-4">usuarios recibirán este broadcast</p>
                {audiencePreview.recipients.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Primeros destinatarios:</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      {audiencePreview.recipients.slice(0, 5).map((email, index) => (
                        <div key={index} className="truncate">{email}</div>
                      ))}
                      {audiencePreview.recipients.length > 5 && (
                        <div className="text-gray-400">
                          +{audiencePreview.recipients.length - 5} más...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Selecciona una audiencia</p>
            )}
          </div>

          {/* Preview del mensaje */}
          {showPreview && form.title && form.message && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
              
              <div className={`p-4 rounded-lg border-l-4 ${
                form.priority === 'critical' ? 'border-red-500 bg-red-50' :
                form.priority === 'important' ? 'border-orange-500 bg-orange-50' :
                form.priority === 'promotional' ? 'border-purple-500 bg-purple-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">{getPriorityIcon(form.priority)}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(form.priority)}`}>
                    {form.priority}
                  </span>
                </div>
                
                <h4 className="font-semibold text-gray-900 mb-2">{form.title}</h4>
                <p className="text-gray-700 mb-3">{form.message}</p>
                
                {form.cta_text && form.cta_url && (
                  <a
                    href={form.cta_url}
                    className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {form.cta_text}
                  </a>
                )}
              </div>
              
              <div className="mt-4 text-xs text-gray-500">
                <p>Canales: {
                  form.type === 'both' ? 'Email + In-App' :
                  form.type === 'email' ? 'Solo Email' :
                  'Solo In-App'
                }</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}