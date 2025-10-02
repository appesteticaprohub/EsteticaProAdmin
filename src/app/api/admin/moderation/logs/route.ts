import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Parámetros de filtros
    const actionType = searchParams.get('actionType') // 'ban_user', 'delete_post', etc.
    const targetType = searchParams.get('targetType') // 'user', 'post', 'comment'
    const adminId = searchParams.get('adminId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const supabase = createServerSupabaseAdminClient()

    // Construir query base
    let query = supabase
      .from('moderation_logs')
      .select('*', { count: 'exact' })

    // Aplicar filtros
    if (actionType) {
      query = query.eq('action_type', actionType)
    }

    if (targetType) {
      query = query.eq('target_type', targetType)
    }

    if (adminId) {
      query = query.eq('admin_id', adminId)
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Ordenar por más recientes primero
    query = query.order('created_at', { ascending: false })

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) {
      console.error('Error fetching moderation logs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch moderation logs' },
        { status: 500 }
      )
    }

    // Obtener información de admins
    const adminIds = logs?.map((log: any) => log.admin_id).filter(Boolean) || []
    const uniqueAdminIds = [...new Set(adminIds)]
    
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uniqueAdminIds)

    // Mapear admins a logs
    const logsWithAdmins = logs?.map((log: any) => ({
      ...log,
      admin: admins?.find((a: any) => a.id === log.admin_id) || null
    })) || []

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: logsWithAdmins,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: count || 0,
        limit: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in moderation logs endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}