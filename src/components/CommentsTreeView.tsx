'use client'

import { useState, useMemo } from 'react'
import { CommentWithUser } from '@/types/admin'
import BanUserModal from './BanUserModal'

interface CommentsTreeViewProps {
  comments: CommentWithUser[]
  pagination?: {
    current_page: number
    total_pages: number
    total_comments: number
    comments_per_page: number
    has_more: boolean
  }
  onLoadMore?: () => void
  loadingMore?: boolean
  onCommentDeleted?: () => void
  onUserBanned?: () => void
}

interface CommentNode extends CommentWithUser {
  replies: CommentNode[]
}

export default function CommentsTreeView({
  comments,
  pagination,
  onLoadMore,
  loadingMore = false,
  onCommentDeleted,
  onUserBanned
}: CommentsTreeViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'deleted'>('all')
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  
  // Estados para modal de baneo
  const [banModalOpen, setBanModalOpen] = useState(false)
  const [userToBan, setUserToBan] = useState<{ id: string; name: string; email: string } | null>(null)

  // Construir árbol de comentarios
  const buildCommentTree = (comments: CommentWithUser[]): CommentNode[] => {
    const commentMap = new Map<string, CommentNode>()
    const rootComments: CommentNode[] = []

    // Crear nodos para todos los comentarios
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    // Construir jerarquía
    comments.forEach(comment => {
      const node = commentMap.get(comment.id)!
      
      if (comment.parent_id === null) {
        // Es un comentario principal
        rootComments.push(node)
      } else {
        // Es una respuesta, agregarlo al padre
        const parent = commentMap.get(comment.parent_id)
        if (parent) {
          parent.replies.push(node)
        } else {
          // Si no se encuentra el padre, tratarlo como raíz
          rootComments.push(node)
        }
      }
    })

    return rootComments
  }


  
  const toggleThread = (commentId: string) => {
    const newCollapsed = new Set(collapsedThreads)
    if (newCollapsed.has(commentId)) {
      newCollapsed.delete(commentId)
    } else {
      newCollapsed.add(commentId)
    }
    setCollapsedThreads(newCollapsed)
  }

  const handleDeleteComment = async (commentId: string) => {
    const reason = prompt('Ingresa la razón para eliminar este comentario:')
    if (!reason || !reason.trim()) {
      alert('Debes proporcionar una razón')
      return
    }

    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/admin/moderation/comments/${commentId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      const result = await response.json()

      if (result.success) {
        alert('Comentario eliminado exitosamente')
        onCommentDeleted?.()
      } else {
        alert('Error al eliminar comentario: ' + (result.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al eliminar comentario')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRestoreComment = async (commentId: string) => {
    if (!confirm('¿Estás seguro de que deseas restaurar este comentario?')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/admin/moderation/comments/${commentId}/restore`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        alert('Comentario restaurado exitosamente')
        onCommentDeleted?.()
      } else {
        alert('Error al restaurar comentario: ' + (result.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al restaurar comentario')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveComment = async (commentId: string) => {
  if (!confirm('¿Marcar este comentario como revisado?')) {
    return
  }

  try {
    setActionLoading(true)
    const response = await fetch(`/api/admin/moderation/comments/${commentId}/approve`, {
      method: 'POST'
    })

    const result = await response.json()

    if (result.success) {
      alert('Comentario marcado como revisado')
      onCommentDeleted?.() // Recargar datos
    } else {
      alert('Error al aprobar comentario: ' + (result.error || 'Error desconocido'))
    }
  } catch (err) {
    alert('Error al aprobar comentario')
    console.error(err)
  } finally {
    setActionLoading(false)
  }
}

  const openBanModal = (userId: string, userName: string, userEmail: string) => {
    setUserToBan({ id: userId, name: userName, email: userEmail })
    setBanModalOpen(true)
  }

  const handleBanUser = async (reason: string) => {
    if (!userToBan) return

    try {
      const response = await fetch(`/api/admin/users/${userToBan.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      const result = await response.json()

      if (result.success) {
        alert('Usuario banneado exitosamente')
        onUserBanned?.()
      } else {
        alert('Error al bannear usuario: ' + (result.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al bannear usuario')
      console.error(err)
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

  // Renderizar un comentario individual con sus respuestas
  const renderComment = (comment: CommentNode, level: number = 0) => {
    const isCollapsed = collapsedThreads.has(comment.id)
    const hasReplies = comment.replies.length > 0
    
    return (
      <div key={comment.id} className={level > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}>
        <div
          className={`p-4 rounded-lg mb-3 ${
            comment.is_deleted
              ? 'bg-red-50 border-2 border-red-200'
              : 'bg-gray-50 border border-gray-200'
          }`}
        >
          {/* Header del comentario */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                {comment.is_reviewed ? (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                    ✓ Revisado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full font-semibold">
                    ⚠️ Pendiente
                  </span>
                )}
                {level > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Nivel {level}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {formatDate(comment.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {comment.is_deleted && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  Eliminado
                </span>
              )}
              {hasReplies && (
                <button
                  onClick={() => toggleThread(comment.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isCollapsed ? `Mostrar ${comment.replies.length} respuesta(s)` : 'Ocultar'}
                </button>
              )}
            </div>
          </div>

          {/* Contenido del comentario */}
          <p className={`text-sm break-words mb-3 ${
            comment.is_deleted ? 'text-gray-500 line-through' : 'text-gray-700'
          }`}>
            {comment.content}
          </p>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            {comment.is_deleted ? (
              // Si está eliminado, mostrar botón de restaurar
              <button
                onClick={() => handleRestoreComment(comment.id)}
                disabled={actionLoading}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                ♻️ Restaurar
              </button>
            ) : (
              // Si está activo, mostrar botones normales
              <>
                {!comment.is_reviewed && (
                  <button
                    onClick={() => handleApproveComment(comment.id)}
                    disabled={actionLoading}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    ✅ Marcar Revisado
                  </button>
                )}
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  disabled={actionLoading}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  🗑️ Eliminar
                </button>
                {!comment.user?.is_banned && (
                  <button
                    onClick={() => openBanModal(
                      comment.user_id,
                      comment.user?.full_name || 'Sin nombre',
                      comment.user?.email || 'Sin email'
                    )}
                    disabled={actionLoading}
                    className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    🚫 Bannear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Respuestas anidadas */}
        {hasReplies && !isCollapsed && (
          <div className="mt-2">
            {comment.replies.map(reply => renderComment(reply, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const filteredComments = useMemo(() => {
    switch (filter) {
      case 'active':
        return comments.filter(c => !c.is_deleted)
      case 'deleted':
        return comments.filter(c => c.is_deleted)
      default:
        return comments
    }
  }, [comments, filter])

  const commentTree = useMemo(
    () => buildCommentTree(filteredComments),
    [filteredComments]
  )
  
  const stats = {
    total: comments.length,
    active: comments.filter(c => !c.is_deleted).length,
    deleted: comments.filter(c => c.is_deleted).length
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header con filtros */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Comentarios ({stats.total})
            </h3>
            {pagination && (
              <p className="text-sm text-gray-500 mt-1">
                Mostrando {comments.length} de {pagination.total_comments} comentarios
                {pagination.has_more && ` • Página ${pagination.current_page} de ${pagination.total_pages}`}
              </p>
            )}
          </div>
          
          {/* Filtros */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Mostrar:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filter === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Activos ({stats.active})
            </button>
            <button
              onClick={() => setFilter('deleted')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filter === 'deleted'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Eliminados ({stats.deleted})
            </button>
          </div>
        </div>

        {/* Lista de comentarios */}
        {commentTree.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {filter === 'all' 
              ? 'Este post no tiene comentarios'
              : filter === 'active'
              ? 'No hay comentarios activos'
              : 'No hay comentarios eliminados'}
          </p>
        ) : (
          <div className="space-y-2">
            {commentTree.map(comment => renderComment(comment))}
          </div>
        )}

        {/* Botón para cargar más comentarios */}
        {pagination && pagination.has_more && onLoadMore && (
          <div className="mt-6 text-center">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loadingMore ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Cargando comentarios...
                </>
              ) : (
                <>
                  Cargar más comentarios ({pagination.total_comments - comments.length} restantes)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal de baneo */}
      {userToBan && (
        <BanUserModal
          isOpen={banModalOpen}
          onClose={() => {
            setBanModalOpen(false)
            setUserToBan(null)
          }}
          onConfirm={handleBanUser}
          userName={userToBan.name}
          userEmail={userToBan.email}
        />
      )}
    </>
  )
}