'use client'

import { useState, useEffect } from 'react'
import { PostDetailResponse } from '@/types/admin'
import ImageLightbox from './ImageLightbox'
import BanUserModal from './BanUserModal'

interface PostDetailModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  onPostUpdated?: () => void
}

export default function PostDetailModal({
  isOpen,
  onClose,
  postId,
  onPostUpdated
}: PostDetailModalProps) {
  const [postDetail, setPostDetail] = useState<PostDetailResponse['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  // Estados para modal de baneo
  const [banModalOpen, setBanModalOpen] = useState(false)
  
  // Estados para acciones
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (isOpen && postId) {
      fetchPostDetail()
    }
  }, [isOpen, postId])

  const fetchPostDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/moderation/posts/${postId}`)
      const result: PostDetailResponse = await response.json()

      if (!result.success || !result.data) {
        setError(result.success === false ? 'Error al cargar el post' : 'Post no encontrado')
      } else {
        setPostDetail(result.data)
      }
    } catch (err) {
      setError('Error al cargar los detalles del post')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = async () => {
    if (!postDetail) return
    
    const reason = prompt('Ingresa la razón para eliminar este post:')
    if (!reason || !reason.trim()) {
      alert('Debes proporcionar una razón')
      return
    }

    if (!confirm('¿Estás seguro de que deseas eliminar este post?')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/admin/moderation/posts/${postId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      const result = await response.json()

      if (result.success) {
        alert('Post eliminado exitosamente')
        onPostUpdated?.()
        onClose()
      } else {
        alert('Error al eliminar el post: ' + (result.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al eliminar el post')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprovePost = async () => {
    if (!postDetail) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/admin/moderation/posts/${postId}/approve`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        alert('Post aprobado exitosamente')
        fetchPostDetail() // Recargar datos
        onPostUpdated?.()
      } else {
        alert('Error al aprobar el post: ' + (result.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al aprobar el post')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleBanUser = async (reason: string) => {
    if (!postDetail) return

    try {
      const response = await fetch(`/api/admin/users/${postDetail.author.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      const result = await response.json()

      if (result.success) {
        alert('Usuario banneado exitosamente')
        fetchPostDetail() // Recargar datos
        onPostUpdated?.()
      } else {
        alert('Error al bannear usuario: ' + (result.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al bannear usuario')
      console.error(err)
    }
  }

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Detalles del Post</h3>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 text-2xl leading-none"
                  disabled={actionLoading}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading && (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {!loading && !error && postDetail && (
                <div className="space-y-6">
                  {/* Información del Post */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2 break-words">
                          {postDetail.post.title}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                            {postDetail.post.category || 'Sin categoría'}
                          </span>
                          <span>{formatDate(postDetail.post.created_at)}</span>
                          {postDetail.post.is_reviewed && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                              ✓ Revisado
                            </span>
                          )}
                          {postDetail.post.is_deleted && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                              Eliminado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="prose max-w-none mb-6">
                      <p className="text-gray-700 whitespace-pre-wrap break-words">
                        {postDetail.post.content}
                      </p>
                    </div>

                    {/* Métricas */}
                    <div className="flex items-center gap-6 text-sm text-gray-600 pt-4 border-t">
                      <div className="flex items-center gap-1">
                        <span>👁️</span>
                        <span>{postDetail.post.views_count} vistas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>❤️</span>
                        <span>{postDetail.post.likes_count} likes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>💬</span>
                        <span>{postDetail.post.comments_count} comentarios</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>📷</span>
                        <span>{postDetail.post.images.length} imágenes</span>
                      </div>
                    </div>
                  </div>

                  {/* Galería de Imágenes */}
                  {postDetail.post.images.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Galería de Imágenes ({postDetail.post.images.length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {postDetail.post.images.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => openLightbox(idx)}
                            className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity border border-gray-200"
                          >
                            <img
                              src={img}
                              alt={`Imagen ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Información del Autor */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Información del Autor
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        postDetail.author.is_banned
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {postDetail.author.is_banned ? '🚫 Banneado' : '✓ Activo'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Nombre</p>
                        <p className="font-medium text-gray-900">
                          {postDetail.author.full_name || 'Sin nombre'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-gray-900 break-words">
                          {postDetail.author.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">País</p>
                        <p className="font-medium text-gray-900">
                          {postDetail.author.country || 'No especificado'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Especialidad</p>
                        <p className="font-medium text-gray-900">
                          {postDetail.author.specialty || 'No especificada'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tipo de usuario</p>
                        <p className="font-medium text-gray-900">
                          {postDetail.author.user_type === 'premium' ? 'Premium' : 'Anónimo'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Estado de suscripción</p>
                        <p className="font-medium text-gray-900">
                          {postDetail.author.subscription_status}
                        </p>
                      </div>
                    </div>

                    {/* Estadísticas del autor */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {postDetail.author.stats.total_posts}
                        </p>
                        <p className="text-sm text-gray-600">Posts totales</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {postDetail.author.stats.total_comments}
                        </p>
                        <p className="text-sm text-gray-600">Comentarios</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {postDetail.author.stats.deleted_comments}
                        </p>
                        <p className="text-sm text-gray-600">Eliminados</p>
                      </div>
                    </div>

                    {/* Razón de baneo si aplica */}
                    {postDetail.author.is_banned && postDetail.author.banned_reason && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-900 mb-1">Razón del baneo:</p>
                        <p className="text-sm text-red-800 break-words">
                          {postDetail.author.banned_reason}
                        </p>
                        {postDetail.author.banned_at && (
                          <p className="text-xs text-red-600 mt-2">
                            Banneado el {formatDate(postDetail.author.banned_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comentarios */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Comentarios ({postDetail.comments.length})
                    </h3>
                    
                    {postDetail.comments.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        Este post no tiene comentarios
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {postDetail.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`p-4 rounded-lg ${
                              comment.is_deleted
                                ? 'bg-red-50 border border-red-200'
                                : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-gray-900">
                                    {comment.user?.full_name || 'Usuario desconocido'}
                                  </p>
                                  <span className="text-sm text-gray-500">
                                    {comment.user?.email}
                                  </span>
                                  {comment.user?.is_banned && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                                      Banneado
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {formatDate(comment.created_at)}
                                </p>
                              </div>
                              {comment.is_deleted && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                  Eliminado
                                </span>
                              )}
                            </div>
                            <p className={`text-sm break-words ${
                              comment.is_deleted ? 'text-gray-500 line-through' : 'text-gray-700'
                            }`}>
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer - Botones de Acción */}
            {!loading && !error && postDetail && (
              <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-between items-center flex-shrink-0">
                <div className="flex gap-3">
                  {!postDetail.post.is_deleted && (
                    <>
                      <button
                        onClick={handleDeletePost}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        🗑️ Eliminar Post
                      </button>
                      {!postDetail.post.is_reviewed && (
                        <button
                          onClick={handleApprovePost}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          ✅ Aprobar Post
                        </button>
                      )}
                      {!postDetail.author.is_banned && (
                        <button
                          onClick={() => setBanModalOpen(true)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          🚫 Bannear Autor
                        </button>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={onClose}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && postDetail && postDetail.post.images.length > 0 && (
        <ImageLightbox
          images={postDetail.post.images}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onNext={() => setCurrentImageIndex(prev => 
            prev < postDetail.post.images.length - 1 ? prev + 1 : prev
          )}
          onPrev={() => setCurrentImageIndex(prev => 
            prev > 0 ? prev - 1 : prev
          )}
        />
      )}

      {/* Modal de Baneo */}
      {postDetail && (
        <BanUserModal
          isOpen={banModalOpen}
          onClose={() => setBanModalOpen(false)}
          onConfirm={handleBanUser}
          userName={postDetail.author.full_name || 'Sin nombre'}
          userEmail={postDetail.author.email}
        />
      )}
    </>
  )
}