// src/app/api/admin/dashboard/users/route.ts

import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const subscriptionStatus = searchParams.get('subscriptionStatus') || 'all'

    const supabase = createServerSupabaseAdminClient()

    // ========== QUERY OPTIMIZADA: Solo traer subscription_status ==========
    let query = supabase
      .from('profiles')
      .select('subscription_status', { count: 'exact', head: false })

    // Aplicar filtros de fecha si existen
    if (dateFrom) {
      const dateFromStart = new Date(dateFrom)
      dateFromStart.setHours(0, 0, 0, 0)
      query = query.gte('created_at', dateFromStart.toISOString())
    }
    if (dateTo) {
      const dateToEnd = new Date(dateTo)
      dateToEnd.setHours(23, 59, 59, 999)
      query = query.lte('created_at', dateToEnd.toISOString())
    }

    // Aplicar filtro de estado de suscripción si no es "all"
    if (subscriptionStatus !== 'all') {
      query = query.eq('subscription_status', subscriptionStatus)
    }

    // Ejecutar query
    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      throw error
    }

    // Contar usuarios por estado de suscripción de forma eficiente
    const statusCounts: Record<string, number> = {}
    
    if (data) {
      // Solo iteramos sobre el campo subscription_status, no sobre objetos completos
      data.forEach((profile: { subscription_status: string }) => {
        const status = profile.subscription_status || 'Unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
    }

    return NextResponse.json({
      success: true,
      total: count || 0,
      statusBreakdown: statusCounts,
      filters: {
        dateFrom,
        dateTo,
        subscriptionStatus
      }
    })

  } catch (error) {
    console.error('Error in users dashboard endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al obtener estadísticas de usuarios' 
      },
      { status: 500 }
    )
  }
}