import { createServerSupabaseAdminClient } from './server-supabase'
import { sendEmail, EMAIL_CONFIG } from './resend'
import type { 
  BroadcastNotificationRequest, 
  BroadcastResponse, 
  BroadcastAudience,
  Profile 
} from '@/types/admin'

// Servicio principal de notificaciones para broadcast masivo
export class NotificationBroadcastService {
  
  // Obtener audiencia según filtros
  static async getAudience(audience: BroadcastAudience): Promise<Profile[]> {
    const supabase = await createServerSupabaseAdminClient()
    
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, subscription_status, country, specialty, created_at, user_type, birth_date, subscription_expires_at, auto_renewal_enabled')

    // Aplicar filtros según tipo de audiencia
    switch (audience.type) {
      case 'active':
        query = query.or('subscription_status.ilike.active,subscription_status.ilike.trialing')
        break
      case 'inactive':
        query = query.or('subscription_status.ilike.canceled,subscription_status.ilike.expired,subscription_status.ilike.suspended')
        break
      case 'by_country':
        if (audience.filter) {
          query = query.eq('country', audience.filter)
        }
        break
      case 'by_specialty':
        if (audience.filter) {
          query = query.eq('specialty', audience.filter)
        }
        break
      case 'all':
      default:
        // Sin filtros adicionales
        break
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error obteniendo audiencia: ${error.message}`)
    }

    return data || []
  }

  // Contar usuarios en audiencia (para preview)
  static async getAudienceCount(audience: BroadcastAudience): Promise<number> {
    const users = await this.getAudience(audience)
    return users.length
  }

  // Crear notificación in-app masiva
  static async createInAppNotifications(
    users: Profile[],
    notification: Pick<BroadcastNotificationRequest, 'title' | 'message' | 'category' | 'cta_text' | 'cta_url' | 'expires_at'>
  ): Promise<{ success: number; failed: number }> {
    const supabase = await createServerSupabaseAdminClient()
    
    console.log('📝 Creando notificaciones in-app para:', users.length, 'usuarios')
    
    const notifications = users.map(user => {
      // Reemplazar variables en título y mensaje
      const personalizedTitle = this.replaceVariables(notification.title, {
        nombre: user.full_name || 'Usuario',
        email: user.email
      })
      
      const personalizedMessage = this.replaceVariables(notification.message, {
        nombre: user.full_name || 'Usuario',
        email: user.email
      })

      return {
        user_id: user.id,
        type: 'in_app' as const,
        category: notification.category,
        title: personalizedTitle,
        message: personalizedMessage,
        cta_text: notification.cta_text || null,
        cta_url: notification.cta_url || null,
        expires_at: notification.expires_at || null,
        is_read: false
      }
    })

    console.log('📝 Insertando:', notifications)

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id')

    if (error) {
      console.error('❌ Error creando notificaciones in-app:', error)
      return { success: 0, failed: users.length }
    }

    console.log('✅ Notificaciones creadas:', data?.length || 0)

    return { success: data?.length || 0, failed: users.length - (data?.length || 0) }
  }

  // Enviar emails masivos
  static async sendBroadcastEmails(
    users: Profile[],
    notification: Pick<BroadcastNotificationRequest, 'title' | 'message' | 'category' | 'template_id' | 'template_key' | 'cta_text' | 'cta_url'>
  ): Promise<{ success: number; failed: number }> {
    const supabase = await createServerSupabaseAdminClient()
    
    let template = null
    let htmlContent = ''
    let subject = notification.title
    let templateKey = notification.template_key || 'broadcast_custom' // Default si no hay template

    // Si hay template_id, obtener template
    if (notification.template_id) {
      const { data: templateData } = await supabase
        .from('email_templates')
        .select('subject, html_content, template_key')
        .eq('id', notification.template_id)
        .eq('is_active', true)
        .single()
      
      if (templateData) {
        template = templateData
        subject = templateData.subject
        htmlContent = templateData.html_content
        templateKey = templateData.template_key // Usar el template_key del template
      }
    }

    // Si no hay template, usar contenido básico
    if (!template) {
      htmlContent = this.createBasicEmailTemplate(
        notification.title, 
        notification.message,
        notification.cta_text,
        notification.cta_url
      )
    }

    let successCount = 0
    let failedCount = 0
    const emailLogs = []

    // Enviar emails uno por uno (en producción real, usar queue/batch)
    for (const user of users) {
      try {
        // Reemplazar variables en template
        const personalizedHtml = this.replaceVariables(htmlContent, {
          nombre: user.full_name || 'Usuario',
          email: user.email
        })

        const personalizedSubject = this.replaceVariables(subject, {
          nombre: user.full_name || 'Usuario'
        })

        const result = await sendEmail({
          to: user.email,
          subject: personalizedSubject,
          html: personalizedHtml,
          templateKey: 'broadcast',
          userId: user.id
        })

        // Log del envío
        emailLogs.push({
          user_id: user.id,
          template_key: templateKey, // Usar el template_key correcto
          email: user.email,
          status: result.success ? 'sent' : 'failed',
          resend_id: result.data?.data?.id || null,
          error_message: result.error || null
        })

        if (result.success) {
          successCount++
        } else {
          failedCount++
        }

        // Pequeña pausa para no saturar Resend
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error enviando email a ${user.email}:`, error)
        failedCount++
        
        emailLogs.push({
          user_id: user.id,
          template_key: templateKey, // Usar el template_key correcto
          email: user.email,
          status: 'failed',
          resend_id: null,
          error_message: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    // Guardar logs en batch
    if (emailLogs.length > 0) {
      await supabase.from('email_logs').insert(emailLogs)
    }

    return { success: successCount, failed: failedCount }
  }

  // Template básico para emails sin template personalizado
  static createBasicEmailTemplate(title: string, message: string, ctaText?: string, ctaUrl?: string): string {
    const ctaButton = ctaText && ctaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="display: inline-block; padding: 12px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
          ${ctaText}
        </a>
      </div>
    ` : ''

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
              EsteticaProHub
            </h1>
            <h2 style="color: #1f2937;">
              ${title}
            </h2>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            ${ctaButton}
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Hola {{nombre}},<br>
              Este es un mensaje importante de EsteticaProHub.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              © 2025 EsteticaProHub. Todos los derechos reservados.
            </p>
          </div>
        </body>
      </html>
    `
  }

  // Reemplazar variables en templates
  static replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, value)
    })
    
    return result
  }

  // Función principal de broadcast
  static async sendBroadcast(request: BroadcastNotificationRequest): Promise<BroadcastResponse> {
    try {
      // 1. Obtener audiencia
      const users = await this.getAudience(request.audience)
      
      if (users.length === 0) {
        throw new Error('No se encontraron usuarios para la audiencia seleccionada')
      }

      // 2. Crear job_id para tracking
      const jobId = `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 3. Enviar según tipo
      const results = {
        inApp: { success: 0, failed: 0 },
        email: { success: 0, failed: 0 }
      }

      if (request.type === 'in_app' || request.type === 'both') {
        results.inApp = await this.createInAppNotifications(users, request)
      }

      if (request.type === 'email' || request.type === 'both') {
        results.email = await this.sendBroadcastEmails(users, request)
      }

      return {
        job_id: jobId,
        total_recipients: users.length,
        email_count: results.email.success,
        notification_count: results.inApp.success,
        estimated_time: `${Math.ceil(users.length / 10)} minutos`,
        status: 'completed'
      }

    } catch (error) {
      console.error('Error en broadcast:', error)
      throw error
    }
  }

  // Enviar notificación de cambio de precio
  static async sendPriceChangeNotification(newPrice: string) {
    try {
      const supabase = await createServerSupabaseAdminClient()

      // Obtener todos los usuarios activos
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, subscription_status')
        .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period'])

      if (error || !users) {
        throw new Error('Error obteniendo usuarios activos')
      }

      const results = {
        emails_sent: 0,
        notifications_created: 0,
        errors: 0,
        total_users: users.length
      }

      // Crear notificaciones in-app críticas (7 días de duración)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      type UserForNotification = {
        id: string
        email: string
        full_name: string | null
        subscription_status: string
      }

      const notifications = users.map((user: UserForNotification) => ({
        user_id: user.id,
        type: 'in_app' as const,
        category: 'critical' as const,
        title: 'Actualización de Precios',
        message: `El precio de suscripción ha sido actualizado a $${newPrice}. Este cambio será efectivo para nuevas suscripciones y renovaciones.`,
        cta_text: null,
        cta_url: null,
        expires_at: expiresAt,
        is_read: false
      }))

      console.log('📝 Intentando crear notificaciones in-app para:', users.length, 'usuarios')
      console.log('📝 Notificaciones a insertar:', notifications)

      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .insert(notifications)
        .select('id')

      if (notifError) {
        console.error('❌ Error insertando notificaciones:', notifError)
      } else {
        console.log('✅ Notificaciones insertadas:', notifData?.length || 0)
      }

      if (!notifError && notifData) {
        results.notifications_created = notifData.length
      }

      // Enviar emails a cada usuario
      for (const user of users) {
        try {
          const htmlContent = this.createPriceChangeEmail(
            user.full_name || 'Usuario',
            newPrice
          )

          const emailResult = await sendEmail({
            to: user.email,
            subject: 'Actualización Importante: Cambio de Precio',
            html: htmlContent,
            templateKey: 'price_change',
            userId: user.id
          })

          if (emailResult.success) {
            results.emails_sent++
          } else {
            results.errors++
          }

          // Pausa breve entre envíos
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`Error enviando notificación a usuario ${user.id}:`, error)
          results.errors++
        }
      }

      return { success: true, data: results, error: null }

    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  // Template para email de cambio de precio
  static createPriceChangeEmail(userName: string, newPrice: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Actualización de Precio</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
              EsteticaProHub
            </h1>
            <h2 style="color: #1f2937;">
              Actualización Importante: Cambio de Precio
            </h2>
            <p>Hola ${userName},</p>
            <div style="background: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-weight: 600; color: #92400e;">
                Te informamos que el precio de suscripción ha sido actualizado a <strong>$${newPrice} USD</strong>.
              </p>
            </div>
            <p>Este cambio será efectivo para:</p>
            <ul style="color: #4b5563;">
              <li>Nuevas suscripciones</li>
              <li>Renovaciones de suscripciones existentes</li>
            </ul>
            <p>Si tienes una suscripción activa, el nuevo precio se aplicará en tu próxima fecha de renovación.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              Gracias por ser parte de nuestra comunidad de profesionales de la estética.
            </p>
            <p style="color: #9ca3af; font-size: 12px;">
              © 2025 EsteticaProHub. Todos los derechos reservados.
            </p>
          </div>
        </body>
      </html>
    `
  }
}