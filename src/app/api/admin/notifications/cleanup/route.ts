import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

interface CleanupFilters {
  date_before?: string;
  category?: 'critical' | 'important' | 'normal' | 'promotional';
  type?: 'email' | 'in_app';
  is_read?: boolean;
}

interface CleanupPreview {
  notifications_count: number;
  email_logs_count: number;
  breakdown: {
    by_category: Record<string, number>;
    by_type: Record<string, number>;
    by_read_status: { read: number; unread: number };
  };
}

// GET - Preview de limpieza (cuántos registros se eliminarán)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const filters: CleanupFilters = {
      date_before: searchParams.get('date_before') || undefined,
      category: searchParams.get('category') as any || undefined,
      type: searchParams.get('type') as any || undefined,
      is_read: searchParams.get('is_read') ? searchParams.get('is_read') === 'true' : undefined,
    }

    console.log('GET Filters recibidos:', filters)

    if (!filters.date_before) {
      return NextResponse.json({
        data: null,
        error: 'Se requiere el parámetro date_before'
      }, { status: 400 })
    }

    const supabase = await createServerSupabaseAdminClient()

    // Query para notificaciones
    let notificationsQuery = supabase
      .from('notifications')
      .select('id, category, type, is_read')
      .lt('created_at', filters.date_before)

    if (filters.category) {
      notificationsQuery = notificationsQuery.eq('category', filters.category)
    }
    console.log('Query con category:', filters.category)
    if (filters.type) {
      notificationsQuery = notificationsQuery.eq('type', filters.type)
    }
    if (filters.is_read !== undefined) {
      notificationsQuery = notificationsQuery.eq('is_read', filters.is_read)
    }

    console.log('Ejecutando query de notificaciones con filtros:', {
      date_before: filters.date_before,
      category: filters.category,
      type: filters.type,
      is_read: filters.is_read
    })

    const { data: notifications, error: notifError } = await notificationsQuery

    if (notifError) {
      throw new Error(`Error obteniendo notificaciones: ${notifError.message}`)
    }

    console.log('Notificaciones encontradas:', notifications?.length)
    console.log('Primeras 3 notificaciones:', notifications?.slice(0, 3))

    // Query para email logs
    let emailLogsQuery = supabase
      .from('email_logs')
      .select('id')
      .lt('sent_at', filters.date_before)

    const { data: emailLogs, error: emailError } = await emailLogsQuery

    if (emailError) {
      throw new Error(`Error obteniendo email logs: ${emailError.message}`)
    }

    // Calcular breakdown
    const byCategory: Record<string, number> = {}
    const byType: Record<string, number> = {}
    let readCount = 0
    let unreadCount = 0

    notifications?.forEach(notif => {
      byCategory[notif.category] = (byCategory[notif.category] || 0) + 1
      byType[notif.type] = (byType[notif.type] || 0) + 1
      if (notif.is_read) readCount++
      else unreadCount++
    })

    const preview: CleanupPreview = {
      notifications_count: notifications?.length || 0,
      email_logs_count: emailLogs?.length || 0,
      breakdown: {
        by_category: byCategory,
        by_type: byType,
        by_read_status: { read: readCount, unread: unreadCount }
      }
    }

    return NextResponse.json({
      data: preview,
      error: null
    })

  } catch (error) {
    console.error('Error en cleanup preview:', error)
    
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

// DELETE - Ejecutar limpieza
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    
    const filters: CleanupFilters = {
      date_before: body.date_before,
      category: body.category && body.category !== 'all' ? body.category : undefined,
      type: body.type && body.type !== 'all' ? body.type : undefined,
      is_read: body.is_read && body.is_read !== 'all' ? body.is_read : undefined,
    }

    if (!filters.date_before) {
      return NextResponse.json({
        data: null,
        error: 'Se requiere el parámetro date_before'
      }, { status: 400 })
    }

    const supabase = await createServerSupabaseAdminClient()

    // Eliminar notificaciones
    let notificationsQuery = supabase
      .from('notifications')
      .delete()
      .lt('created_at', filters.date_before)

    if (filters.category) {
      notificationsQuery = notificationsQuery.eq('category', filters.category)
    }
    if (filters.type) {
      notificationsQuery = notificationsQuery.eq('type', filters.type)
    }
    if (filters.is_read !== undefined) {
      notificationsQuery = notificationsQuery.eq('is_read', filters.is_read)
    }

    const { error: notifError, count: notifCount } = await notificationsQuery.select('*')

    if (notifError) {
      throw new Error(`Error eliminando notificaciones: ${notifError.message}`)
    }

    // Eliminar email logs (solo por fecha, sin otros filtros)
    const { error: emailError, count: emailCount } = await supabase
      .from('email_logs')
      .delete()
      .lt('sent_at', filters.date_before)
      .select('*')

    if (emailError) {
      throw new Error(`Error eliminando email logs: ${emailError.message}`)
    }

    return NextResponse.json({
      data: {
        notifications_deleted: notifCount || 0,
        email_logs_deleted: emailCount || 0,
        total_deleted: (notifCount || 0) + (emailCount || 0)
      },
      error: null
    })

  } catch (error) {
    console.error('Error ejecutando limpieza:', error)
    
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}