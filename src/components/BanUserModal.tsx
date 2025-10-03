'use client'

import { useState } from 'react'

interface BanUserModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  userName: string
  userEmail: string
}

export default function BanUserModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  userEmail
}: BanUserModalProps) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Debes proporcionar una razón para el baneo')
      return
    }

    if (!confirmed) {
      alert('Debes confirmar que has revisado el perfil del usuario')
      return
    }

    try {
      setLoading(true)
      await onConfirm(reason)
      // Resetear el modal
      setReason('')
      setConfirmed(false)
      onClose()
    } catch (error) {
      console.error('Error en handleSubmit:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setReason('')
      setConfirmed(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-xl font-bold">Bannear Usuario</h3>
              </div>
              {!loading && (
                <button
                  onClick={handleClose}
                  className="text-white hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {/* Advertencia */}
            <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6">
              <p className="text-red-800 font-semibold">
                Estás a punto de bannear a este usuario
              </p>
            </div>

            {/* Información del usuario */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Información del Usuario</h4>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Nombre:</span> {userName}</p>
                <p><span className="font-medium">Email:</span> {userEmail}</p>
              </div>
            </div>

            {/* Consecuencias */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Consecuencias del baneo:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 mt-0.5">✓</span>
                  <span>Se cancelará su suscripción de PayPal inmediatamente</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 mt-0.5">✓</span>
                  <span>No se realizarán más cobros</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 mt-0.5">✓</span>
                  <span>No podrá acceder a la plataforma</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 mt-0.5">✓</span>
                  <span>Todos sus posts y comentarios permanecerán visibles pero marcados</span>
                </li>
              </ul>
            </div>

            {/* Campo de razón */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Razón del baneo <span className="text-red-600">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
                placeholder="Describe la razón por la cual este usuario será banneado..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                Esta razón quedará registrada en el historial de moderación
              </p>
            </div>

            {/* Checkbox de confirmación */}
            <div className="mb-6">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={loading}
                  className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">
                  He revisado el perfil y contenido de este usuario y confirmo que debe ser banneado
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !reason.trim() || !confirmed}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Banneando...' : 'Bannear Usuario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}