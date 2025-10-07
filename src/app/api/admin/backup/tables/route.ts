import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET() {
  try {
    // 1. Verificar autenticación usando el mismo método que generate
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // 2. Verificar que es admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'No tienes permisos de administrador' },
        { status: 403 }
      )
    }

    // 3. Obtener tablas usando la función RPC con el admin client
    const { createServerSupabaseAdminClient } = await import('@/lib/server-supabase')
    const adminClient = createServerSupabaseAdminClient()
    
    const { data: tables, error } = await adminClient.rpc('get_public_tables')
    
    if (error) {
      throw new Error(`Error obteniendo tablas: ${error.message}`)
    }

    // 4. Filtrar tablas del sistema
    const filteredTables = (tables || []).filter((table: string) => 
      !table.startsWith('_') && 
      !table.startsWith('supabase_') &&
      table !== 'schema_migrations'
    )

    return NextResponse.json({
      success: true,
      tables: filteredTables.sort() // Ordenar alfabéticamente
    })

  } catch (error) {
    console.error('Error en /api/admin/backup/tables:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al obtener tablas'
      },
      { status: 500 }
    )
  }
}