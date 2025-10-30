'use client'

import { useState, useEffect, useCallback } from 'react'

interface EmailTemplate {
  id: string
  template_key: string
  subject: string
  html_content: string
  is_active: boolean
  is_system: boolean
  created_at: string
}

interface BroadcastForm {
  type: 'email' | 'in_app' | 'both'
  audience: 'all' | 'active' | 'inactive' | 'by_country' | 'by_specialty' | 'by_email_list'
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
  const [showPreview, setShowPreview] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadingTemplateContent, setLoadingTemplateContent] = useState(false)
  const [useTemplate, setUseTemplate] = useState(false)
  const [emailContent, setEmailContent] = useState('')
  const [inAppMessage, setInAppMessage] = useState('')
  const [emailList, setEmailList] = useState('')

  // Estados para el sistema de bloques
  const [audienceCalculated, setAudienceCalculated] = useState(false)
  const [totalRecipients, setTotalRecipients] = useState(0)
  
  // Estados para notificaciones in-app
  const [inAppBatchSize, setInAppBatchSize] = useState(100)
  const [inAppSentCount, setInAppSentCount] = useState(0)
  const [inAppFailedCount, setInAppFailedCount] = useState(0)
  const [inAppCurrentOffset, setInAppCurrentOffset] = useState(0)
  const [hasMoreInApp, setHasMoreInApp] = useState(false)
  const [sendingInApp, setSendingInApp] = useState(false)
  const [inAppCompleted, setInAppCompleted] = useState(false)

  // Estados para emails
  const [emailBatchSize, setEmailBatchSize] = useState(100)
  const [emailSentCount, setEmailSentCount] = useState(0)
  const [emailFailedCount, setEmailFailedCount] = useState(0)
  const [emailCurrentOffset, setEmailCurrentOffset] = useState(0)
  const [hasMoreEmails, setHasMoreEmails] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailCompleted, setEmailCompleted] = useState(false)

  const loadTemplate = useCallback(async (templateId: string) => {
    if (!templateId) return
    
    setLoadingTemplateContent(true)
    try {
      const response = await fetch(`/api/admin/notifications/templates/${templateId}`)
      if (response.ok) {
        const result = await response.json()
        const template = result.data
        
        if (template) {
          setEmailContent(template.html_content || '')
          setForm((prevForm) => ({
            ...prevForm,
            title: template.subject || prevForm.title
          }))
        }
      }
    } catch (error) {
      console.error('Error loading template:', error)
    } finally {
      setLoadingTemplateContent(false)
    }
  }, [])

  const fetchAudiencePreview = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        audience_type: form.audience
      })

      if (form.country) {
        params.append('audience_filter', form.country)
      } else if (form.specialty) {
        params.append('audience_filter', form.specialty)
      } else if (form.audience === 'by_email_list' && emailList.trim()) {
        const emails = emailList
          .split(/[\n,]/)
          .map(e => e.trim())
          .filter(e => e.length > 0)
        
        if (emails.length > 0) {
          params.append('email_list', emails.join(','))
        }
      }

      const response = await fetch(`/api/admin/notifications/broadcast/count?${params}`)
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
  }, [form.audience, form.country, form.specialty, emailList])

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const response = await fetch('/api/admin/notifications/templates')
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        const activeTemplates = (data.templates || []).filter((t: EmailTemplate) => t.is_active)
        setTemplates(activeTemplates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (selectedTemplate && useTemplate) {
      loadTemplate(selectedTemplate)
    }
  }, [selectedTemplate, useTemplate, loadTemplate])

  useEffect(() => {
    if (form.audience) {
      fetchAudiencePreview()
    }
  }, [form.audience, fetchAudiencePreview])

  // PASO 1: Calcular audiencia
  const handleCalculateAudience = async () => {
    if (!form.title) {
      alert('El título es requerido')
      return
    }

    if ((form.type === 'in_app' || form.type === 'both') && !inAppMessage) {
      alert('El mensaje para notificación in-app es requerido')
      return
    }

    if ((form.type === 'email' || form.type === 'both') && !useTemplate && !form.message) {
      alert('El mensaje para email es requerido o selecciona un template')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        audience_type: form.audience
      })

      if (form.country) {
        params.append('audience_filter', form.country)
      } else if (form.specialty) {
        params.append('audience_filter', form.specialty)
      } else if (form.audience === 'by_email_list' && emailList.trim()) {
        const emails = emailList
          .split(/[\n,]/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'))
        
        if (emails.length === 0) {
          alert('Por favor ingresa al menos un email válido')
          return
        }
        
        params.append('email_list', emails.join(','))
      }

      const response = await fetch(`/api/admin/notifications/broadcast/count?${params}`)
      if (response.ok) {
        const result = await response.json()
        const count = result.data?.count || 0
        
        if (count === 0) {
          alert('No se encontraron destinatarios con los filtros seleccionados')
          return
        }

        setTotalRecipients(count)
        setAudienceCalculated(true)
        
        // Inicializar estados según el tipo
        if (form.type === 'in_app' || form.type === 'both') {
          setHasMoreInApp(count > 0)
        }
        if (form.type === 'email' || form.type === 'both') {
          setHasMoreEmails(count > 0)
        }
        
        alert(`✅ Audiencia calculada: ${count} destinatarios`)
      }
    } catch (error) {
      console.error('Error calculando audiencia:', error)
      alert('Error al calcular audiencia')
    } finally {
      setLoading(false)
    }
  }

  // PASO 2: Enviar bloque de notificaciones in-app
  const sendInAppBatch = async () => {
    setSendingInApp(true)
    try {
      let parsedEmailList: string[] | undefined = undefined
      if (form.audience === 'by_email_list' && emailList.trim()) {
        parsedEmailList = emailList
          .split(/[\n,]/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'))
      }

      const payload = {
        title: form.title,
        message: inAppMessage || form.message,
        category: form.priority,
        cta_text: form.cta_text,
        cta_url: form.cta_url,
        audience: {
          type: form.audience,
          filter: form.country || form.specialty || undefined,
          email_list: parsedEmailList
        },
        batch_size: inAppBatchSize,
        offset: inAppCurrentOffset
      }

      const response = await fetch('/api/admin/notifications/broadcast/send-inapp-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        const data = result.data

        setInAppSentCount(prev => prev + data.created)
        setInAppFailedCount(prev => prev + data.failed)
        setHasMoreInApp(data.has_more)
        setInAppCurrentOffset(data.next_offset)

        if (!data.has_more) {
          setInAppCompleted(true)
          alert(`✅ Notificaciones in-app completadas!\nEnviadas: ${inAppSentCount + data.created}\nFallidas: ${inAppFailedCount + data.failed}`)
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error enviando notificaciones in-app:', error)
      alert('Error al enviar notificaciones in-app')
    } finally {
      setSendingInApp(false)
    }
  }

  // PASO 3: Enviar bloque de emails
  const sendEmailBatch = async () => {
    setSendingEmail(true)
    try {
      const selectedTemplateData = selectedTemplate 
        ? templates.find(t => t.id === selectedTemplate)
        : null

      let parsedEmailList: string[] | undefined = undefined
      if (form.audience === 'by_email_list' && emailList.trim()) {
        parsedEmailList = emailList
          .split(/[\n,]/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'))
      }

      const payload = {
        title: form.title,
        message: form.message,
        email_content: useTemplate && emailContent ? emailContent : form.message,
        category: form.priority,
        template_key: selectedTemplateData?.template_key || undefined,
        template_id: selectedTemplate || undefined,
        cta_text: form.cta_text,
        cta_url: form.cta_url,
        audience: {
          type: form.audience,
          filter: form.country || form.specialty || undefined,
          email_list: parsedEmailList
        },
        batch_size: emailBatchSize,
        offset: emailCurrentOffset
      }

      const response = await fetch('/api/admin/notifications/broadcast/send-email-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        const data = result.data

        setEmailSentCount(prev => prev + data.emails_sent)
        setEmailFailedCount(prev => prev + data.emails_failed)
        setHasMoreEmails(data.has_more)
        setEmailCurrentOffset(data.next_offset)

        if (!data.has_more) {
          setEmailCompleted(true)
          alert(`✅ Emails completados!\nEnviados: ${emailSentCount + data.emails_sent}\nFallidos: ${emailFailedCount + data.emails_failed}`)
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error enviando emails:', error)
      alert('Error al enviar emails')
    } finally {
      setSendingEmail(false)
    }
  }

  // Resetear todo el broadcast
  const resetBroadcast = () => {
    setAudienceCalculated(false)
    setTotalRecipients(0)
    setInAppSentCount(0)
    setInAppFailedCount(0)
    setInAppCurrentOffset(0)
    setHasMoreInApp(false)
    setInAppCompleted(false)
    setEmailSentCount(0)
    setEmailFailedCount(0)
    setEmailCurrentOffset(0)
    setHasMoreEmails(false)
    setEmailCompleted(false)
    setForm({
      type: 'both',
      audience: 'all',
      priority: 'normal',
      title: '',
      message: ''
    })
    setInAppMessage('')
    setEmailList('')
    setEmailContent('')
    setSelectedTemplate('')
    setUseTemplate(false)
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
        <p className="text-gray-600 mt-1">Envía notificaciones masivas a usuarios segmentados por bloques</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario principal */}
        <div className="lg:col-span-2 space-y-6">
          {!audienceCalculated ? (
            <>
              {/* PASO 1: Configuración */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">PASO 1: Configuración del Broadcast</h3>
                
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
                          onChange={(e) => setForm({ ...form, type: e.target.value as 'email' | 'in_app' | 'both' })}
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
                    <option value="by_email_list">Usuarios específicos (por email)</option>
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

                {form.audience === 'by_email_list' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lista de Emails
                    </label>
                    <textarea
                      value={emailList}
                      onChange={(e) => setEmailList(e.target.value)}
                      placeholder="usuario1@ejemplo.com, usuario2@ejemplo.com&#10;usuario3@ejemplo.com"
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Separa los emails por comas o saltos de línea
                    </p>
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
                
                {/* Selector de templates */}
                {(form.type === 'email' || form.type === 'both') && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id="useTemplate"
                        checked={useTemplate}
                        onChange={(e) => {
                          setUseTemplate(e.target.checked)
                          if (!e.target.checked) {
                            setSelectedTemplate('')
                            setEmailContent('')
                          }
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="useTemplate" className="text-sm font-medium text-gray-700">
                        📋 Usar Template de Email (Opcional)
                      </label>
                    </div>
                    
                    {useTemplate && (
                      <>
                        <select
                          value={selectedTemplate}
                          onChange={(e) => setSelectedTemplate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={loadingTemplates || loadingTemplateContent}
                        >
                          <option value="">Seleccionar template...</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.template_key} - {template.subject}
                            </option>
                          ))}
                        </select>
                        {loadingTemplateContent && (
                          <p className="text-xs text-blue-600 mt-2">Cargando template...</p>
                        )}
                      </>
                    )}
                  </div>
                )}
                
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

                {/* Mensaje para In-App */}
                {(form.type === 'in_app' || form.type === 'both') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensaje para Notificación In-App *
                    </label>
                    <textarea
                      value={inAppMessage}
                      onChange={(e) => setInAppMessage(e.target.value)}
                      placeholder="Mensaje que aparecerá en las notificaciones dentro de la app"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                )}

                {/* Mensaje para Email */}
                {(form.type === 'email' || form.type === 'both') && !useTemplate && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensaje para Email *
                    </label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Contenido del email"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                )}

                {/* Preview del template si está usando uno */}
                {(form.type === 'email' || form.type === 'both') && useTemplate && emailContent && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preview del Template de Email
                    </label>
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                      <div 
                        dangerouslySetInnerHTML={{ __html: emailContent }}
                        className="prose prose-sm max-w-none"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Este es el contenido del template que se enviará por email
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Texto del Botón (opcional)
                    </label>
                    <input
                      type="text"
                      value={form.cta_text || ''}
                      onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                      placeholder="Ej: Ver más"
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

              {/* Botón calcular */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {showPreview ? 'Ocultar' : 'Ver'} Preview
                </button>
                
                <button
                  type="button"
                  onClick={handleCalculateAudience}
                  disabled={loading || !form.title}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Calculando...' : '📊 Calcular Destinatarios'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* PASO 2: Envío por bloques de Notificaciones In-App */}
              {(form.type === 'in_app' || form.type === 'both') && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📲 Envío de Notificaciones In-App por Bloques
                  </h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tamaño de Bloque
                    </label>
                    <select
                      value={inAppBatchSize}
                      onChange={(e) => setInAppBatchSize(Number(e.target.value))}
                      disabled={inAppSentCount > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={5}>5 usuarios</option>
                      <option value={50}>50 usuarios</option>
                      <option value={100}>100 usuarios</option>
                      <option value={200}>200 usuarios</option>
                      <option value={500}>500 usuarios</option>
                    </select>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progreso</span>
                      <span className="font-semibold">
                        {inAppSentCount} / {totalRecipients}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${(inAppSentCount / totalRecipients) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {Math.round((inAppSentCount / totalRecipients) * 100)}%
                    </div>
                  </div>

                  {/* Estadísticas */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-700 font-medium">Creadas</p>
                      <p className="text-2xl font-bold text-green-900">{inAppSentCount}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-700 font-medium">Fallidas</p>
                      <p className="text-2xl font-bold text-red-900">{inAppFailedCount}</p>
                    </div>
                  </div>

                  {/* Botones */}
                  {!inAppCompleted && hasMoreInApp && (
                    <button
                      type="button"
                      onClick={sendInAppBatch}
                      disabled={sendingInApp}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingInApp ? 'Enviando...' : `📲 Enviar Siguiente Bloque (${inAppBatchSize})`}
                    </button>
                  )}

                  {inAppCompleted && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                      ✅ Notificaciones In-App Completadas
                    </div>
                  )}
                </div>
              )}

              {/* PASO 3: Envío por bloques de Emails */}
              {(form.type === 'email' || form.type === 'both') && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📧 Envío de Emails por Bloques
                  </h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tamaño de Bloque
                    </label>
                    <select
                      value={emailBatchSize}
                      onChange={(e) => setEmailBatchSize(Number(e.target.value))}
                      disabled={emailSentCount > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={5}>5 usuarios</option>
                      <option value={50}>50 usuarios</option>
                      <option value={100}>100 usuarios</option>
                      <option value={200}>200 usuarios</option>
                      <option value={500}>500 usuarios</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ Rate limit: 600ms entre cada email
                    </p>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progreso</span>
                      <span className="font-semibold">
                        {emailSentCount} / {totalRecipients}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-green-600 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${(emailSentCount / totalRecipients) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {Math.round((emailSentCount / totalRecipients) * 100)}%
                    </div>
                  </div>

                  {/* Estadísticas */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-700 font-medium">Enviados</p>
                      <p className="text-2xl font-bold text-green-900">{emailSentCount}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-700 font-medium">Fallidos</p>
                      <p className="text-2xl font-bold text-red-900">{emailFailedCount}</p>
                    </div>
                  </div>

                  {/* Botones */}
                  {!emailCompleted && hasMoreEmails && (
                    <button
                      type="button"
                      onClick={sendEmailBatch}
                      disabled={sendingEmail}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingEmail ? 'Enviando...' : `📧 Enviar Siguiente Bloque (${emailBatchSize})`}
                    </button>
                  )}

                  {emailCompleted && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                      ✅ Emails Completados
                    </div>
                  )}
                </div>
              )}

              {/* Botón resetear */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={resetBroadcast}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  🔄 Preparar Nuevo Broadcast
                </button>
              </div>
            </>
          )}
        </div>

        {/* Panel lateral */}
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
                <p className="text-sm text-gray-600">destinatarios</p>
              </div>
            ) : (
              <p className="text-gray-500">Selecciona una audiencia</p>
            )}
          </div>

          {/* Preview del mensaje */}
          {showPreview && form.title && (
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
                <div className="text-gray-700 text-sm">
                  {inAppMessage || form.message}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}