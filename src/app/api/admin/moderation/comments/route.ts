import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de filtros
    const postId = searchParams.get('postId')
    const userId = searchParams.get('userId')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const supabase = createServerSupabaseAdminClient()

    // Construir query base
    let query = supabase
      .from('comments')
      .select('*', { count: 'exact' })

    // Aplicar filtros
    if (postId) {
      query = query.eq('post_id', postId)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
    }

    // Ordenar por fecha
    query = query.order('created_at', { ascending: true })

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data: comments, error, count } = await query

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    // Obtener información de usuarios
    const userIds = comments?.map((c: any) => c.user_id).filter(Boolean) || []
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_banned')
      .in('id', userIds)

    // Mapear usuarios a comentarios
    const commentsWithUsers = comments?.map((comment: any) => ({
      ...comment,
      user: users?.find((u: any) => u.id === comment.user_id) || null
    })) || []

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: commentsWithUsers,
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
    console.error('Error in comments listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}