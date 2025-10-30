import { NextRequest, NextResponse } from 'next/server'
import { NotificationBroadcastService } from '@/lib/notification-service'
import type { BroadcastNotificationRequest, ApiResponse, BroadcastResponse, BroadcastAudience } from '@/types/admin'

export async function POST(request: NextRequest) {
  try {
    const body: BroadcastNotificationRequest = await request.json()

    // Validación básica
    if (!body.title || !body.type || !body.category) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Faltan campos requeridos: title, type, category'
      }, { status: 400 })
    }

    // NOTA: Ya no validamos message aquí porque este endpoint solo calcula audiencia.
    // La validación de message se hace en el endpoint send-inapp-batch

    // NOTA: Ya no validamos email_content aquí porque este endpoint solo calcula audiencia.
    // La validación de email_content se hace en el endpoint send-email-batch

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

    const validAudienceTypes = ['all', 'active', 'inactive', 'by_country', 'by_specialty', 'by_email_list']
    if (!validAudienceTypes.includes(body.audience.type)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Tipo de audiencia debe ser: all, active, inactive, by_country, by_specialty o by_email_list'
      }, { status: 400 })
    }

    // Validar filtros de audiencia
    if ((body.audience.type === 'by_country' || body.audience.type === 'by_specialty') && !body.audience.filter) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: `Filtro es requerido para audiencia tipo ${body.audience.type}`
      }, { status: 400 })
    }

    // Validar lista de emails si el tipo es by_email_list
    if (body.audience.type === 'by_email_list' && (!body.audience.email_list || body.audience.email_list.length === 0)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Lista de emails es requerida para audiencia tipo by_email_list'
      }, { status: 400 })
    }

    // Solo calcular audiencia (no enviar nada todavía)
    const count = await NotificationBroadcastService.getAudienceCount(body.audience)

    return NextResponse.json<ApiResponse<{ count: number; audience: BroadcastAudience }>>({
      data: {
        count,
        audience: body.audience
      },
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

    const validAudienceTypes = ['all', 'active', 'inactive', 'by_country', 'by_specialty', 'by_email_list']
    if (!validAudienceTypes.includes(audienceType)) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'audience_type inválido'
      }, { status: 400 })
    }

    // Para by_email_list, obtener la lista de emails del query param
    let emailList: string[] | undefined = undefined
    if (audienceType === 'by_email_list') {
      const emailsParam = searchParams.get('email_list')
      if (emailsParam) {
        emailList = emailsParam.split(',').map(e => e.trim()).filter(e => e.length > 0)
      }
    }

    const audience: BroadcastAudience = {
      type: audienceType as BroadcastAudience['type'],
      filter: audienceFilter || undefined,
      email_list: emailList
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