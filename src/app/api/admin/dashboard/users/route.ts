// src/app/api/admin/dashboard/users/route.ts

import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { getDateRanges, calculateGrowthPercentage } from '@/lib/dashboard-stats'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'total'

    const supabase = createServerSupabaseAdminClient()
    const dateRanges = getDateRanges()

    let count = 0
    let previousCount = 0
    let label = ''

    switch (period) {
      case 'total':
        // Total de usuarios
        const { count: total } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
        
        count = total || 0
        label = 'Total Usuarios'
        break

      case 'today':
        // Usuarios nuevos hoy
        const { count: today } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateRanges.today.start)
          .lte('created_at', dateRanges.today.end)

        // Usuarios de ayer para comparación
        const yesterday = new Date(dateRanges.today.start)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStart = yesterday.toISOString()
        const yesterdayEnd = dateRanges.today.start

        const { count: yesterdayCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayStart)
          .lt('created_at', yesterdayEnd)

        count = today || 0
        previousCount = yesterdayCount || 0
        label = 'Nuevos Usuarios Hoy'
        break

      case 'week':
        // Usuarios nuevos esta semana
        const { count: thisWeek } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateRanges.thisWeek.start)
          .lte('created_at', dateRanges.thisWeek.end)

        // Semana anterior para comparación
        const lastWeekStart = new Date(dateRanges.thisWeek.start)
        lastWeekStart.setDate(lastWeekStart.getDate() - 7)
        const lastWeekEnd = dateRanges.thisWeek.start

        const { count: lastWeek } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', lastWeekStart.toISOString())
          .lt('created_at', lastWeekEnd)

        count = thisWeek || 0
        previousCount = lastWeek || 0
        label = 'Nuevos Usuarios (Semana)'
        break

      case 'month':
        // Usuarios nuevos este mes
        const { count: thisMonth } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateRanges.thisMonth.start)
          .lte('created_at', dateRanges.thisMonth.end)

        // Mes anterior para comparación
        const { count: lastMonth } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateRanges.lastMonth.start)
          .lt('created_at', dateRanges.lastMonth.end)

        count = thisMonth || 0
        previousCount = lastMonth || 0
        label = 'Nuevos Usuarios (Mes)'
        break

      case 'year':
        // Usuarios nuevos este año
        const { count: thisYear } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateRanges.thisYear.start)
          .lte('created_at', dateRanges.thisYear.end)

        // Año anterior para comparación
        const lastYearStart = new Date(dateRanges.thisYear.start)
        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1)
        const lastYearEnd = dateRanges.thisYear.start

        const { count: lastYear } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', lastYearStart.toISOString())
          .lt('created_at', lastYearEnd)

        count = thisYear || 0
        previousCount = lastYear || 0
        label = 'Nuevos Usuarios (Año)'
        break

      default:
        return NextResponse.json(
          { error: 'Período inválido' },
          { status: 400 }
        )
    }

    // Calcular porcentaje de crecimiento
    const growthPercentage = period === 'total' 
      ? 0 
      : calculateGrowthPercentage(count, previousCount)

    return NextResponse.json({
      count,
      previousCount,
      growthPercentage,
      label,
      period
    })

  } catch (error) {
    console.error('Error fetching users stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de usuarios' },
      { status: 500 }
    )
  }
}