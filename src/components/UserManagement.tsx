'use client'

import { useState, useEffect } from 'react'
import { Profile, ApiResponse } from '@/types/admin'

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const response = await fetch('/api/profiles')
        const result: ApiResponse<Profile[]> = await response.json()
        
        if (result.error) {
          setError(result.error)
        } else {
          setProfiles(result.data || [])
        }
      } catch (err) {
        setError('Error al cargar los datos')
      } finally {
        setLoading(false)
      }
    }

    fetchProfiles()
  }, [])

  if (loading) {
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
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
        <p className="text-gray-600 mt-1">Lista de perfiles registrados en la plataforma</p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Perfiles ({profiles.length})
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {profiles.map((profile) => (
            <div key={profile.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {profile.full_name || 'Sin nombre'}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {profile.email}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {profile.user_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      {profile.subscription_status}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {profile.specialty || 'Sin especialidad'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {profile.country || 'Sin país'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}