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
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const supabase = createServerSupabaseAdminClient()

    // Construir query base - solo usuarios banneados
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('is_banned', true)

    // Filtro de búsqueda por nombre o email
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

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

    // Primero ejecutar query sin paginación para obtener el count (CON FILTROS)
    let countQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true)

    // Aplicar los mismos filtros que la query principal
    if (search) {
      countQuery = countQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (dateFrom) {
      countQuery = countQuery.gte('banned_at', dateFrom)
    }

    if (dateTo) {
      countQuery = countQuery.lte('banned_at', dateTo)
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting banned users:', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to count banned users' },
        { status: 500 }
      )
    }

    // Si la página solicitada está fuera de rango, retornar vacío
    const totalPages = Math.ceil((totalCount || 0) / limit)
    if (page > totalPages && totalPages > 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: totalCount || 0,
          limit: limit,
          has_next: false,
          has_prev: page > 1
        }
      })
    }

    // Ahora sí ejecutar la query con paginación
    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching banned users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch banned users' },
        { status: 500 }
      )
    }

    // Si no hay usuarios en esta página, retornar respuesta vacía válida
    if (!users || users.length === 0) {
      
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: totalCount || 0,
          limit: limit,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      })
    }

    // Para cada usuario banneado, obtener info adicional
    const usersWithDetails = await Promise.all(
      users.map(async (user: any) => {
        try {
          // Obtener info del admin que banneó
          let bannedByAdmin = null
          if (user.banned_by) {
            const { data: admin } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', user.banned_by)
              .maybeSingle()
            
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
        } catch (err) {
          console.error(`Error fetching details for user ${user.id}:`, err)
          // Si falla, retornar el usuario sin detalles adicionales
          return {
            ...user,
            banned_by_admin: null,
            stats: {
              total_posts: 0,
              total_comments: 0,
              deleted_comments: 0
            }
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: usersWithDetails,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalCount || 0,
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