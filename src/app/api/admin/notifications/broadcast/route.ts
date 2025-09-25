import { NextRequest, NextResponse } from 'next/server'
import { NotificationBroadcastService } from '@/lib/notification-service'
import type { BroadcastNotificationRequest, ApiResponse, BroadcastResponse } from '@/types/admin'

export async function POST(request: NextRequest) {
  try {
    const body: BroadcastNotificationRequest = await request.json()

    // Validación básica
    if (!body.title || !body.message || !body.type || !body.category) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Faltan campos requeridos: title, message, type, category'
      }, { status: 400 })
    }

    if (!body.audience || !body.audience.type) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Audiencia es requerida'
      }, { status: 400 })
    }

    // Validar tipos permitidos
    const validTypes = ['email', 'in_app', 'both']
    if (!validTypes.includes(body.type)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Tipo debe ser: email, in_app o both'
      }, { status: 400 })
    }

    const validCategories = ['critical', 'important', 'normal', 'promotional']
    if (!validCategories.includes(body.category)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Categoría debe ser: critical, important, normal o promotional'
      }, { status: 400 })
    }

    const validAudienceTypes = ['all', 'active', 'inactive', 'by_country', 'by_specialty']
    if (!validAudienceTypes.includes(body.audience.type)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Tipo de audiencia debe ser: all, active, inactive, by_country o by_specialty'
      }, { status: 400 })
    }

    // Validar filtros de audiencia
    if ((body.audience.type === 'by_country' || body.audience.type === 'by_specialty') && !body.audience.filter) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: `Filtro es requerido para audiencia tipo ${body.audience.type}`
      }, { status: 400 })
    }

    // Ejecutar broadcast
    const result = await NotificationBroadcastService.sendBroadcast(body)

    return NextResponse.json<ApiResponse<BroadcastResponse>>({
      data: result,
      error: null
    })

  } catch (error) {
    console.error('Error en broadcast API:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

// GET: Obtener preview de audiencia (sin enviar)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const audienceType = searchParams.get('audience_type')
    const audienceFilter = searchParams.get('audience_filter')

    if (!audienceType) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'audience_type es requerido'
      }, { status: 400 })
    }

    const validAudienceTypes = ['all', 'active', 'inactive', 'by_country', 'by_specialty']
    if (!validAudienceTypes.includes(audienceType)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'audience_type inválido'
      }, { status: 400 })
    }

    const audience = {
      type: audienceType as any,
      filter: audienceFilter || undefined
    }

    const count = await NotificationBroadcastService.getAudienceCount(audience)

    return NextResponse.json<ApiResponse<{ count: number }>>({
      data: { count },
      error: null
    })

  } catch (error) {
    console.error('Error obteniendo preview de audiencia:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}