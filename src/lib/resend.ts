import { Resend } from 'resend'
import { createServerSupabaseAdminClient } from './server-supabase'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY no está configurado')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Configuración base para emails
export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'EsteticaProHub <onboarding@resend.dev>',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
}

// Tipo para la respuesta de Resend
interface ResendResponse {
  data?: {
    id?: string
  } | null
  error?: string | Record<string, unknown> | null
}

// Tipos para el envío de emails
export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  templateKey?: string
  userId?: string
  skipLogging?: boolean  // 👈 NUEVO: Permite omitir el logging automático
}

export async function sendEmail(options: SendEmailOptions) {
  try {
    const response = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    
    // Resend puede devolver response.data o response.error
    const responseData = response as ResendResponse
    
    // Verificar si Resend devolvió un error
    if (responseData.error) {
      console.error('❌ Resend error:', responseData.error)
      
      // Log del error si se proporciona la información y NO se ha saltado el logging
      if (options.templateKey && options.userId && !options.skipLogging) {
        await logEmailSend({
          user_id: options.userId,
          template_key: options.templateKey,
          email: options.to,
          status: 'failed',
          error_message: typeof responseData.error === 'string' 
            ? responseData.error 
            : JSON.stringify(responseData.error)
        })
      }
      
      return {
        success: false,
        data: response,
        error: typeof responseData.error === 'string' 
          ? responseData.error 
          : JSON.stringify(responseData.error)
      }
    }
    
    // Éxito real
    console.log('✅ Email enviado exitosamente:', responseData.data?.id)
    
    // Log del envío en la base de datos si se proporciona templateKey y userId
    if (options.templateKey && options.userId && !options.skipLogging) {
      await logEmailSend({
        user_id: options.userId,
        template_key: options.templateKey,
        email: options.to,
        status: 'sent',
        resend_id: responseData.data?.id || null
      })
    }
    
    return {
      success: true,
      data: response,
      error: null
    }
  } catch (error) {
    console.error('❌ Excepción enviando email:', error)
    
    // Log del error si se proporciona la información y NO se ha saltado el logging
    if (options.templateKey && options.userId && !options.skipLogging) {
      await logEmailSend({
        user_id: options.userId,
        template_key: options.templateKey,
        email: options.to,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Error desconocido'
      })
    }
    
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// Función para registrar el envío de email en la base de datos
async function logEmailSend(logData: {
  user_id: string
  template_key: string
  email: string
  status: 'sent' | 'failed' | 'delivered'
  resend_id?: string | null
  error_message?: string | null
}) {
  try {
    const supabase = await createServerSupabaseAdminClient()
    
    const { error } = await supabase.from('email_logs').insert(logData)
    
    if (error) {
      console.error('❌ Error guardando log de email:', error)
    }
  } catch (error) {
    console.error('❌ Error en logEmailSend:', error)
  }
}