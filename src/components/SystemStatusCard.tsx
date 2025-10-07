// src/components/SystemStatusCard.tsx

'use client'

interface SystemStatusCardProps {
  serverStatus: 'active' | 'inactive'
  databaseStatus: 'connected' | 'disconnected'
  version: string
}

export default function SystemStatusCard({
  serverStatus,
  databaseStatus,
  version
}: SystemStatusCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Sistema</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Estado del servidor</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            serverStatus === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {serverStatus === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Base de datos</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            databaseStatus === 'connected' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {databaseStatus === 'connected' ? 'Conectada' : 'Desconectada'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Versión</span>
          <span className="text-sm text-gray-900">{version}</span>
        </div>
      </div>
    </div>
  )
}