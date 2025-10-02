import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No authenticated' },
        { status: 401 }
      )
    }

    // Verificar que el usuario tiene role = 'admin'
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Validar que sea admin
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      admin: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name
      }
    })

  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}