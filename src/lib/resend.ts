import { Resend } from 'resend'
import { createServerSupabaseAdminClient } from './server-supabase'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY no está configurado')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Detectar ambiente
const isProduction = process.env.NODE_ENV === 'production' && 
                     process.env.NEXT_PUBLIC_APP_URL?.includes('estetica-pro-admin-672420pt9-appesteticaprohubs-projects.vercel.app')

// Configuración base para emails
export const EMAIL_CONFIG = {
  from: isProduction 
    ? 'EsteticaProHub <noreply@esteticaprohub.com>'
    : process.env.RESEND_FROM_EMAIL || 'EsteticaProHub <onboarding@resend.dev>',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
}

// Tipos para el envío de emails
export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  templateKey?: string
  userId?: string
}

// Función principal para enviar emails
export async function sendEmail(options: SendEmailOptions) {
  try {
    const response = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    // Log del envío en la base de datos si se proporciona templateKey y userId
    if (options.templateKey && options.userId) {
      await logEmailSend({
        user_id: options.userId,
        template_key: options.templateKey,
        email: options.to,
        status: 'sent',
        resend_id: response.data?.id || null
      })
    }

    return {
      success: true,
      data: response,
      error: null
    }
  } catch (error) {
    console.error('Error enviando email:', error)
    
    // Log del error si se proporciona la información
    if (options.templateKey && options.userId) {
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