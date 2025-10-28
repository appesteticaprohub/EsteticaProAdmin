'use client'

import { useState, useEffect, useCallback } from 'react'

interface Post {
  id: string
  title: string
  content: string
  author_name: string
  created_at: string
  views_count: number
  likes_count: number
  comments_count: number
}

interface NewsletterSettings {
  id: string
  is_enabled: boolean
  last_sent_at: string | null
  posts_to_include: number
  subscriber_count?: number
}

export default function NewsletterPanel() {
  const [settings, setSettings] = useState<NewsletterSettings | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [totalRecipients, setTotalRecipients] = useState<number>(0)
  const [batchSize, setBatchSize] = useState<number>(100)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('all')
  const [currentOffset, setCurrentOffset] = useState<number>(0)
  const [sentCount, setSentCount] = useState<number>(0)
  const [failedCount, setFailedCount] = useState<number>(0)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [hasMoreToSend, setHasMoreToSend] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/newsletter/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.data || data)
      }
    } catch (error) {
      console.error('Error fetching newsletter settings:', error)
    }
  }

  const fetchRecipientsCount = async () => {
    try {
      const url = subscriptionStatus === 'all' 
        ? '/api/admin/newsletter/subscribers-count'
        : `/api/admin/newsletter/subscribers-count?subscription_status=${subscriptionStatus}`;
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok) {
        setTotalRecipients(data.count || 0)
      } else {
        alert('Error al obtener conteo de destinatarios')
      }
    } catch (error) {
      console.error('Error fetching recipients count:', error)
      alert('Error al obtener conteo de destinatarios')
    }
  }

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/admin/newsletter/posts')
      if (response.ok) {
        const data = await response.json()
        console.log('📰 Newsletter Posts Response:', data)
        console.log('📰 Data.data:', data.data)
        console.log('📰 Data.posts:', data.posts)
        
        const postsData = data.data || data.posts || []
        console.log('📰 Posts finales:', postsData)
        
        setPosts(postsData)
        // Auto-seleccionar los primeros 5 posts
        const firstFive = postsData.slice(0, 5).map((p: Post) => p.id)
        setSelectedPosts(firstFive)
      } else {
        console.error('❌ Error response:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
    fetchSettings()
    fetchRecipientsCount()
  }, [])

  useEffect(() => {
    fetchRecipientsCount()
  }, [subscriptionStatus])


  const handlePostToggle = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    )
  }

  const selectAll = () => {
    setSelectedPosts(posts.map(p => p.id))
  }

  const selectNone = () => {
    setSelectedPosts([])
  }

  const sendNewsletter = async () => {
    if (selectedPosts.length === 0) {
      alert('Selecciona al menos un post para enviar')
      return
    }

    // Solo confirmar al inicio
    if (currentOffset === 0) {
      const confirmSend = confirm(
        `¿Estás seguro de enviar la newsletter?\n\n` +
        `Posts seleccionados: ${selectedPosts.length}\n` +
        `Destinatarios totales: ${totalRecipients} usuarios\n` +
        `Tamaño de bloque: ${batchSize} emails\n\n` +
        `Podrás enviar bloque por bloque manualmente.`
      )

      if (!confirmSend) return
    }

    setIsSending(true)
    setSending(true)

    try {
      const response = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_ids: selectedPosts,
          batchSize: batchSize,
          offset: currentOffset,
          subscriptionStatus: subscriptionStatus
        })
      })

      if (response.ok) {
        const result = await response.json()
        const data = result.data || result

        // Actualizar contadores
        setSentCount(prev => prev + (data.emails_sent || 0))
        setFailedCount(prev => prev + (data.emails_failed || 0))
        setCurrentOffset(data.nextOffset || 0)
        setHasMoreToSend(data.hasMore || false)

        if (data.hasMore) {
          alert(`✅ Bloque enviado correctamente!\n\n` +
                `Exitosos: ${data.emails_sent || 0}\n` +
                `Fallidos: ${data.emails_failed || 0}\n\n` +
                `Progreso: ${sentCount + (data.emails_sent || 0)} / ${totalRecipients}`)
        } else {
          alert(`🎉 ¡Newsletter completada!\n\n` +
                `Total enviados: ${sentCount + (data.emails_sent || 0)}\n` +
                `Total fallidos: ${failedCount + (data.emails_failed || 0)}`)
          
          // Actualizar configuración
          fetchSettings()
        }
      } else {
        const error = await response.json()
        alert(`Error al enviar newsletter: ${error.error || error.message}`)
      }
    } catch (error) {
      console.error('Error sending newsletter:', error)
      alert('Error al enviar la newsletter')
    } finally {
      setIsSending(false)
      setSending(false)
    }
  }

  const resetSending = () => {
    setCurrentOffset(0)
    setSentCount(0)
    setFailedCount(0)
    setHasMoreToSend(true)
    setSelectedPosts([])
    alert('✅ Listo para nuevo envío')
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Nunca'
    
    // Crear objeto Date desde el string UTC
    const date = new Date(dateString)
    
    // Obtener componentes UTC y restar 5 horas manualmente para Colombia
    let utcHours = date.getUTCHours()
    const utcMinutes = date.getUTCMinutes()
    let utcDay = date.getUTCDate()
    let utcMonth = date.getUTCMonth() + 1
    let utcYear = date.getUTCFullYear()
    
    // Restar 5 horas
    utcHours -= 5
    
    // Ajustar si las horas son negativas (día anterior)
    if (utcHours < 0) {
      utcHours += 24
      utcDay -= 1
      
      // Ajustar el mes si es necesario
      if (utcDay < 1) {
        utcMonth -= 1
        if (utcMonth < 1) {
          utcMonth = 12
          utcYear -= 1
        }
        // Días del mes anterior (simplificado)
        const daysInMonth = new Date(utcYear, utcMonth, 0).getDate()
        utcDay = daysInMonth
      }
    }
    
    const day = String(utcDay).padStart(2, '0')
    const month = String(utcMonth).padStart(2, '0')
    const year = utcYear
    const minutes = String(utcMinutes).padStart(2, '0')
    const ampm = utcHours >= 12 ? 'p. m.' : 'a. m.'
    const hours12 = utcHours % 12 || 12
    
    return `${day}/${month}/${year}, ${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`
  }

  const stripHtml = (html: string): string => {
    // Crear un elemento temporal en el DOM para parsear el HTML
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    
    // Obtener solo el texto, esto automáticamente elimina todas las etiquetas
    const text = tmp.textContent || tmp.innerText || ''
    
    // Limpiar espacios múltiples y saltos de línea
    return text.replace(/\s+/g, ' ').trim()
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    // Primero limpiar el HTML
    const plainText = stripHtml(content)
    
    // Luego truncar
    if (plainText.length <= maxLength) return plainText
    return plainText.substring(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-lg border">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Newsletter Manual</h2>
        <p className="text-gray-600 mt-1">Control total sobre el envío de newsletter con posts seleccionados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de posts */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Posts Disponibles ({posts.length})
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Seleccionar Todo
                  </button>
                  <button
                    onClick={selectNone}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedPosts.length} posts seleccionados para la newsletter
              </p>
            </div>

            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {posts.map((post) => (
                <label
                  key={post.id}
                  className={`flex items-start space-x-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedPosts.includes(post.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPosts.includes(post.id)}
                    onChange={() => handlePostToggle(post.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {post.title}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      {truncateContent(post.content)}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span>Por {post.author_name}</span>
                      <span>{formatDate(post.created_at)}</span>
                      <span>👁️ {post.views_count}</span>
                      <span>❤️ {post.likes_count}</span>
                      <span>💬 {post.comments_count}</span>
                    </div>
                  </div>
                </label>
              ))}

              {posts.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-4">📝</div>
                  <p>No hay posts disponibles para la newsletter</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel de control */}
        <div className="space-y-6">
          {/* Información del newsletter */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información</h3>
            
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Último envío:</span>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(settings?.last_sent_at || null)}
                </p>
              </div>
            </div>
          </div>

          {/* Control de Envío por Bloques */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Control de Envío</h3>
            
            <div className="space-y-4">
              {/* Estadísticas */}
              <div className="space-y-3">
                {/* Filtro de Subscription Status */}
                <div className="bg-purple-50 p-3 rounded-lg">
                  <label className="text-xs text-gray-600 block mb-1">
                    Filtrar por Estado de Suscripción
                  </label>
                  <select
                    value={subscriptionStatus}
                    onChange={(e) => {
                      setSubscriptionStatus(e.target.value)
                      // Resetear progreso si cambia el filtro
                      setCurrentOffset(0)
                      setSentCount(0)
                      setFailedCount(0)
                      setHasMoreToSend(true)
                    }}
                    disabled={isSending || sentCount > 0}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Todos los usuarios</option>
                    <option value="Active">Active (Activos)</option>
                    <option value="GracePeriod">Grace Period (Período de Gracia)</option>
                    <option value="Expired">Expired (Expirados)</option>
                    <option value="Cancelled">Cancelled (Cancelados)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Total Destinatarios</p>
                    <p className="text-xl font-bold text-blue-600">
                      {totalRecipients.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs text-gray-600 block mb-1">
                      Tamaño de Bloque
                    </label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      disabled={isSending || sentCount > 0}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={5}>5 (prueba)</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Barra de progreso */}
              {sentCount > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span className="font-medium">Progreso del Envío</span>
                    <span className="font-bold">
                      {sentCount.toLocaleString()} / {totalRecipients.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ width: `${Math.min((sentCount / totalRecipients) * 100, 100)}%` }}
                    >
                      {Math.round((sentCount / totalRecipients) * 100)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600 font-medium">✅ {sentCount.toLocaleString()}</span>
                    {failedCount > 0 && (
                      <span className="text-red-600 font-medium">❌ {failedCount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="space-y-2">
                <button
                  onClick={sendNewsletter}
                  disabled={selectedPosts.length === 0 || isSending || !hasMoreToSend}
                  className="w-full px-4 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending 
                    ? '⏳ Enviando...' 
                    : !hasMoreToSend 
                      ? '✅ Envío Completado' 
                      : sentCount > 0 
                        ? `📤 Enviar Siguiente Bloque (${Math.min(batchSize, totalRecipients - currentOffset)} emails)` 
                        : '📧 Iniciar Envío por Bloques'}
                </button>

                {!hasMoreToSend && sentCount > 0 && (
                  <button
                    onClick={resetSending}
                    className="w-full px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    🔄 Preparar Nuevo Envío
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}