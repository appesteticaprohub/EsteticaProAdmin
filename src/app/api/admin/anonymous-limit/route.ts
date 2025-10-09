import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// GET - Obtener límite actual
export async function GET() {
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser } } = await supabaseAuth.auth.getUser()

    if (!adminUser) {
      return NextResponse.json(
        { data: null, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Validar que sea admin
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { data: null, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Obtener límite desde app_settings
    const { data: setting, error } = await supabaseAuth
      .from('app_settings')
      .select('value')
      .eq('key', 'ANONYMOUS_POST_LIMIT')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error obteniendo límite:', error)
      return NextResponse.json(
        { data: null, error: 'Error al obtener límite' },
        { status: 500 }
      )
    }

    // Si no existe, retornar valor por defecto
    const limit = setting?.value ? parseInt(setting.value, 10) : 1

    return NextResponse.json({
      data: { limit },
      error: null
    })
  } catch (error) {
    console.error('Error en GET /api/admin/anonymous-limit:', error)
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST - Actualizar límite
export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser } } = await supabaseAuth.auth.getUser()

    if (!adminUser) {
      return NextResponse.json(
        { data: null, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Validar que sea admin
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { data: null, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { limit } = body

    // Validar límite
    if (typeof limit !== 'number' || limit < 0 || limit > 100) {
      return NextResponse.json(
        { data: null, error: 'Límite inválido (debe ser entre 0 y 100)' },
        { status: 400 }
      )
    }

    // Verificar si ya existe el setting
    const { data: existingSetting } = await supabaseAuth
      .from('app_settings')
      .select('id')
      .eq('key', 'ANONYMOUS_POST_LIMIT')
      .single()

    if (existingSetting) {
      // Actualizar
      const { error: updateError } = await supabaseAuth
        .from('app_settings')
        .update({ 
          value: limit.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('key', 'ANONYMOUS_POST_LIMIT')

      if (updateError) {
        console.error('Error actualizando límite:', updateError)
        return NextResponse.json(
          { data: null, error: 'Error al actualizar límite' },
          { status: 500 }
        )
      }
    } else {
      // Crear
      const { error: insertError } = await supabaseAuth
        .from('app_settings')
        .insert({
          key: 'ANONYMOUS_POST_LIMIT',
          value: limit.toString(),
          description: 'Límite de posts que puede ver un usuario anónimo antes de requerir suscripción'
        })

      if (insertError) {
        console.error('Error creando límite:', insertError)
        return NextResponse.json(
          { data: null, error: 'Error al crear límite' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      data: { limit, success: true },
      error: null
    })
  } catch (error) {
    console.error('Error en POST /api/admin/anonymous-limit:', error)
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}