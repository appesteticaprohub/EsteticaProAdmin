import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// Tipo para los datos de actualización
type NewsletterUpdateData = {
  is_enabled?: boolean
  posts_to_include?: number
}

// GET - Obtener configuración de newsletter
export async function GET() {
  try {
    const supabase = await createServerSupabaseAdminClient()
    const { data: settings, error } = await supabase
      .from('newsletter_settings')
      .select('*')
      .single()

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    // También obtener el conteo de suscriptores
    const { count: subscriberCount } = await supabase
      .from('notification_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('email_content', true)

    return NextResponse.json({
      data: {
        ...settings,
        subscriber_count: subscriberCount || 0
      },
      error: null
    })
  } catch (err) {
    console.error('Error al obtener configuración de newsletter:', err)
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar configuración de newsletter
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { is_enabled, posts_to_include } = body

    const supabase = await createServerSupabaseAdminClient()

    const updateData: NewsletterUpdateData = {}
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled
    if (posts_to_include !== undefined) updateData.posts_to_include = posts_to_include

    const { data: settings, error } = await supabase
      .from('newsletter_settings')
      .update(updateData)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: settings,
      error: null
    })
  } catch (err) {
    console.error('Error al actualizar configuración de newsletter:', err)
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}