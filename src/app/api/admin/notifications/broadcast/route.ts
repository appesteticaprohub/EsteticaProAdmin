import { NextRequest, NextResponse } from 'next/server'
import { NotificationBroadcastService } from '@/lib/notification-service'
import type { BroadcastNotificationRequest, ApiResponse, BroadcastResponse } from '@/types/admin'

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

    // Validar que message exista si se envía in_app
    if ((body.type === 'in_app' || body.type === 'both') && !body.message) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'El campo message es requerido para notificaciones in-app'
      }, { status: 400 })
    }

    // Validar que email_content o template exista si se envía email
    if ((body.type === 'email' || body.type === 'both') && !body.email_content && !body.template_key && !body.template_id) {
      return NextResponse.json<ApiResponse<null>>({
        data: null,
        error: 'Se requiere email_content o un template para enviar emails'
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

    const audience = {
      type: audienceType as any,
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