import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Parámetros de filtros
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const supabase = createServerSupabaseAdminClient()

    // Construir query base - solo usuarios banneados
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('is_banned', true)

    // Filtro por rango de fechas de baneo
    if (dateFrom) {
      query = query.gte('banned_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('banned_at', dateTo)
    }

    // Ordenar por fecha de baneo (más recientes primero)
    query = query.order('banned_at', { ascending: false })

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data: users, error, count } = await query

    if (error) {
      console.error('Error fetching banned users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch banned users' },
        { status: 500 }
      )
    }

    // Filtrar por búsqueda después de la query
    let filteredUsers = users || []

    if (search) {
      const searchLower = search.toLowerCase()
      filteredUsers = filteredUsers.filter((user: any) =>
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      )
    }

    // Para cada usuario banneado, obtener info adicional
    const usersWithDetails = await Promise.all(
      filteredUsers.map(async (user: any) => {
        // Obtener info del admin que banneó
        let bannedByAdmin = null
        if (user.banned_by) {
          const { data: admin } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', user.banned_by)
            .single()
          
          bannedByAdmin = admin
        }

        // Obtener estadísticas
        const { count: totalPosts } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', user.id)

        const { count: totalComments } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        const { count: deletedComments } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_deleted', true)

        return {
          ...user,
          banned_by_admin: bannedByAdmin,
          stats: {
            total_posts: totalPosts || 0,
            total_comments: totalComments || 0,
            deleted_comments: deletedComments || 0
          }
        }
      })
    )

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: usersWithDetails,
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
    console.error('Error in banned users listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}