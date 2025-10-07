// src/lib/dashboard-stats.ts

/**
 * Obtiene el rango de fechas para diferentes períodos en zona horaria de Colombia
 */
export function getDateRanges() {
  const now = new Date()
  const colombiaOffset = -5 * 60 // Colombia está en UTC-5

  // Ajustar a zona horaria de Colombia
  const colombiaTime = new Date(now.getTime() + (colombiaOffset * 60 * 1000))

  return {
    // Hoy: desde las 00:00:00 hasta ahora
    today: {
      start: new Date(colombiaTime.getFullYear(), colombiaTime.getMonth(), colombiaTime.getDate()).toISOString(),
      end: now.toISOString()
    },
    // Esta semana: desde el lunes 00:00:00 hasta ahora
    thisWeek: {
      start: getMonday(colombiaTime).toISOString(),
      end: now.toISOString()
    },
    // Este mes: desde el día 1 00:00:00 hasta ahora
    thisMonth: {
      start: new Date(colombiaTime.getFullYear(), colombiaTime.getMonth(), 1).toISOString(),
      end: now.toISOString()
    },
    // Este año: desde el 1 de enero 00:00:00 hasta ahora
    thisYear: {
      start: new Date(colombiaTime.getFullYear(), 0, 1).toISOString(),
      end: now.toISOString()
    },
    // Mes anterior completo (para calcular crecimiento)
    lastMonth: {
      start: new Date(colombiaTime.getFullYear(), colombiaTime.getMonth() - 1, 1).toISOString(),
      end: new Date(colombiaTime.getFullYear(), colombiaTime.getMonth(), 1).toISOString()
    }
  }
}

/**
 * Obtiene el lunes de la semana actual
 */
function getMonday(date: Date): Date {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Ajustar cuando es domingo
  return new Date(date.getFullYear(), date.getMonth(), diff)
}

/**
 * Calcula el porcentaje de crecimiento
 */
export function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}