import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY no está configurado')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Configuración base para emails
export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'EsteticaProHub <onboarding@resend.dev>',
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

// Función principal para enviar emails (versión simplificada para admin)
export async function sendEmail(options: SendEmailOptions) {
  try {
    const response = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    return {
      success: true,
      data: response,
      error: null
    }

  } catch (error) {
    console.error('Error enviando email:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}