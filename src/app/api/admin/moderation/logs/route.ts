import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// Interfaces para tipar los datos de Supabase
interface ModerationLogFromDB {
  id: string
  admin_id: string
  action_type: 'ban_user' | 'unban_user' | 'delete_post' | 'delete_comment' | 'approve_post' | 'restore_post' | 'restore_comment'
  target_type: 'user' | 'post' | 'comment'
  target_id: string
  reason: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface AdminFromDB {
  id: string
  full_name: string | null
  email: string
}

interface ModerationLogWithAdmin extends ModerationLogFromDB {
  admin: AdminFromDB | null
}

export async function GET(request: NextRequest) {
  try {
    // Verificar que el usuario autenticado es admin
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No active session' },
        { status: 401 }
      )
    }

    const { data: adminProfile, error: adminError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

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
    const adminIds = (logs as ModerationLogFromDB[] | null)?.map((log) => log.admin_id).filter(Boolean) || []
    const uniqueAdminIds = [...new Set(adminIds)]
    
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uniqueAdminIds)

    // Mapear admins a logs
    const logsWithAdmins: ModerationLogWithAdmin[] = (logs as ModerationLogFromDB[] | null)?.map((log) => ({
      ...log,
      admin: (admins as AdminFromDB[] | null)?.find((a) => a.id === log.admin_id) || null
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

export async function DELETE(request: NextRequest) {
  try {
    // Verificar que el usuario autenticado es admin
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No active session' },
        { status: 401 }
      )
    }

    const { data: adminProfile, error: adminError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { log_ids } = body

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'log_ids array is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()

    // Eliminar los logs de moderación
    const { error: deleteError, count } = await supabase
      .from('moderation_logs')
      .delete({ count: 'exact' })
      .in('id', log_ids)

    if (deleteError) {
      console.error('Error deleting moderation logs:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete moderation logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: count || 0
      }
    })

  } catch (error) {
    console.error('Error in DELETE moderation logs:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}