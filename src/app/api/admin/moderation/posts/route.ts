import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// Interfaces para tipar los datos de Supabase
interface AuthorFromDB {
  id: string
}

interface PostFromDB {
  id: string
  title: string
  content: string
  author_id: string
  created_at: string
  views_count: number
  likes_count: number
  comments_count: number
  category: string | null
  images: string[]
  is_reviewed: boolean
  reviewed_at: string | null
  reviewed_by: string | null
  is_deleted: boolean
  deleted_at: string | null
}

interface AuthorFullFromDB {
  id: string
  full_name: string | null
  email: string
  country: string | null
  specialty: string | null
  user_type: string
  subscription_status: string
  is_banned: boolean
  created_at: string
}

interface PostWithAuthor extends PostFromDB {
  author: AuthorFullFromDB | null
}

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
    const showDeleted = searchParams.get('showDeleted') // 'true', 'false', 'only'

    const supabase = createServerSupabaseAdminClient()

    // PASO 1: Obtener IDs de autores que cumplen los filtros de autor
    let authorIds: string[] = []
    let shouldFilterByAuthor = false

    if (authorEmail || authorName || authorStatus) {
      shouldFilterByAuthor = true
      
      let authorQuery = supabase
        .from('profiles')
        .select('id')

      if (authorEmail) {
        authorQuery = authorQuery.ilike('email', `%${authorEmail}%`)
      }

      if (authorName) {
        authorQuery = authorQuery.ilike('full_name', `%${authorName}%`)
      }

      if (authorStatus === 'active') {
        authorQuery = authorQuery.eq('is_banned', false)
      } else if (authorStatus === 'banned') {
        authorQuery = authorQuery.eq('is_banned', true)
      }

      const { data: filteredAuthors } = await authorQuery
      authorIds = (filteredAuthors as AuthorFromDB[] | null)?.map((author) => author.id) || []

      // Si no hay autores que cumplan los filtros, retornar vacío
      if (authorIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            current_page: page,
            total_pages: 0,
            total_records: 0,
            limit: limit,
            has_next: false,
            has_prev: false
          }
        })
      }
    }

    // PASO 2: Construir query de posts con filtros aplicados
    let postsQuery = supabase
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
        reviewed_by,
        is_deleted,
        deleted_at
      `, { count: 'exact' })

    // Aplicar filtro de autores si es necesario
    if (shouldFilterByAuthor && authorIds.length > 0) {
      postsQuery = postsQuery.in('author_id', authorIds)
    }

    // Filtro de posts eliminados
    if (showDeleted === 'false') {
      // Solo posts activos (no eliminados)
      postsQuery = postsQuery.eq('is_deleted', false)
    } else if (showDeleted === 'only') {
      // Solo posts eliminados
      postsQuery = postsQuery.eq('is_deleted', true)
    }
    // Si showDeleted es 'true' o no está definido, mostrar todos (no aplicar filtro)

    // Aplicar resto de filtros
    if (category) {
      postsQuery = postsQuery.eq('category', category)
    }

    if (dateFrom) {
      postsQuery = postsQuery.gte('created_at', dateFrom)
    }

    if (dateTo) {
      postsQuery = postsQuery.lte('created_at', dateTo)
    }

    if (minComments) {
      postsQuery = postsQuery.gte('comments_count', parseInt(minComments))
    }

    if (hasImages === 'true') {
      postsQuery = postsQuery.not('images', 'eq', '{}')
    } else if (hasImages === 'false') {
      postsQuery = postsQuery.eq('images', '{}')
    }

    if (isReviewed === 'true') {
      postsQuery = postsQuery.eq('is_reviewed', true)
    } else if (isReviewed === 'false') {
      postsQuery = postsQuery.eq('is_reviewed', false)
    }

    // Ordenamiento
    const validSortColumns = ['created_at', 'views_count', 'likes_count', 'comments_count', 'title']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    postsQuery = postsQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Paginación
    postsQuery = postsQuery.range(offset, offset + limit - 1)

    const { data: posts, error, count } = await postsQuery

    if (error) {
      console.error('Error fetching posts:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { success: false, error: 'Failed to fetch posts' },
        { status: 500 }
      )
    }

    // PASO 3: Obtener información de autores para los posts obtenidos
    const postAuthorIds = (posts as PostFromDB[] | null)?.map((post) => post.author_id).filter(Boolean) || []
    
    let authors: AuthorFullFromDB[] = []
    if (postAuthorIds.length > 0) {
      const { data: authorsData } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, specialty, user_type, subscription_status, is_banned, created_at')
        .in('id', postAuthorIds)
      
      authors = authorsData || []
    }

    // PASO 4: Mapear autores a posts
    const postsWithAuthors: PostWithAuthor[] = (posts as PostFromDB[] | null)?.map((post) => ({
      ...post,
      author: authors.find((author) => author.id === post.author_id) || null
    })) || []

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: postsWithAuthors,
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