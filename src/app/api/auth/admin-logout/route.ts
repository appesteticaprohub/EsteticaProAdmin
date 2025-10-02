import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Cerrar sesión en Supabase
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}