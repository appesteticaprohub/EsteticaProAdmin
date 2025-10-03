import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    // Verificar que el usuario autenticado es admin
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No active session' },
        { status: 401 }
      )
    }

    const { data: adminProfile, error: adminError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Parámetros de filtros
    const status = searchParams.get('status') // 'active', 'banned', 'all'
    const userType = searchParams.get('userType') // 'anonymous', 'premium'
    const country = searchParams.get('country')
    const specialty = searchParams.get('specialty')
    const subscriptionStatus = searchParams.get('subscriptionStatus')
    const search = searchParams.get('search') // buscar por nombre o email

    const supabase = createServerSupabaseAdminClient()

    // Construir query base
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })

    // Aplicar filtros
    if (status === 'active') {
      query = query.eq('is_banned', false)
    } else if (status === 'banned') {
      query = query.eq('is_banned', true)
    }

    if (userType) {
      query = query.eq('user_type', userType)
    }

    if (country) {
      query = query.eq('country', country)
    }

    if (specialty) {
      query = query.eq('specialty', specialty)
    }

    if (subscriptionStatus) {
      query = query.eq('subscription_status', subscriptionStatus)
    }

    // Ordenar por fecha de creación (más recientes primero)
    query = query.order('created_at', { ascending: false })

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data: users, error, count } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Filtrar por búsqueda después de la query (para nombre o email)
    let filteredUsers = users || []

    if (search) {
      const searchLower = search.toLowerCase()
      filteredUsers = filteredUsers.filter((user: any) =>
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      )
    }

    // Para cada usuario, obtener estadísticas básicas
    const usersWithStats = await Promise.all(
      filteredUsers.map(async (user: any) => {
        const { count: totalPosts } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', user.id)

        const { count: totalComments } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_deleted', false)

        return {
          ...user,
          stats: {
            total_posts: totalPosts || 0,
            total_comments: totalComments || 0
          }
        }
      })
    )

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: usersWithStats,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: count || 0,
        limit: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in users listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}