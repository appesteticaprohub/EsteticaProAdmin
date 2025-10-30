import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { sendEmail } from '@/lib/resend'
import type { ApiResponse, BroadcastAudience } from '@/types/admin'

// Helper para guardar logs de email
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

interface EmailBatchRequest {
  title: string
  message?: string
  email_content?: string
  category: 'critical' | 'important' | 'normal' | 'promotional'
  template_id?: string
  template_key?: string
  cta_text?: string
  cta_url?: string
  audience: BroadcastAudience
  batch_size: number
  offset: number
}

interface EmailBatchResponse {
  success: boolean
  emails_sent: number
  emails_failed: number
  processed_so_far: number
  total: number
  has_more: boolean
  next_offset: number
  progress_percentage: number
  errors?: Array<{ email: string; error: string }>
}

// Helper para reemplazar variables
function replaceVariables(text: string | undefined, vars: Record<string, string>): string {
  if (!text) return ''
  let result = text
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  })
  return result
}

// Helper para obtener count de audiencia
async function getAudienceCount(audience: BroadcastAudience): Promise<number> {
  const supabase = await createServerSupabaseAdminClient()
  let query = supabase.from('profiles').select('id', { count: 'exact', head: true })

  switch (audience.type) {
    case 'active':
      query = query.or('subscription_status.ilike.active,subscription_status.ilike.trialing')
      break
    case 'inactive':
      query = query.or('subscription_status.ilike.canceled,subscription_status.ilike.expired,subscription_status.ilike.suspended')
      break
    case 'by_country':
      if (audience.filter) query = query.eq('country', audience.filter)
      break
    case 'by_specialty':
      if (audience.filter) query = query.eq('specialty', audience.filter)
      break
    case 'by_email_list':
      if (audience.email_list && audience.email_list.length > 0) {
        query = query.in('email', audience.email_list)
      }
      break
  }

  const { count } = await query
  return count || 0
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailBatchRequest = await request.json()

    // Validaciones
    if (!body.title || !body.category || !body.audience) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Faltan campos requeridos: title, category, audience'
      }, { status: 400 })
    }

    if (!body.email_content && !body.template_key && !body.template_id) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Se requiere email_content o un template para enviar emails'
      }, { status: 400 })
    }

    if (!body.batch_size || body.batch_size < 1 || body.batch_size > 500) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'batch_size debe estar entre 1 y 500'
      }, { status: 400 })
    }

    if (typeof body.offset !== 'number' || body.offset < 0) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'offset debe ser un número mayor o igual a 0'
      }, { status: 400 })
    }

    // Obtener audiencia completa para calcular total
    const totalUsers = await getAudienceCount(body.audience)

    if (totalUsers === 0) {
      return NextResponse.json<ApiResponse<EmailBatchResponse>>({
        data: {
          success: true,
          emails_sent: 0,
          emails_failed: 0,
          processed_so_far: 0,
          total: 0,
          has_more: false,
          next_offset: 0,
          progress_percentage: 100
        },
        error: null
      })
    }

    // Obtener usuarios del bloque actual
    const supabase = await createServerSupabaseAdminClient()
    let query = supabase
      .from('profiles')
      .select('id, email, full_name')
      .range(body.offset, body.offset + body.batch_size - 1)

    // Aplicar filtros según audiencia
    switch (body.audience.type) {
      case 'active':
        query = query.or('subscription_status.ilike.active,subscription_status.ilike.trialing')
        break
      case 'inactive':
        query = query.or('subscription_status.ilike.canceled,subscription_status.ilike.expired,subscription_status.ilike.suspended')
        break
      case 'by_country':
        if (body.audience.filter) {
          query = query.eq('country', body.audience.filter)
        }
        break
      case 'by_specialty':
        if (body.audience.filter) {
          query = query.eq('specialty', body.audience.filter)
        }
        break
      case 'by_email_list':
        if (body.audience.email_list && body.audience.email_list.length > 0) {
          query = query.in('email', body.audience.email_list)
        }
        break
      case 'all':
      default:
        break
    }

    const { data: users, error: queryError } = await query.order('created_at', { ascending: false })

    if (queryError) {
      throw new Error(`Error obteniendo usuarios: ${queryError.message}`)
    }

    if (!users || users.length === 0) {
      const processedSoFar = body.offset
      return NextResponse.json<ApiResponse<EmailBatchResponse>>({
        data: {
          success: true,
          emails_sent: 0,
          emails_failed: 0,
          processed_so_far: processedSoFar,
          total: totalUsers,
          has_more: false,
          next_offset: body.offset,
          progress_percentage: Math.round((processedSoFar / totalUsers) * 100)
        },
        error: null
      })
    }

    // Enviar emails uno por uno con rate limit
    let emailsSent = 0
    let emailsFailed = 0
    const errors: Array<{ email: string; error: string }> = []

    for (const user of users) {
      try {
        const personalizedTitle = replaceVariables(body.title, {
          nombre: user.full_name || 'Usuario',
          email: user.email
        })

        const personalizedContent = replaceVariables(body.email_content || body.message || '', {
          nombre: user.full_name || 'Usuario',
          email: user.email
        })

        const result = await sendEmail({
          to: user.email,
          subject: personalizedTitle,
          html: personalizedContent,
          templateKey: body.template_key || undefined,
          userId: user.id,
          skipLogging: true  // ← Cambiado a true, lo guardamos manualmente abajo
        })

        // Guardar log manualmente en broadcast (siempre, con o sin template)
        await logEmailSend({
          user_id: user.id,
          template_key: body.template_key || 'broadcast_manual',
          email: user.email,
          status: result.success ? 'sent' : 'failed',
          resend_id: result.success && result.data?.data?.id ? result.data.data.id : null,
          error_message: result.success ? null : (result.error || 'Error desconocido')
        })

        // Verificar si Resend realmente envió el email
        if (result.success) {
          emailsSent++
          console.log(`✅ Email enviado exitosamente: ${user.email}`)
        } else {
          emailsFailed++
          const errorMessage = result.error || 'Error desconocido'
          errors.push({ email: user.email, error: errorMessage })
          console.error(`❌ Email fallido: ${user.email} - ${errorMessage}`)
        }

        // Rate limit: 600ms entre emails (respeta límites de Resend)
        await new Promise(resolve => setTimeout(resolve, 600))

      } catch (error) {
        emailsFailed++
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        errors.push({ email: user.email, error: errorMessage })
        console.error(`❌ Error enviando email a ${user.email}:`, errorMessage)
      }
    }

    const processedSoFar = body.offset + users.length
    const hasMore = processedSoFar < totalUsers
    const nextOffset = hasMore ? body.offset + body.batch_size : body.offset

    console.log(`✅ Bloque procesado: ${emailsSent} enviados, ${emailsFailed} fallidos | Total: ${processedSoFar}/${totalUsers}`)

    return NextResponse.json<ApiResponse<EmailBatchResponse>>({
      data: {
        success: true,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        processed_so_far: processedSoFar,
        total: totalUsers,
        has_more: hasMore,
        next_offset: nextOffset,
        progress_percentage: Math.round((processedSoFar / totalUsers) * 100),
        errors: errors.length > 0 ? errors : undefined
      },
      error: null
    })

  } catch (error) {
    console.error('Error en envío de emails por bloques:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
