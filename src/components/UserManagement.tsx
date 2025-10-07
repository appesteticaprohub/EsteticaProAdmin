'use client'

import { useState, useEffect, useCallback } from 'react'
import { Profile, UsersListResponse, UsersFilters } from '@/types/admin'

export default function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [limit, setLimit] = useState(25)
  
  // Estados de filtros
  const [searchName, setSearchName] = useState('')
  const [searchEmail, setSearchEmail] = useState('')
  const [filters, setFilters] = useState<UsersFilters>({})

  // Estado del modal
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Función para obtener usuarios
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Construir query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })

      if (searchName.trim()) params.append('search_name', searchName.trim())
      if (searchEmail.trim()) params.append('search_email', searchEmail.trim())

      // Agregar filtros adicionales si existen
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await fetch(`/api/admin/users?${params.toString()}`)
      const result: UsersListResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al cargar usuarios')
      }

      if (result.success) {
        setUsers(result.users)
        setTotalPages(result.pagination.total_pages)
        setTotalRecords(result.pagination.total_records)
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, limit, searchName, searchEmail, filters])

  // Efecto para cargar usuarios
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Handlers
  const handleSearchNameChange = (value: string) => {
    setSearchName(value)
    setCurrentPage(1)
  }

  const handleSearchEmailChange = (value: string) => {
    setSearchEmail(value)
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setSearchName('')
    setSearchEmail('')
    setFilters({})
    setCurrentPage(1)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setCurrentPage(1)
  }

  const handleViewDetails = (user: Profile) => {
    setSelectedUser(user)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedUser(null)
  }

  // Función para formatear fecha en zona horaria de Bogotá
  const formatDateBogota = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return '-'
    }
  }

  // Función para obtener badge de estado
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Active: 'bg-green-100 text-green-800',
      Expired: 'bg-red-100 text-red-800',
      Cancelled: 'bg-yellow-100 text-yellow-800',
      Pending: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  // Función para obtener badge de rol
  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      moderator: 'bg-blue-100 text-blue-800',
      user: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[role] || 'bg-gray-100 text-gray-800'}`}>
        {role}
      </span>
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="px-6 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-6 w-64"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
          <button
            onClick={fetchUsers}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
        <p className="text-gray-600 mt-1">Total de usuarios: {totalRecords}</p>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda por nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar por nombre
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => handleSearchNameChange(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Búsqueda por email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar por correo electrónico
            </label>
            <input
              type="text"
              value={searchEmail}
              onChange={(e) => handleSearchEmailChange(e.target.value)}
              placeholder="Buscar por email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Botón limpiar filtros */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de usuarios simplificada */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Correo Electrónico
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                            {user.full_name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || 'Sin nombre'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.role && getRoleBadge(user.role)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                      <div className="text-sm text-gray-500">
                        {user.is_banned ? (
                          <span className="text-red-600 font-medium">🚫 Baneado</span>
                        ) : (
                          <span className="text-green-600 font-medium">✓ Activo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(user)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Ver detalles →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalRecords > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Indicador de resultados */}
              <div className="text-sm text-gray-700">
                Mostrando {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalRecords)} de {totalRecords} usuarios
              </div>

              {/* Controles de paginación */}
              <div className="flex items-center gap-2">
                {/* Selector de cantidad por página */}
                <select
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                {/* Botones de navegación */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    «
                  </button>

                  {/* Números de página */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded-md text-sm ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    »
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    »»
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Detalles del Usuario</h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="px-6 py-4">
              {/* Información básica */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-medium">
                    {selectedUser.full_name?.charAt(0)?.toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {selectedUser.full_name || 'Sin nombre'}
                    </h4>
                    <p className="text-gray-600">{selectedUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Grid de información */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Especialidad */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Especialidad</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedUser.specialty || '-'}</p>
                </div>

                {/* País */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">País</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedUser.country || '-'}</p>
                </div>

                {/* Estado de Suscripción */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Estado de Suscripción</p>
                  <div className="mt-1">{getStatusBadge(selectedUser.subscription_status)}</div>
                </div>

                {/* Fecha de vencimiento */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Vencimiento</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDateBogota(selectedUser.subscription_expires_at)}
                  </p>
                </div>

                {/* Auto-renovación */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Auto-renovación</p>
                  <p className="text-sm mt-1">
                    {selectedUser.auto_renewal_enabled ? (
                      <span className="text-green-600 font-medium">✓ Activada</span>
                    ) : (
                      <span className="text-red-600 font-medium">✗ Desactivada</span>
                    )}
                  </p>
                </div>

                {/* Estado de baneo */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Estado</p>
                  <div className="mt-1">
                    {selectedUser.is_banned ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        🚫 Baneado
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ✓ Activo
                      </span>
                    )}
                  </div>
                </div>

                {/* Rol */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Rol</p>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>

                {/* Fecha de creación */}
                <div className="border-b border-gray-200 pb-3">
                  <p className="text-sm font-medium text-gray-500">Fecha de Registro</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDateBogota(selectedUser.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}