import { NextRequest, NextResponse } from 'next/server'
import { NotificationBroadcastService } from '@/lib/notification-service'
import type { ApiResponse, BroadcastAudience } from '@/types/admin'

// GET: Contar destinatarios según audiencia (sin enviar nada)
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
      
      if (!emailList || emailList.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          data: null,
          error: 'Lista de emails es requerida para audiencia tipo by_email_list'
        }, { status: 400 })
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
    console.error('Error contando destinatarios:', error)
    
    return NextResponse.json<ApiResponse<null>>({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
