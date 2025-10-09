// src/components/StatsCard.tsx
'use client'
import { useState } from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: string
  type: 'users' | 'posts' | 'subscriptions'
  onPeriodChange: (period: string) => void
  isLoading?: boolean
}

export default function StatsCard({
  title,
  value,
  change,
  changeType,
  icon,
  type,
  onPeriodChange,
  isLoading = false
}: StatsCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('total')

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const period = e.target.value
    setSelectedPeriod(period)
    onPeriodChange(period)
  }

  const periods = [
    { value: 'total', label: 'Totales' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'year', label: 'Este año' }
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">
            {title}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-3xl">
            {icon}
          </div>
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            disabled={isLoading}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {periods.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
            </p>
            {selectedPeriod !== 'total' && (
              <p className={`text-sm mt-2 font-medium ${
                changeType === 'positive' 
                  ? 'text-green-600' 
                  : changeType === 'negative'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}>
                {change}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}