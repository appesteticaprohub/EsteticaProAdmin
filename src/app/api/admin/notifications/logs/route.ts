import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import type { ApiResponse, LogsResponse, LogsFilters, EmailLog, Notification } from '@/types/admin'

interface UserProfile {
  id: string
  full_name: string | null
  subscription_status?: string
  email?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parsear filtros de la query string
    const typeParam = searchParams.get('type') || 'all'
    const statusParam = searchParams.get('status')
    
    const filters: LogsFilters = {
      type: typeParam as 'email' | 'notification' | 'all',
      status: statusParam ? statusParam as 'sent' | 'failed' | 'delivered' : undefined,
      user_email: searchParams.get('user_email') || undefined,
      template_key: searchParams.get('template_key') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    }

    // Validaciones
    if (filters.page! < 1) filters.page = 1
    if (filters.limit! < 1 || filters.limit! > 100) filters.limit = 50

    const supabase = await createServerSupabaseAdminClient()
    const offset = (filters.page! - 1) * filters.limit!

    // Obtener email logs
    let emailLogs: EmailLog[] = []
    let emailCount = 0
    
    if (filters.type === 'email' || filters.type === 'all') {
      let emailQuery = supabase
        .from('email_logs')
        .select('*')

      // Aplicar filtros de email
      if (filters.status) {
        emailQuery = emailQuery.eq('status', filters.status)
      }
      if (filters.user_email) {
        emailQuery = emailQuery.ilike('email', `%${filters.user_email}%`)
      }
      if (filters.template_key) {
        emailQuery = emailQuery.eq('template_key', filters.template_key)
      }
      if (filters.date_from) {
        emailQuery = emailQuery.gte('sent_at', filters.date_from)
      }
      if (filters.date_to) {
        // Agregar 23:59:59 al final del día para incluir todo el día
        const dateToEndOfDay = `${filters.date_to}T23:59:59.999Z`
        emailQuery = emailQuery.lte('sent_at', dateToEndOfDay)
      }

      // Obtener datos con paginación
      const { data: emailData, error: emailError, count } = await emailQuery
        .order('sent_at', { ascending: false })
        .range(offset, offset + filters.limit! - 1)

      if (emailError) {
        throw new Error(`Error obteniendo email logs: ${emailError.message}`)
      }

      // Obtener datos de usuarios para email logs
      const userIds = [...new Set(emailData?.map((log: EmailLog) => log.user_id) || [])]
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, subscription_status')
        .in('id', userIds)

      const userMap = new Map(users?.map((user: UserProfile) => [user.id, user]) || [])

      emailLogs = emailData?.map((log: EmailLog) => {
        const userProfile = userMap.get(log.user_id)
        return {
          ...log,
          user: userProfile ? {
            full_name: userProfile.full_name,
            subscription_status: userProfile.subscription_status || 'unknown'
          } : undefined
        }
      }) || []

      emailCount = count || 0
    }

    // Obtener notificaciones
    let notifications: Notification[] = []
    let notificationCount = 0

    if (filters.type === 'notification' || filters.type === 'all') {
      let notificationQuery = supabase
        .from('notifications')
        .select('*')

      // Aplicar filtros de fecha
      if (filters.date_from) {
        notificationQuery = notificationQuery.gte('created_at', filters.date_from)
      }
      if (filters.date_to) {
        // Agregar 23:59:59 al final del día para incluir todo el día
        const dateToEndOfDay = `${filters.date_to}T23:59:59.999Z`
        notificationQuery = notificationQuery.lte('created_at', dateToEndOfDay)
      }

      const { data: notificationData, error: notificationError, count } = await notificationQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + filters.limit! - 1)

      if (notificationError) {
        throw new Error(`Error obteniendo notificaciones: ${notificationError.message}`)
      }

      // Obtener datos de usuarios para notificaciones
      const userIds = [...new Set(notificationData?.map((notif: Notification) => notif.user_id) || [])]
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const userMap = new Map(users?.map((user: UserProfile) => [user.id, user]) || [])

      notifications = notificationData?.map((notif: Notification) => {
        const userProfile = userMap.get(notif.user_id)
        return {
          ...notif,
          user: userProfile ? {
            full_name: userProfile.full_name,
            email: userProfile.email || ''
          } : undefined
        }
      }) || []

      // Filtrar por email si se especifica
      if (filters.user_email) {
        notifications = notifications.filter(notif => 
          notif.user?.email?.toLowerCase().includes(filters.user_email!.toLowerCase())
        )
      }

      notificationCount = count || 0
    }

    // Calcular estadísticas resumidas
    const { data: emailStats } = await supabase
      .from('email_logs')
      .select('status')

    const { data: notificationStats } = await supabase
      .from('notifications')
      .select('id')

    const totalEmails = emailStats?.length || 0
    const successfulEmails = emailStats?.filter((log: { status: string }) => log.status === 'sent').length || 0
    const failedEmails = emailStats?.filter((log: { status: string }) => log.status === 'failed').length || 0

    // Calcular paginación
    const totalRecords = filters.type === 'all' ? emailCount + notificationCount : 
                        filters.type === 'email' ? emailCount : notificationCount
    const totalPages = Math.ceil(totalRecords / filters.limit!)

    const response: LogsResponse = {
      email_logs: emailLogs,
      notifications: notifications,
      pagination: {
        total_records: totalRecords,
        total_pages: totalPages,
        current_page: filters.page!,
        has_next: filters.page! < totalPages,
        has_prev: filters.page! > 1
      },
      summary: {
        total_emails: totalEmails,
        successful_emails: successfulEmails,
        failed_emails: failedEmails,
        total_notifications: notificationStats?.length || 0
      }
    }

    return NextResponse.json<ApiResponse<LogsResponse>>({
      data: response,
      error: null
    })

  } catch (error) {
    console.error('Error en logs API:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { log_ids, type } = body

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Se requiere un array de IDs para eliminar'
      }, { status: 400 })
    }

    if (!type || (type !== 'email' && type !== 'notification')) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Se requiere especificar el tipo: email o notification'
      }, { status: 400 })
    }

    const supabase = await createServerSupabaseAdminClient()
    
    if (type === 'email') {
      // Eliminar email logs
      const { error } = await supabase
        .from('email_logs')
        .delete()
        .in('id', log_ids)

      if (error) {
        throw new Error(`Error eliminando email logs: ${error.message}`)
      }
    } else if (type === 'notification') {
      // Eliminar notificaciones
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', log_ids)

      if (error) {
        throw new Error(`Error eliminando notificaciones: ${error.message}`)
      }
    }

    return NextResponse.json<ApiResponse<{ deleted_count: number }>>({
      data: { deleted_count: log_ids.length },
      error: null
    })

  } catch (error) {
    console.error('Error eliminando logs:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}