// src/components/DateRangeFilter.tsx
'use client'

interface DateRangeFilterProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  onApply: () => void
  onClear: () => void
  isLoading?: boolean
}

export default function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  onClear,
  isLoading = false
}: DateRangeFilterProps) {
  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-xs font-semibold text-gray-700 uppercase">🔍 Filtros</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Desde:
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Hasta:
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApply}
          disabled={isLoading || !dateFrom || !dateTo}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Aplicando...' : 'Aplicar'}
        </button>
        
        <button
          onClick={onClear}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  )
}