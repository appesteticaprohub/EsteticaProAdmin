import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { NotificationBroadcastService } from '@/lib/notification-service'
import type { ApiResponse, BroadcastAudience } from '@/types/admin'

interface InAppBatchRequest {
  title: string
  message: string
  category: 'critical' | 'important' | 'normal' | 'promotional'
  cta_text?: string
  cta_url?: string
  expires_at?: string
  audience: BroadcastAudience
  batch_size: number
  offset: number
}

interface InAppBatchResponse {
  success: boolean
  created: number
  failed: number
  processed_so_far: number
  total: number
  has_more: boolean
  next_offset: number
  progress_percentage: number
}

export async function POST(request: NextRequest) {
  try {
    const body: InAppBatchRequest = await request.json()

    // Validaciones
    if (!body.title || !body.message || !body.category || !body.audience) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Faltan campos requeridos: title, message, category, audience'
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
    const totalUsers = await NotificationBroadcastService.getAudienceCount(body.audience)

    if (totalUsers === 0) {
      return NextResponse.json<ApiResponse<InAppBatchResponse>>({
        data: {
          success: true,
          created: 0,
          failed: 0,
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
      return NextResponse.json<ApiResponse<InAppBatchResponse>>({
        data: {
          success: true,
          created: 0,
          failed: 0,
          processed_so_far: processedSoFar,
          total: totalUsers,
          has_more: false,
          next_offset: body.offset,
          progress_percentage: Math.round((processedSoFar / totalUsers) * 100)
        },
        error: null
      })
    }

    // Crear notificaciones in-app
    const notifications = users.map(user => ({
      user_id: user.id,
      type: 'in_app' as const,
      category: body.category,
      title: body.title.replace('{{nombre}}', user.full_name || 'Usuario').replace('{{email}}', user.email),
      message: body.message.replace('{{nombre}}', user.full_name || 'Usuario').replace('{{email}}', user.email),
      cta_text: body.cta_text || null,
      cta_url: body.cta_url || null,
      expires_at: body.expires_at || null,
      is_read: false
    }))

    const { data: created, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id')

    const createdCount = created?.length || 0
    const failedCount = users.length - createdCount
    const processedSoFar = body.offset + users.length
    const hasMore = processedSoFar < totalUsers
    const nextOffset = hasMore ? body.offset + body.batch_size : body.offset

    if (insertError) {
      console.error('❌ Error creando notificaciones in-app:', insertError)
    }

    console.log(`✅ Bloque procesado: ${createdCount}/${users.length} creadas | Total: ${processedSoFar}/${totalUsers}`)

    return NextResponse.json<ApiResponse<InAppBatchResponse>>({
      data: {
        success: true,
        created: createdCount,
        failed: failedCount,
        processed_so_far: processedSoFar,
        total: totalUsers,
        has_more: hasMore,
        next_offset: nextOffset,
        progress_percentage: Math.round((processedSoFar / totalUsers) * 100)
      },
      error: null
    })

  } catch (error) {
    console.error('Error en envío de notificaciones in-app por bloques:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
