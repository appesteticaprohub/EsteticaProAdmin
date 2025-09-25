'use client'

import { useState, useEffect } from 'react'

interface EmailTemplate {
  id: string
  template_key: string
  subject: string
  html_content: string
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

interface TemplateForm {
  template_key: string
  subject: string
  html_content: string
  is_active: boolean
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState<TemplateForm>({
    template_key: '',
    subject: '',
    html_content: '',
    is_active: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('code')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/notifications/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setForm({
      template_key: template.template_key,
      subject: template.subject,
      html_content: template.html_content,
      is_active: template.is_active
    })
    setIsCreating(false)
    setShowEditor(true)
    setPreviewMode('code')
  }

  const handleCreate = () => {
    setSelectedTemplate(null)
    setForm({
      template_key: '',
      subject: '',
      html_content: '',
      is_active: true
    })
    setIsCreating(true)
    setShowEditor(true)
    setPreviewMode('code')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = isCreating 
        ? '/api/admin/notifications/templates'
        : `/api/admin/notifications/templates/${selectedTemplate?.id}`

      const response = await fetch(url, {
        method: isCreating ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      })

      if (response.ok) {
        alert(isCreating ? 'Template creado exitosamente' : 'Template actualizado exitosamente')
        fetchTemplates()
        setShowEditor(false)
        setSelectedTemplate(null)
      } else {
        const error = await response.json()
        alert(`Error: ${error.message}`)
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Error al guardar el template')
    } finally {
      setSaving(false)
    }
  }

  const toggleTemplateStatus = async (template: EmailTemplate) => {
    if (template.is_system) {
      alert('No puedes desactivar templates del sistema')
      return
    }

    try {
      const response = await fetch(`/api/admin/notifications/templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...template,
          is_active: !template.is_active
        })
      })

      if (response.ok) {
        fetchTemplates()
      }
    } catch (error) {
      console.error('Error toggling template status:', error)
    }
  }

  const deleteTemplate = async (template: EmailTemplate) => {
    if (template.is_system) {
      alert('No puedes eliminar templates del sistema')
      return
    }

    const confirmDelete = confirm(`¿Estás seguro de eliminar el template "${template.template_key}"?`)
    if (!confirmDelete) return

    try {
      const response = await fetch(`/api/admin/notifications/templates/${template.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        alert('Template eliminado exitosamente')
        fetchTemplates()
      } else {
        const error = await response.json()
        alert(`Error: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Error al eliminar el template')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTemplateTypeColor = (isSystem: boolean) => {
    return isSystem 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800'
  }

  const getTemplateTypeText = (isSystem: boolean) => {
    return isSystem ? 'Sistema' : 'Personalizado'
  }

  const availableVariables = [
    '{{nombre}}', '{{email}}', '{{precio}}', '{{fecha}}',
    '{{titulo}}', '{{mensaje}}', '{{cta_texto}}', '{{cta_url}}'
  ]

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg border">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Templates</h2>
        <p className="text-gray-600 mt-1">Administra templates de email y notificaciones</p>
      </div>

      {!showEditor ? (
        /* Lista de templates */
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Templates Disponibles</h3>
              <p className="text-sm text-gray-600">{templates.length} templates en total</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Crear Template
            </button>
          </div>

          <div className="grid gap-6">
            {templates.map((template) => (
              <div key={template.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{template.template_key}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTemplateTypeColor(template.is_system)}`}>
                        {getTemplateTypeText(template.is_system)}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {template.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Asunto:</strong> {template.subject}
                    </p>
                    
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Creado: {formatDate(template.created_at)}</p>
                      <p>Actualizado: {formatDate(template.updated_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleTemplateStatus(template)}
                      disabled={template.is_system}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        template.is_system
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : template.is_active
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {template.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    
                    <button
                      onClick={() => handleEdit(template)}
                      disabled={template.is_system}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        template.is_system
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                    >
                      {template.is_system ? 'Ver' : 'Editar'}
                    </button>
                    
                    {!template.is_system && (
                      <button
                        onClick={() => deleteTemplate(template)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-gray-500">No hay templates disponibles</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Editor de template */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isCreating ? 'Crear Nuevo Template' : `Editando: ${selectedTemplate?.template_key}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clave del Template *
                    </label>
                    <input
                      type="text"
                      value={form.template_key}
                      onChange={(e) => setForm({ ...form, template_key: e.target.value })}
                      disabled={!isCreating}
                      placeholder="ej: mi_template_personalizado"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                      required
                    />
                    {!isCreating && (
                      <p className="text-xs text-gray-500 mt-1">
                        La clave no se puede modificar
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Asunto *
                    </label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      disabled={selectedTemplate?.is_system}
                      placeholder="Asunto del email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Contenido HTML *
                      </label>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setPreviewMode('code')}
                          className={`px-3 py-1 text-sm rounded ${
                            previewMode === 'code'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Código
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('preview')}
                          className={`px-3 py-1 text-sm rounded ${
                            previewMode === 'preview'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {previewMode === 'code' ? (
                      <textarea
                        value={form.html_content}
                        onChange={(e) => setForm({ ...form, html_content: e.target.value })}
                        disabled={selectedTemplate?.is_system}
                        placeholder="<h1>Hola {{nombre}}</h1><p>Tu mensaje aquí...</p>"
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm disabled:bg-gray-50"
                        required
                      />
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-4 min-h-48 bg-white">
                        <div dangerouslySetInnerHTML={{ 
                          __html: form.html_content.replace(/\{\{(\w+)\}\}/g, '<span class="bg-yellow-100 px-1 rounded">{{$1}}</span>')
                        }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      disabled={selectedTemplate?.is_system}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                      Template activo
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  
                  {!selectedTemplate?.is_system && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Guardando...' : (isCreating ? 'Crear Template' : 'Guardar Cambios')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Panel lateral */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Variables Disponibles</h3>
              <div className="space-y-2">
                {availableVariables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => {
                      const newContent = form.html_content + variable
                      setForm({ ...form, html_content: newContent })
                    }}
                    disabled={selectedTemplate?.is_system}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ayuda</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Variables:</strong> Se reemplazan automáticamente con datos reales</p>
                <p><strong>HTML:</strong> Puedes usar HTML completo para el diseño</p>
                <p><strong>Templates del sistema:</strong> Solo lectura, no se pueden modificar</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}