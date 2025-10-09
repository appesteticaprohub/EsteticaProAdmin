// src/app/api/admin/dashboard/stats/route.ts

import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET() {
  try {
    const supabase = createServerSupabaseAdminClient()

    // ========== SOLO TOTALES (Queries mínimas) ==========
    
    // Total de usuarios
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Total posts activos
    const { count: totalActivePosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)

    // Total suscripciones activas
    const { count: totalActiveSubscriptions } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')

    // Estado del sistema
    const { error: dbError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    return NextResponse.json({
      users: {
        total: totalUsers || 0
      },
      posts: {
        total: totalActivePosts || 0
      },
      subscriptions: {
        active: totalActiveSubscriptions || 0
      },
      system: {
        serverStatus: 'active',
        databaseStatus: dbError ? 'disconnected' : 'connected',
        version: 'v1.0.0'
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}