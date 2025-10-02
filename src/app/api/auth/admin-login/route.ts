import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y password son requeridos' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Autenticar con Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Verificar que el usuario tiene role = 'admin'
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      // Cerrar sesión si no se encuentra el perfil
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Perfil no encontrado' },
        { status: 404 }
      )
    }

    // Validar que sea admin
    if (profile.role !== 'admin') {
      // Cerrar sesión si no es admin
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Acceso denegado - Se requieren permisos de administrador' },
        { status: 403 }
      )
    }

    // Login exitoso
    return NextResponse.json({
      success: true,
      admin: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}