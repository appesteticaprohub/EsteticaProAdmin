'use client'

import { useState, useEffect } from 'react'
import { PostsListResponse, PostWithAuthor, PostsFilters, PostsSortOptions } from '@/types/admin'
import BanUserModal from './BanUserModal'
import UserHistoryModal from './UserHistoryModal'
import PostDetailModal from './PostDetailModal'

const CATEGORIES = [
  'Tratamientos Faciales',
  'Tratamientos Corporales',
  'Depilación',
  'Maquillaje',
  'Uñas',
  'Masajes',
  'Spa',
  'Otros'
]

export default function ContentModerationPanel() {
  // Estados de datos
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)

  // Estados de filtros temporales (inputs)
  const [tempFilters, setTempFilters] = useState<PostsFilters>({
    category: '',
    authorEmail: '',
    authorName: '',
    dateFrom: '',
    dateTo: '',
    minComments: '',
    hasImages: 'all',
    authorStatus: 'all',
    isReviewed: 'all'
  })

  // Estados de filtros activos (aplicados)
  const [activeFilters, setActiveFilters] = useState<PostsFilters>({
    category: '',
    authorEmail: '',
    authorName: '',
    dateFrom: '',
    dateTo: '',
    minComments: '',
    hasImages: 'all',
    authorStatus: 'all',
    isReviewed: 'all'
  })

  // Estados de ordenamiento
  const [sortOptions, setSortOptions] = useState<PostsSortOptions>({
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  // Estados de modales
  const [showBanModal, setShowBanModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [showPostDetailModal, setShowPostDetailModal] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)

  // Fetch posts
  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sortBy: sortOptions.sortBy,
        sortOrder: sortOptions.sortOrder
      })

      // Agregar filtros activos solo si tienen valor
      // Agregar filtros activos solo si tienen valor
      if (activeFilters.category && activeFilters.category !== '') {
        params.append('category', activeFilters.category)
      }
      if (activeFilters.authorEmail && activeFilters.authorEmail !== '') {
        params.append('authorEmail', activeFilters.authorEmail)
      }
      if (activeFilters.authorName && activeFilters.authorName !== '') {
        params.append('authorName', activeFilters.authorName)
      }
      if (activeFilters.dateFrom && activeFilters.dateFrom !== '') {
        params.append('dateFrom', activeFilters.dateFrom)
      }
      if (activeFilters.dateTo && activeFilters.dateTo !== '') {
        params.append('dateTo', activeFilters.dateTo)
      }
      if (activeFilters.minComments && activeFilters.minComments !== '') {
        params.append('minComments', activeFilters.minComments)
      }
      if (activeFilters.hasImages && activeFilters.hasImages !== 'all') {
        params.append('hasImages', activeFilters.hasImages)
      }
      if (activeFilters.authorStatus && activeFilters.authorStatus !== 'all') {
        params.append('authorStatus', activeFilters.authorStatus)
      }
      if (activeFilters.isReviewed && activeFilters.isReviewed !== 'all') {
        params.append('isReviewed', activeFilters.isReviewed)
      }

      const response = await fetch(`/api/admin/moderation/posts?${params}`)
      const data: PostsListResponse = await response.json()

      if (data.success) {
        setPosts(data.data)
        setTotalPages(data.pagination.total_pages)
        setTotalRecords(data.pagination.total_records)
      } else {
        setError('Error al cargar los posts')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros
  const handleApplyFilters = () => {
    setActiveFilters(tempFilters)
    setCurrentPage(1) // Reset a página 1 al aplicar filtros
  }

  // Limpiar filtros
  const handleClearFilters = () => {
    const emptyFilters: PostsFilters = {
      category: '',
      authorEmail: '',
      authorName: '',
      dateFrom: '',
      dateTo: '',
      minComments: '',
      hasImages: 'all',
      authorStatus: 'all',
      isReviewed: 'all'
    }
    setTempFilters(emptyFilters)
    setActiveFilters(emptyFilters)
    setCurrentPage(1)
  }

  // Contar filtros activos
  const countActiveFilters = () => {
    let count = 0
    if (activeFilters.category) count++
    if (activeFilters.authorEmail) count++
    if (activeFilters.authorName) count++
    if (activeFilters.dateFrom) count++
    if (activeFilters.dateTo) count++
    if (activeFilters.minComments) count++
    if (activeFilters.hasImages !== 'all') count++
    if (activeFilters.authorStatus !== 'all') count++
    if (activeFilters.isReviewed !== 'all') count++
    return count
  }

  // Handlers de modales
  const handleBanUser = (userId: string, userName: string, userEmail: string) => {
    setSelectedUser({ id: userId, name: userName, email: userEmail })
    setShowBanModal(true)
  }

  const handleViewHistory = (userId: string, userName: string, userEmail: string) => {
    setSelectedUser({ id: userId, name: userName, email: userEmail })
    setShowHistoryModal(true)
  }

  const handleViewPostDetail = (postId: string) => {
    setSelectedPostId(postId)
    setShowPostDetailModal(true)
  }

  const handleConfirmBan = async (reason: string) => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        setShowBanModal(false)
        fetchPosts() // Recargar posts
      } else {
        alert('Error al bannear usuario')
      }
    } catch (err) {
      console.error('Error banning user:', err)
      alert('Error de conexión')
    }
  }

  // Effects
  useEffect(() => {
    fetchPosts()
  }, [currentPage, activeFilters, sortOptions])

  // Handlers de entrada con Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyFilters()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Moderación de Posts</h1>
        <p className="text-gray-600 mt-1">Gestiona y modera todos los posts publicados</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Filtros de Búsqueda</h3>
          {countActiveFilters() > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {countActiveFilters()} filtro(s) activo(s)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={tempFilters.category}
              onChange={(e) => setTempFilters({ ...tempFilters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Email del autor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email del Autor
            </label>
            <input
              type="text"
              value={tempFilters.authorEmail}
              onChange={(e) => setTempFilters({ ...tempFilters, authorEmail: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="Buscar por email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Nombre del autor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Autor
            </label>
            <input
              type="text"
              value={tempFilters.authorName}
              onChange={(e) => setTempFilters({ ...tempFilters, authorName: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="Buscar por nombre..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={tempFilters.dateFrom}
              onChange={(e) => setTempFilters({ ...tempFilters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={tempFilters.dateTo}
              onChange={(e) => setTempFilters({ ...tempFilters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Mínimo de comentarios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mínimo Comentarios
            </label>
            <input
              type="number"
              min="0"
              value={tempFilters.minComments}
              onChange={(e) => setTempFilters({ ...tempFilters, minComments: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="Ej: 10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tiene imágenes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imágenes
            </label>
            <select
              value={tempFilters.hasImages}
              onChange={(e) => setTempFilters({ ...tempFilters, hasImages: e.target.value as 'true' | 'false' | 'all' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="true">Con imágenes</option>
              <option value="false">Sin imágenes</option>
            </select>
          </div>

          {/* Estado del autor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado del Autor
            </label>
            <select
              value={tempFilters.authorStatus}
              onChange={(e) => setTempFilters({ ...tempFilters, authorStatus: e.target.value as 'active' | 'banned' | 'all' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="banned">Banneados</option>
            </select>
          </div>

          {/* Post revisado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado de Revisión
            </label>
            <select
              value={tempFilters.isReviewed}
              onChange={(e) => setTempFilters({ ...tempFilters, isReviewed: e.target.value as 'true' | 'false' | 'all' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="true">Revisados</option>
              <option value="false">Pendientes</option>
            </select>
          </div>
        </div>

        {/* Botones de filtros */}
        <div className="flex gap-3">
          <button
            onClick={handleApplyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Buscar
          </button>
          <button
            onClick={handleClearFilters}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Ordenamiento */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Ordenar por:</span>
          <select
            value={sortOptions.sortBy}
            onChange={(e) => setSortOptions({ ...sortOptions, sortBy: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="created_at">Fecha de creación</option>
            <option value="views_count">Vistas</option>
            <option value="likes_count">Likes</option>
            <option value="comments_count">Comentarios</option>
            <option value="title">Título</option>
          </select>
          <select
            value={sortOptions.sortOrder}
            onChange={(e) => setSortOptions({ ...sortOptions, sortOrder: e.target.value as 'asc' | 'desc' })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      {/* Lista de posts */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando posts...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg">No se encontraron posts con los filtros aplicados</p>
        </div>
      ) : (
        <>
          {/* Info de paginación */}
          <div className="text-sm text-gray-600">
            Mostrando posts {((currentPage - 1) * 20) + 1} al {Math.min(currentPage * 20, totalRecords)} de un total de {totalRecords}
          </div>

          {/* Grid de posts */}
          <div className="grid grid-cols-1 gap-6">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
                <div className="flex justify-between items-start gap-4">
                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    {/* Título y categoría */}
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 break-words">
                        {post.title}
                      </h3>
                      {post.category && (
                        <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {post.category}
                        </span>
                      )}
                    </div>

                    {/* Preview del contenido */}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 break-words overflow-hidden">
                      {post.content.slice(0, 100)}...
                    </p>

                    {/* Información del autor */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {post.author?.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-600">{post.author?.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {post.author?.country} • {post.author?.specialty}
                          </p>
                        </div>
                        <div>
                          {post.author?.is_banned ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              Banneado
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Activo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>📷 {post.images?.length || 0}</span>
                      <span>💬 {post.comments_count}</span>
                      <span>❤️ {post.likes_count}</span>
                      <span>👁️ {post.views_count}</span>
                      <span className="text-xs">
                        {new Date(post.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Miniatura */}
                  {post.images && post.images.length > 0 && (
                    <div className="flex-shrink-0">
                      <img
                        src={post.images[0]}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => handleViewHistory(post.author.id, post.author.full_name || 'Sin nombre', post.author.email)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Ver Historial
                  </button>
                  {!post.author?.is_banned && (
                    <button
                      onClick={() => handleBanUser(post.author.id, post.author.full_name || 'Sin nombre', post.author.email)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Bannear Autor
                    </button>
                  )}
                  <button 
                    onClick={() => handleViewPostDetail(post.id)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    Ver Detalles
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {showBanModal && selectedUser && (
        <BanUserModal
          isOpen={showBanModal}
          onClose={() => setShowBanModal(false)}
          onConfirm={handleConfirmBan}
          userName={selectedUser.name}
          userEmail={selectedUser.email}
        />
      )}

      {showPostDetailModal && selectedPostId && (
        <PostDetailModal
          isOpen={showPostDetailModal}
          onClose={() => setShowPostDetailModal(false)}
          postId={selectedPostId}
          onPostUpdated={fetchPosts}
        />
      )}

      {showHistoryModal && selectedUser && (
        <UserHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          userEmail={selectedUser.email}
        />
      )}
    </div>
  )
}