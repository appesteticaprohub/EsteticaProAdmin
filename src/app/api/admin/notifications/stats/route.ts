import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// GET - Obtener estadísticas de notificaciones para el dashboard admin
export async function GET() {
  try {
    const supabase = await createServerSupabaseAdminClient()

    // Emails enviados hoy
    const { count: emailsSentToday } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', new Date().toISOString().split('T')[0])

    // Emails enviados esta semana
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { count: emailsSentWeek } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', weekAgo.toISOString())

    // Emails enviados este mes
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    
    const { count: emailsSentMonth } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', monthAgo.toISOString())

    // Notificaciones in-app activas
    const { count: activeNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'in_app')
      .eq('is_read', false)
      .or('expires_at.is.null,expires_at.gt.now()')

    // Emails fallidos recientes (últimas 24 horas)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { count: failedEmails } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('sent_at', yesterday.toISOString())

    // Suscriptores de newsletter (usuarios con email_content = true)
    const { count: newsletterSubscribers } = await supabase
      .from('notification_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('email_content', true)

    return NextResponse.json({
      data: {
        total_sent_today: emailsSentToday || 0,
        total_sent_week: emailsSentWeek || 0,
        total_sent_month: emailsSentMonth || 0,
        active_notifications: activeNotifications || 0,
        failed_emails: failedEmails || 0,
        newsletter_subscribers: newsletterSubscribers || 0
      },
      error: null
    })

  } catch (error) {
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}