'use client'

import { useState, useEffect } from 'react'

interface BannedUser {
  id: string
  full_name: string | null
  email: string
  banned_at: string
  banned_reason: string | null
  subscription_status: string | null
  specialty: string | null
  country: string | null
}

import UserHistoryModal from './UserHistoryModal'

interface ApiResponse {
  data: BannedUser[] | null
  error: string | null
}

export default function BannedUsersPanel() {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<BannedUser | null>(null)


  const fetchBannedUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users/banned')
      const result: ApiResponse = await response.json()
      
      if (result.error) {
        setError(result.error)
      } else {
        setBannedUsers(result.data || [])
      }
    } catch (err) {
      setError('Error al cargar usuarios banneados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBannedUsers()
  }, [])

  const handleUnban = async (userId: string) => {
    if (!confirm('¿Estás seguro de que deseas desbanear a este usuario?')) {
      return
    }

    try {
      setActionLoading(userId)
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
      })

      const result = await response.json()

      if (result.error) {
        alert(`Error: ${result.error}`)
      } else {
        alert('Usuario desbaneado exitosamente')
        // Recargar la lista
        await fetchBannedUsers()
      }
    } catch (err) {
      alert('Error al desbanear usuario')
    } finally {
      setActionLoading(null)
    }
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

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-6 w-64"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Usuarios Banneados</h2>
        <p className="text-gray-600 mt-1">
          Lista de usuarios suspendidos de la plataforma
        </p>
      </div>

      {bannedUsers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay usuarios banneados
          </h3>
          <p className="text-gray-600">
            Actualmente no hay usuarios suspendidos en la plataforma
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Usuarios Suspendidos ({bannedUsers.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {bannedUsers.map((user) => (
              <div key={user.id} className="px-6 py-5 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  {/* Información del Usuario */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white font-medium">
                          {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-gray-900 truncate">
                          {user.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          🚫 Banneado
                        </span>
                      </div>
                    </div>

                    {/* Detalles del Baneo */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">
                            Fecha de Baneo
                          </p>
                          <p className="text-sm text-gray-900 mt-1">
                            {formatDate(user.banned_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">
                            Estado de Suscripción
                          </p>
                          <p className="text-sm text-gray-900 mt-1">
                            {user.subscription_status || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {user.banned_reason && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                            Razón del Baneo
                          </p>
                          <p className="text-sm text-gray-900">
                            {user.banned_reason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Info Adicional */}
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {user.specialty && (
                        <div className="flex items-center space-x-1">
                          <span>💼</span>
                          <span>{user.specialty}</span>
                        </div>
                      )}
                      {user.country && (
                        <div className="flex items-center space-x-1">
                          <span>🌎</span>
                          <span>{user.country}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="ml-6 flex-shrink-0 flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user)
                        setShowHistoryModal(true)
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      👁️ Ver Historial
                    </button>
                    <button
                      onClick={() => handleUnban(user.id)}
                      disabled={actionLoading === user.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {actionLoading === user.id ? '...' : '🔓 Desbanear'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Modal de historial */}
      {selectedUser && (
        <UserHistoryModal
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false)
            setSelectedUser(null)
          }}
          userId={selectedUser.id}
          userName={selectedUser.full_name || 'Sin nombre'}
          userEmail={selectedUser.email}
        />
      )}
    </div>
  )
}