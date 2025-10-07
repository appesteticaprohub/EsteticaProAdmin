// src/components/StatsCard.tsx

'use client'

import { useState } from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  change: string
  changeType: 'positive' | 'negative'
  icon: string
  details?: {
    label: string
    value: string | number
  }[]
}

export default function StatsCard({
  title,
  value,
  change,
  changeType,
  icon,
  details
}: StatsCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div 
      className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 relative"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
          </p>
          <p className={`text-sm mt-2 ${
            changeType === 'positive' 
              ? 'text-green-600' 
              : 'text-red-600'
          }`}>
            {change} vs mes anterior
          </p>
        </div>
        <div className="text-3xl">
          {icon}
        </div>
      </div>

      {/* Tooltip con detalles */}
      {details && details.length > 0 && showDetails && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
          <p className="text-xs font-semibold text-gray-700 mb-2">Detalles:</p>
          <div className="space-y-2">
            {details.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-xs text-gray-600">{detail.label}</span>
                <span className="text-xs font-semibold text-gray-900">
                  {typeof detail.value === 'number' ? detail.value.toLocaleString('es-CO') : detail.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}