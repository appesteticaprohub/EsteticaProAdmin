'use client'

import { useState, useEffect } from 'react'
import { PostWithAuthor, CommentWithUser } from '@/types/admin'

interface UserHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName: string
  userEmail: string
}

interface UserHistory {
  posts: PostWithAuthor[]
  comments: CommentWithUser[]
  stats: {
    total_posts: number
    total_comments: number
    deleted_posts: number
    deleted_comments: number
  }
}

export default function UserHistoryModal({
  isOpen,
  onClose,
  userId,
  userName,
  userEmail
}: UserHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'activity'>('posts')
  const [history, setHistory] = useState<UserHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserHistory()
    }
  }, [isOpen, userId])

  const fetchUserHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/users/${userId}/history`)
      const result = await response.json()

      if (result.error) {
        setError(result.error)
      } else {
        setHistory(result.data)
      }
    } catch (err) {
      setError('Error al cargar el historial del usuario')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Historial del Usuario</h3>
                <p className="text-blue-100 text-sm mt-1">
                  {userName} - {userEmail}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6 flex-shrink-0">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('posts')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'posts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Posts {history && `(${history.posts.length})`}
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'comments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Comentarios {history && `(${history.comments.length})`}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'activity'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Estadísticas
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

            {!loading && !error && history && (
              <>
                {/* Tab: Posts */}
                {activeTab === 'posts' && (
                  <div className="space-y-4">
                    {history.posts.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        Este usuario no ha publicado posts
                      </div>
                    ) : (
                      history.posts.map((post) => (
                        <div
                          key={post.id}
                          className={`border rounded-lg p-4 ${
                            post.is_deleted 
                              ? 'bg-red-50 border-red-200' 
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className={`font-semibold break-words ${
                                post.is_deleted ? 'line-through text-gray-500' : 'text-gray-900'
                              }`}>
                                {post.title}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {post.category || 'Sin categoría'}
                              </p>
                            </div>
                            {post.is_deleted && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                                Eliminado
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-sm mb-3 break-words overflow-hidden ${
                            post.is_deleted ? 'text-gray-500' : 'text-gray-700'
                          }`}>
                            {post.content.substring(0, 100)}
                            {post.content.length > 100 && '...'}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{formatDate(post.created_at)}</span>
                            <div className="flex items-center space-x-3">
                              <span>👁️ {post.views_count}</span>
                              <span>❤️ {post.likes_count}</span>
                              <span>💬 {post.comments_count}</span>
                              {post.images && post.images.length > 0 && (
                                <span>📷 {post.images.length}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab: Comentarios */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {history.comments.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        Este usuario no ha realizado comentarios
                      </div>
                    ) : (
                      history.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`border rounded-lg p-4 ${
                            comment.is_deleted
                              ? 'bg-red-50 border-red-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className={`text-sm flex-1 break-words overflow-hidden ${
                              comment.is_deleted ? 'line-through text-gray-500' : 'text-gray-700'
                            }`}>
                              {comment.content.substring(0, 150)}
                              {comment.content.length > 150 && '...'}
                            </p>
                            {comment.is_deleted && (
                              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium flex-shrink-0">
                                Eliminado
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{formatDate(comment.created_at)}</span>
                            {comment.parent_id && (
                              <span className="text-blue-600">↳ Respuesta</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab: Estadísticas */}
                {activeTab === 'activity' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-3xl font-bold text-blue-600">
                          {history.stats.total_posts}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Posts Totales
                        </div>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-3xl font-bold text-green-600">
                          {history.stats.total_comments}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Comentarios Totales
                        </div>
                      </div>
                      
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-3xl font-bold text-red-600">
                          {history.stats.deleted_posts}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Posts Eliminados
                        </div>
                      </div>
                      
                      <div className="bg-orange-50 rounded-lg p-4">
                        <div className="text-3xl font-bold text-orange-600">
                          {history.stats.deleted_comments}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Comentarios Eliminados
                        </div>
                      </div>
                    </div>

                    {/* Resumen de actividad */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Resumen de Actividad
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Posts Activos:</span>
                          <span className="font-medium">
                            {history.stats.total_posts - history.stats.deleted_posts}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Comentarios Activos:</span>
                          <span className="font-medium">
                            {history.stats.total_comments - history.stats.deleted_comments}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-600">Tasa de Eliminación Posts:</span>
                          <span className="font-medium">
                            {history.stats.total_posts > 0
                              ? `${((history.stats.deleted_posts / history.stats.total_posts) * 100).toFixed(1)}%`
                              : '0%'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tasa de Eliminación Comentarios:</span>
                          <span className="font-medium">
                            {history.stats.total_comments > 0
                              ? `${((history.stats.deleted_comments / history.stats.total_comments) * 100).toFixed(1)}%`
                              : '0%'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}