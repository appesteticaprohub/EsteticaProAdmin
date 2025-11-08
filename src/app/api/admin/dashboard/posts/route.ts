// src/app/api/admin/dashboard/posts/route.ts

import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const postStatus = searchParams.get('postStatus') || 'all'

    const supabase = createServerSupabaseAdminClient()

    // ========== QUERY OPTIMIZADA: Solo traer is_deleted y created_at ==========
    let query = supabase
      .from('posts')
      .select('is_deleted, created_at', { count: 'exact', head: false })

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

    // Aplicar filtro de estado del post
    if (postStatus === 'active') {
      query = query.eq('is_deleted', false)
    } else if (postStatus === 'deleted') {
      query = query.eq('is_deleted', true)
    }
    // Si es 'all', no aplicamos filtro de is_deleted

    // Ejecutar query
    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching posts:', error)
      throw error
    }

    // Contar posts por estado de forma eficiente
    let activeCount = 0
    let deletedCount = 0
    
    if (data) {
      data.forEach((post: { is_deleted: boolean }) => {
        if (post.is_deleted) {
          deletedCount++
        } else {
          activeCount++
        }
      })
    }

    // Calcular promedio de posts por día si hay rango de fechas
    let averagePerDay = 0
    if (dateFrom && dateTo && count && count > 0) {
      const startDate = new Date(dateFrom)
      const endDate = new Date(dateTo)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      averagePerDay = count / daysDiff
    }

    return NextResponse.json({
      success: true,
      total: count || 0,
      statusBreakdown: {
        active: activeCount,
        deleted: deletedCount
      },
      averagePerDay: averagePerDay > 0 ? parseFloat(averagePerDay.toFixed(2)) : 0,
      filters: {
        dateFrom,
        dateTo,
        postStatus
      }
    })

  } catch (error) {
    console.error('Error in posts dashboard endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al obtener estadísticas de posts' 
      },
      { status: 500 }
    )
  }
}