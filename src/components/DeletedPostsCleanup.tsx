'use client'

import { useState } from 'react'
import { DeletedPostItem, DeletedPostsListResponse } from '@/types/admin'

interface DeletedPostsCleanupProps {
  onPostsDeleted?: () => void
}

export default function DeletedPostsCleanup({ onPostsDeleted }: DeletedPostsCleanupProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deletedPosts, setDeletedPosts] = useState<DeletedPostItem[]>([])
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState({
    total_posts: 0,
    total_images: 0,
    total_comments: 0,
    total_likes: 0
  })
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const limit = 50
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (page: number = 1) => {
    if (!dateFrom || !dateTo) {
      alert('Por favor selecciona ambas fechas')
      return
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      alert('La fecha inicial no puede ser mayor que la fecha final')
      return
    }

    setLoading(true)
    setSelectedPosts(new Set())
    setCurrentPage(page)
    setHasSearched(true)

    try {
      const response = await fetch(
        `/api/admin/cleanup-deleted-posts?dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page}&limit=${limit}`
      )

      if (!response.ok) {
        throw new Error('Error al buscar posts eliminados')
      }

      const result: DeletedPostsListResponse = await response.json()

      if (result.success) {
        setDeletedPosts(result.data)
        setSummary(result.summary)
        setTotalPages(result.pagination.total_pages)
        setTotalRecords(result.total_records)
        setCurrentPage(result.pagination.current_page)
      } else {
        throw new Error('Error en la respuesta del servidor')
      }
    } catch (error) {
      console.error('Error fetching deleted posts:', error)
      alert('Error al buscar posts eliminados')
    } finally {
      setLoading(false)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handleSearch(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handleSearch(currentPage - 1)
    }
  }

  const handleFirstPage = () => {
    if (currentPage !== 1) {
      handleSearch(1)
    }
  }

  const handleLastPage = () => {
    if (currentPage !== totalPages) {
      handleSearch(totalPages)
    }
  }

  const handleSelectAll = () => {
    if (selectedPosts.size === deletedPosts.length) {
      setSelectedPosts(new Set())
    } else {
      setSelectedPosts(new Set(deletedPosts.map(p => p.id)))
    }
  }

  const handleSelectPost = (postId: string) => {
    const newSelected = new Set(selectedPosts)
    if (newSelected.has(postId)) {
      newSelected.delete(postId)
    } else {
      newSelected.add(postId)
    }
    setSelectedPosts(newSelected)
  }

  const getSelectedSummary = () => {
    const selected = deletedPosts.filter(p => selectedPosts.has(p.id))
    return {
      posts: selected.length,
      images: selected.reduce((sum, p) => sum + p.images_count, 0),
      comments: selected.reduce((sum, p) => sum + p.comments_count, 0),
      likes: selected.reduce((sum, p) => sum + p.likes_count, 0)
    }
  }

  const handleOpenDeleteModal = () => {
    if (selectedPosts.size === 0) {
      alert('Selecciona al menos un post para eliminar')
      return
    }
    setShowDeleteModal(true)
    setConfirmText('')
  }

  const handlePermanentDelete = async () => {
    if (confirmText !== 'ELIMINAR PERMANENTEMENTE') {
      alert('Debes escribir la frase de confirmación exactamente')
      return
    }

    setDeleting(true)

    try {
      const response = await fetch('/api/admin/cleanup-permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_ids: Array.from(selectedPosts)
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(
          `✓ Eliminación completada exitosamente:\n\n` +
          `Posts eliminados: ${result.deleted_count}\n` +
          `Imágenes eliminadas: ${result.images_deleted}\n` +
          `Comentarios eliminados: ${result.comments_deleted}\n` +
          `Likes eliminados: ${result.likes_deleted}`
        )
        
        // Recargar la lista en la página actual
        await handleSearch(currentPage)
        setShowDeleteModal(false)
        setConfirmText('')
        onPostsDeleted?.()
      } else {
        let errorMsg = 'Error al eliminar posts'
        if (result.errors && result.errors.length > 0) {
          errorMsg += ':\n\n' + result.errors.join('\n')
        }
        alert(errorMsg)
      }
    } catch (error) {
      console.error('Error deleting posts:', error)
      alert('Error al eliminar posts permanentemente')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const selectedSummary = getSelectedSummary()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Limpieza de Posts Eliminados
        </h2>
        <p className="text-gray-600">
          Elimina permanentemente posts que fueron eliminados (soft delete). Esta acción es irreversible.
        </p>
      </div>

      {/* Filtros de búsqueda */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Buscar Posts Eliminados</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Inicial
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Final
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Buscando...' : 'Buscar Posts'}
            </button>
          </div>
        </div>

        {/* Información de paginación */}
        {totalRecords > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-700">
              Mostrando <span className="font-semibold">{(currentPage - 1) * limit + 1}</span> a{' '}
              <span className="font-semibold">{Math.min(currentPage * limit, totalRecords)}</span> de{' '}
              <span className="font-semibold">{totalRecords}</span> posts eliminados
            </div>
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>
          </div>
        )}

        {/* Resumen de búsqueda */}
        {deletedPosts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{summary.total_posts}</p>
              <p className="text-sm text-gray-600">Posts encontrados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{summary.total_images}</p>
              <p className="text-sm text-gray-600">Imágenes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{summary.total_comments}</p>
              <p className="text-sm text-gray-600">Comentarios</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{summary.total_likes}</p>
              <p className="text-sm text-gray-600">Likes</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de posts */}
      {deletedPosts.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Posts Eliminados ({deletedPosts.length})
              </h3>
              {selectedPosts.size > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPosts.size} seleccionados
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {selectedPosts.size === deletedPosts.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </button>
              
              <button
                onClick={handleOpenDeleteModal}
                disabled={selectedPosts.size === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
              >
                Eliminar Permanentemente ({selectedPosts.size})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedPosts.size === deletedPosts.length && deletedPosts.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Título
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Autor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eliminado el
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imágenes
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comentarios
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Likes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedPosts.map((post) => (
                  <tr key={post.id} className={selectedPosts.has(post.id) ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(post.id)}
                        onChange={() => handleSelectPost(post.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                        {post.title}
                      </div>
                      {post.category && (
                        <div className="text-xs text-gray-500">{post.category}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{post.author_name || 'Sin nombre'}</div>
                      <div className="text-xs text-gray-500">{post.author_email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(post.deleted_at)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {post.images_count}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {post.comments_count}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {post.likes_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Controles de paginación */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={() => handleFirstPage()}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Primera
                </button>
                <button
                  onClick={() => handlePrevPage()}
                  disabled={currentPage === 1 || loading}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>
              </div>

              <div className="text-sm text-gray-700">
                Página <span className="font-semibold">{currentPage}</span> de{' '}
                <span className="font-semibold">{totalPages}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleNextPage()}
                  disabled={currentPage === totalPages || loading}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
                <button
                  onClick={() => handleLastPage()}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-red-600">
              <h3 className="text-xl font-bold text-white">
                ADVERTENCIA: Eliminación Permanente
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-600 p-4">
                <p className="text-red-800 font-semibold">
                  Esta acción es IRREVERSIBLE y NO se puede deshacer
                </p>
              </div>

              <p className="text-gray-700">
                Estás a punto de eliminar permanentemente <strong>{selectedSummary.posts}</strong> post(s)
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-gray-800">Esto eliminará:</p>
                <ul className="space-y-1 text-gray-700">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    {selectedSummary.posts} post(s) de la base de datos
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    {selectedSummary.images} imagen(es) del storage
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    {selectedSummary.comments} comentario(s) asociados
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    {selectedSummary.likes} like(s)
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Para confirmar, escribe: <span className="text-red-600">ELIMINAR PERMANENTEMENTE</span>
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Escribe aquí..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={deleting}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setConfirmText('')
                }}
                disabled={deleting}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deleting || confirmText !== 'ELIMINAR PERMANENTEMENTE'}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && deletedPosts.length === 0 && hasSearched && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">
            No se encontraron posts eliminados en el rango de fechas seleccionado
          </p>
        </div>
      )}
    </div>
  )
}