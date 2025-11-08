// src/components/RevenueStatsCard.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import DateRangeFilter from './DateRangeFilter'
import type { DashboardRevenueResponse } from '@/types/admin'

export default function RevenueStatsCard() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DashboardRevenueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtros
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const hasFetchedInitialData = useRef(false)

  const fetchData = async (filters?: { dateFrom?: string; dateTo?: string }) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters?.dateTo) params.append('dateTo', filters.dateTo)

      const url = `/api/admin/dashboard/revenue${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos de ingresos')
      }
      
      const result: DashboardRevenueResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error fetching revenue stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilters = () => {
    fetchData({ dateFrom, dateTo })
  }

  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
    fetchData()
  }

  // Cargar datos iniciales solo una vez
  useEffect(() => {
    if (!hasFetchedInitialData.current) {
      hasFetchedInitialData.current = true
      fetchData()
    }
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">💰 Ingresos</h3>
            <p className="text-sm text-gray-500 mt-1">Pagos Recibidos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-6 border-b border-gray-200">
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          isLoading={loading}
        />
      </div>

      {/* Contenido */}
      <div className="p-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-40"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(data.totalRevenue)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Recibido</p>
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Número de pagos:</span>
                <span className="font-semibold text-gray-900">
                  {data.paymentCount.toLocaleString('es-CO')}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Promedio por pago:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(data.averagePerPayment)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}