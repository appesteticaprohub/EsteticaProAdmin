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
    const statusParam = searchParams.get('status')
    
    const filters: LogsFilters = {
      type: 'email', // Siempre email
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

    // Construir query para email logs
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

    // Primero obtener el conteo total con los filtros aplicados
    let countQuery = supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
    
    // Aplicar los mismos filtros que a la consulta de datos
    if (filters.status) {
      countQuery = countQuery.eq('status', filters.status)
    }
    if (filters.user_email) {
      countQuery = countQuery.ilike('email', `%${filters.user_email}%`)
    }
    if (filters.template_key) {
      countQuery = countQuery.eq('template_key', filters.template_key)
    }
    if (filters.date_from) {
      countQuery = countQuery.gte('sent_at', filters.date_from)
    }
    if (filters.date_to) {
      const dateToEndOfDay = `${filters.date_to}T23:59:59.999Z`
      countQuery = countQuery.lte('sent_at', dateToEndOfDay)
    }
    
    const { count } = await countQuery
    const emailCount = count || 0

    // Ahora obtener los datos con paginación
    const { data: emailData, error: emailError } = await emailQuery
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

    const emailLogs = emailData?.map((log: EmailLog) => {
      const userProfile = userMap.get(log.user_id)
      return {
        ...log,
        user: userProfile ? {
          full_name: userProfile.full_name,
          subscription_status: userProfile.subscription_status || 'unknown'
        } : undefined
      }
    }) || []

    // Calcular estadísticas resumidas de forma optimizada
    const { count: totalEmailsCount } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })

    const { count: successfulEmailsCount } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')

    const { count: failedEmailsCount } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')

    const totalEmails = totalEmailsCount || 0
    const successfulEmails = successfulEmailsCount || 0
    const failedEmails = failedEmailsCount || 0

    // Calcular paginación
    const totalPages = Math.ceil(emailCount / filters.limit!)

    const response: LogsResponse = {
      email_logs: emailLogs,
      notifications: [], // Vacío - ya no se usan
      pagination: {
        total_records: emailCount,
        total_pages: totalPages,
        current_page: filters.page!,
        has_next: filters.page! < totalPages,
        has_prev: filters.page! > 1
      },
      summary: {
        total_emails: totalEmails,
        successful_emails: successfulEmails,
        failed_emails: failedEmails,
        total_notifications: 0
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