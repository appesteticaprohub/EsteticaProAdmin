import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import type { ApiResponse, DetailedStats } from '@/types/admin'

// GET - Obtener estadísticas detalladas de notificaciones para el dashboard admin
export async function GET() {
  try {
    const supabase = await createServerSupabaseAdminClient()
    
    // Fechas para filtros
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(now)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    // === ESTADÍSTICAS DE EMAILS ===
    
    // Emails enviados hoy
    const { count: emailsSentToday } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', today.toISOString())

    // Emails enviados esta semana
    const { count: emailsSentWeek } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', weekAgo.toISOString())

    // Emails enviados este mes
    const { count: emailsSentMonth } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', monthAgo.toISOString())

    // Emails fallidos hoy
    const { count: emailsFailedToday } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('sent_at', today.toISOString())

    // Total emails para calcular tasa de éxito
    const { count: totalEmails } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })

    // === ESTADÍSTICAS DE NOTIFICACIONES ===
    
    // Notificaciones activas (no leídas y no expiradas)
    const { count: activeNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .or('expires_at.is.null,expires_at.gt.now()')

    // Notificaciones leídas
    const { count: readNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', true)

    // Notificaciones no leídas
    const { count: unreadNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)

    // Notificaciones críticas activas
    const { count: criticalNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'critical')
      .eq('is_read', false)

    // === ESTADÍSTICAS DE TEMPLATES ===
    
    // Templates más utilizados (top 5)
    const { data: templateUsage } = await supabase
      .from('email_logs')
      .select('template_key')
      .not('template_key', 'is', null)

    const templateCounts = templateUsage?.reduce((acc: Record<string, number>, log) => {
      acc[log.template_key] = (acc[log.template_key] || 0) + 1
      return acc
    }, {}) || {}

    const mostUsedTemplates = Object.entries(templateCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([template]) => template)

    // Total templates activos
    const { count: totalTemplates } = await supabase
      .from('email_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // === ESTADÍSTICAS DE USUARIOS ===
    
    // Suscriptores de newsletter
    const { count: newsletterSubscribers } = await supabase
      .from('notification_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('email_content', true)

    // Suscriptores promocionales
    const { count: promotionalSubscribers } = await supabase
      .from('notification_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('email_promotional', true)

    // Total usuarios
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Calcular tasa de éxito de emails
    const successfulEmails = (totalEmails || 0) - (emailsFailedToday || 0)
    const successRate = totalEmails ? Math.round((successfulEmails / totalEmails) * 100) : 100

    // Construir respuesta
    const stats: DetailedStats = {
      emails: {
        sent_today: emailsSentToday || 0,
        sent_this_week: emailsSentWeek || 0,
        sent_this_month: emailsSentMonth || 0,
        failed_today: emailsFailedToday || 0,
        success_rate: successRate
      },
      notifications: {
        active_count: activeNotifications || 0,
        read_count: readNotifications || 0,
        unread_count: unreadNotifications || 0,
        critical_count: criticalNotifications || 0
      },
      templates: {
        most_used: mostUsedTemplates,
        total_templates: totalTemplates || 0
      },
      users: {
        newsletter_subscribers: newsletterSubscribers || 0,
        promotional_subscribers: promotionalSubscribers || 0,
        total_users: totalUsers || 0
      }
    }

    return NextResponse.json<ApiResponse<DetailedStats>>({
      data: stats,
      error: null
    })

  } catch (error) {
    console.error('Error en stats API:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}