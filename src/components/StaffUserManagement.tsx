'use client'

import { useState, useEffect } from 'react'
import { StaffUser, StaffUsersResponse, CreateStaffUserRequest } from '@/types/admin'

export default function StaffUserManagement() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({})
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(20)
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; user: StaffUser | null }>({
    show: false,
    user: null
  })
  const [passwordModal, setPasswordModal] = useState<{ show: boolean; user: StaffUser | null }>({
    show: false,
    user: null
  })
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  // Formulario de creación
  const [formData, setFormData] = useState<CreateStaffUserRequest>({
    email: '',
    password: '',
    full_name: '',
    country: '',
    specialty: ''
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Nueva contraseña para modal
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Cargar usuarios staff
  const fetchStaffUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/users/staff?page=${page}&limit=${limit}`)
      const result: StaffUsersResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.success === false ? 'Failed to fetch staff users' : 'Unknown error')
      }

      setUsers(result.users)
      setTotal(result.total)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaffUsers()
  }, [page])

  // Crear usuario staff
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)

    try {
      const response = await fetch('/api/admin/users/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al crear usuario')
      }

      // Éxito
      showToast('Usuario staff creado exitosamente', 'success')
      setShowForm(false)
      setFormData({
        email: '',
        password: '',
        full_name: '',
        country: '',
        specialty: ''
      })
      fetchStaffUsers() // Recargar lista
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setFormLoading(false)
    }
  }

  // Actualizar contraseña
  const handleUpdatePassword = async () => {
    if (!passwordModal.user || !newPassword) return

    setPasswordLoading(true)
    try {
      const response = await fetch(`/api/admin/users/staff/${passwordModal.user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al actualizar contraseña')
      }

      showToast('Contraseña actualizada exitosamente', 'success')
      setPasswordModal({ show: false, user: null })
      setNewPassword('')
      fetchStaffUsers() // Recargar para ver nueva contraseña
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al actualizar', 'error')
    } finally {
      setPasswordLoading(false)
    }
  }

  // Eliminar usuario
  const handleDeleteUser = async () => {
    if (!deleteModal.user) return

    try {
      const response = await fetch(`/api/admin/users/staff/${deleteModal.user.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al eliminar usuario')
      }

      // Cerrar modal primero
      setDeleteModal({ show: false, user: null })
      
      // Mostrar toast
      showToast('Usuario eliminado permanentemente', 'success')
      
      // Recargar lista con un pequeño delay para asegurar que la DB se actualizó
      setTimeout(() => {
        fetchStaffUsers()
      }, 500)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar', 'error')
    }
  }

  // Toggle mostrar/ocultar contraseña
  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  // Copiar al portapapeles
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Contraseña copiada al portapapeles', 'success')
  }

  // Mostrar toast
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  // Loading state
  if (loading && users.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-6 w-64"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios Staff</h2>
        <p className="text-gray-600 mt-1">Crear y gestionar usuarios de prueba para poblar el foro</p>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
        </div>
      )}

      {/* Formulario Colapsable */}
      <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">➕</span>
            <span className="font-semibold text-gray-900">Crear Nuevo Usuario Staff</span>
          </div>
          <span className={`transform transition-transform ${showForm ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {showForm && (
          <form onSubmit={handleCreateUser} className="px-6 py-4 border-t border-gray-200">
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-red-800 text-sm">{formError}</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña * (mín. 8 caracteres)
                </label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contraseña visible"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País *
                </label>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Colombia"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Especialidad *
                </label>
                <input
                  type="text"
                  required
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Dermatología"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormError(null)
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Usuarios Staff ({total})
          </h3>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-400 text-5xl mb-4">👥</div>
            <p className="text-gray-600 text-lg">No hay usuarios staff creados</p>
            <p className="text-gray-500 text-sm mt-2">Crea tu primer usuario staff usando el formulario de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contraseña
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    País
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Especialidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Creación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {showPasswords[user.id] ? user.password_plain : '••••••••'}
                        </code>
                        <button
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title={showPasswords[user.id] ? 'Ocultar' : 'Mostrar'}
                        >
                          {showPasswords[user.id] ? '🙈' : '👁️'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(user.password_plain)}
                          className="text-green-600 hover:text-green-800"
                          title="Copiar"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.country}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.specialty}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setPasswordModal({ show: true, user })}
                          className="text-orange-600 hover:text-orange-800 text-lg"
                          title="Cambiar contraseña"
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => setDeleteModal({ show: true, user })}
                          className="text-red-600 hover:text-red-800 text-lg"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {total > limit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Primera
              </button>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Página {page} de {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / limit)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Siguiente
              </button>
              <button
                onClick={() => setPage(Math.ceil(total / limit))}
                disabled={page >= Math.ceil(total / limit)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Cambiar Contraseña */}
      {passwordModal.show && passwordModal.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h3>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600">Usuario: <span className="font-medium text-gray-900">{passwordModal.user.full_name}</span></p>
                <p className="text-sm text-gray-600">Email: <span className="font-medium text-gray-900">{passwordModal.user.email}</span></p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva Contraseña (mín. 8 caracteres)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nueva contraseña"
                  minLength={8}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">La contraseña se actualizará en:</p>
                <ul className="mt-2 space-y-1">
                  <li className="text-sm text-blue-700">✓ Sistema de autenticación</li>
                  <li className="text-sm text-blue-700">✓ Panel de administración</li>
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setPasswordModal({ show: false, user: null })
                  setNewPassword('')
                }}
                disabled={passwordLoading}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={passwordLoading || newPassword.length < 8}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {deleteModal.show && deleteModal.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-red-600">⚠️ Eliminar Usuario Staff</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700 mb-4">¿Estás seguro de eliminar a:</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm"><span className="font-medium">Nombre:</span> {deleteModal.user.full_name}</p>
                <p className="text-sm"><span className="font-medium">Email:</span> {deleteModal.user.email}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">Esta acción eliminará permanentemente:</p>
                <ul className="space-y-1 text-sm text-red-700">
                  <li>• Su cuenta y perfil</li>
                  <li>• Todos sus posts</li>
                  <li>• Todos sus comentarios</li>
                  <li>• Sus likes y notificaciones</li>
                </ul>
                <p className="text-sm font-bold text-red-900 mt-3">⚠️ Esta acción NO se puede deshacer</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ show: false, user: null })}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}