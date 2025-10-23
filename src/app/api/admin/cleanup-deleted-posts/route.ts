import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { DeletedPostsListResponse, DeletedPostItem } from '@/types/admin'

// Interfaces para tipar los datos de Supabase
interface DeletedPostFromDB {
  id: string
  title: string
  content: string
  author_id: string
  deleted_at: string
  category: string | null
  images: string[] | null
  comments_count: number
  likes_count: number
  views_count: number
}

interface AuthorFromDB {
  id: string
  full_name: string | null
  email: string
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

    // Obtener parámetros de filtro
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { success: false, error: 'dateFrom and dateTo are required' },
        { status: 400 }
      )
    }

const supabase = createServerSupabaseAdminClient()

// Convertir fechas a formato ISO completo para Supabase
const dateFromISO = `${dateFrom}T00:00:00.000Z`
const dateToISO = `${dateTo}T23:59:59.999Z`

// Obtener posts eliminados en el rango de fechas
const { data: deletedPosts, error: postsError } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    content,
    author_id,
    deleted_at,
    category,
    images,
    comments_count,
    likes_count,
    views_count
  `)
  .eq('is_deleted', true)
  .gte('deleted_at', dateFromISO)
  .lte('deleted_at', dateToISO)
  .order('deleted_at', { ascending: false })

    if (postsError) {
      console.error('Error fetching deleted posts:', postsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch deleted posts' },
        { status: 500 }
      )
    }

    if (!deletedPosts || deletedPosts.length === 0) {
      return NextResponse.json<DeletedPostsListResponse>({
        success: true,
        data: [],
        total_records: 0,
        summary: {
          total_posts: 0,
          total_images: 0,
          total_comments: 0,
          total_likes: 0
        }
      })
    }

    // Obtener información de los autores
    const authorIds = (deletedPosts as DeletedPostFromDB[]).map((p) => p.author_id)
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds)

    // Mapear posts con información del autor
    const postsWithAuthors: DeletedPostItem[] = (deletedPosts as DeletedPostFromDB[]).map((post) => {
      const author = (authors as AuthorFromDB[] | null)?.find((a) => a.id === post.author_id)
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        author_id: post.author_id,
        author_name: author?.full_name || null,
        author_email: author?.email || 'Unknown',
        deleted_at: post.deleted_at,
        category: post.category,
        images_count: post.images?.length || 0,
        comments_count: post.comments_count || 0,
        likes_count: post.likes_count || 0,
        views_count: post.views_count || 0,
        images: post.images || []
      }
    })

    // Calcular resumen
    const summary = {
      total_posts: postsWithAuthors.length,
      total_images: postsWithAuthors.reduce((sum, p) => sum + p.images_count, 0),
      total_comments: postsWithAuthors.reduce((sum, p) => sum + p.comments_count, 0),
      total_likes: postsWithAuthors.reduce((sum, p) => sum + p.likes_count, 0)
    }

    return NextResponse.json<DeletedPostsListResponse>({
      success: true,
      data: postsWithAuthors,
      total_records: postsWithAuthors.length,
      summary
    })

  } catch (error) {
    console.error('Error in deleted posts cleanup endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}