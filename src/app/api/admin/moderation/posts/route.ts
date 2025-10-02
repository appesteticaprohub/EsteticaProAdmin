import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Parámetros de ordenamiento
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Parámetros de filtros
    const category = searchParams.get('category')
    const authorEmail = searchParams.get('authorEmail')
    const authorName = searchParams.get('authorName')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const minComments = searchParams.get('minComments')
    const hasImages = searchParams.get('hasImages')
    const authorStatus = searchParams.get('authorStatus') // 'active', 'banned', 'all'
    const isReviewed = searchParams.get('isReviewed')

    const supabase = createServerSupabaseAdminClient()

    // Construir query base - solo posts
    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        author_id,
        created_at,
        views_count,
        likes_count,
        comments_count,
        category,
        images,
        is_reviewed,
        reviewed_at,
        reviewed_by
      `, { count: 'exact' })

    // Aplicar filtros
    if (category) {
      query = query.eq('category', category)
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    if (minComments) {
      query = query.gte('comments_count', parseInt(minComments))
    }

    if (hasImages === 'true') {
      query = query.not('images', 'eq', '{}')
    } else if (hasImages === 'false') {
      query = query.eq('images', '{}')
    }

    if (isReviewed === 'true') {
      query = query.eq('is_reviewed', true)
    } else if (isReviewed === 'false') {
      query = query.eq('is_reviewed', false)
    }

    // Ordenamiento
    const validSortColumns = ['created_at', 'views_count', 'likes_count', 'comments_count', 'title']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data: posts, error, count } = await query

    if (error) {
      console.error('Error fetching posts:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { success: false, error: 'Failed to fetch posts' },
        { status: 500 }
      )
    }

    // Obtener información de autores manualmente
    const authorIds = posts?.map((post: any) => post.author_id).filter(Boolean) || []
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name, email, country, specialty, user_type, subscription_status, is_banned, created_at')
      .in('id', authorIds)

    // Mapear autores a posts
    const postsWithAuthors = posts?.map((post: any) => ({
      ...post,
      author: authors?.find((author: any) => author.id === post.author_id) || null
    })) || []

    // Filtrar por autor después de la query (filtros complejos)
    let filteredPosts = postsWithAuthors || []

    if (authorEmail) {
      filteredPosts = filteredPosts.filter((post: any) => 
        post.author?.email?.toLowerCase().includes(authorEmail.toLowerCase())
      )
    }

    if (authorName) {
      filteredPosts = filteredPosts.filter((post: any) =>
        post.author?.full_name?.toLowerCase().includes(authorName.toLowerCase())
      )
    }

    if (authorStatus === 'active') {
      filteredPosts = filteredPosts.filter((post: any) => !post.author?.is_banned)
    } else if (authorStatus === 'banned') {
      filteredPosts = filteredPosts.filter((post: any) => post.author?.is_banned)
    }

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: filteredPosts,
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
    console.error('Error in posts listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}