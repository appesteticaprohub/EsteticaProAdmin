import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { ApiResponse, Profile } from '@/types/admin'

export async function GET() {
  try {
    const supabase = await createServerSupabaseAdminClient()
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching profiles:', error)
      return NextResponse.json<ApiResponse<Profile[]>>({
        data: null,
        error: 'Error al obtener los perfiles'
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<Profile[]>>({
      data: profiles,
      error: null
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json<ApiResponse<Profile[]>>({
      data: null,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}