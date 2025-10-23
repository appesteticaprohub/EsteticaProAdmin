import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

interface ModerationLog {
  id: string
  admin_id: string | null
  action_type: string
  target_type: string
  target_id: string
  reason: string | null
  created_at: string
  metadata?: Record<string, unknown>
}

interface AdminProfile {
  id: string
  full_name: string | null
  email: string
}

interface PostStats {
  views_count: number
  likes_count: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: userId } = await params
    // Extraer query params para paginación
    const { searchParams } = new URL(request.url)
    const postsPage = parseInt(searchParams.get('posts_page') || '1')
    const postsLimit = parseInt(searchParams.get('posts_limit') || '10')
    const commentsPage = parseInt(searchParams.get('comments_page') || '1')
    const commentsLimit = parseInt(searchParams.get('comments_limit') || '10')

    // Calcular offsets
    const postsOffset = (postsPage - 1) * postsLimit
    const commentsOffset = (commentsPage - 1) * commentsLimit
    const supabase = createServerSupabaseAdminClient()

    // 1. Verificar que el usuario existe
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // 2. Obtener posts del usuario con paginación
    const { data: posts, count: totalPosts } = await supabase
      .from('posts')
      .select('id, title, content, created_at, views_count, likes_count, comments_count, category, images, is_reviewed, is_deleted, deleted_at', { count: 'exact' })
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(postsOffset, postsOffset + postsLimit - 1)

    // 3. Obtener comentarios del usuario con paginación
    const { data: comments, count: totalComments } = await supabase
      .from('comments')
      .select('id, content, post_id, parent_id, created_at, is_deleted, deleted_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(commentsOffset, commentsOffset + commentsLimit - 1)

    // 4. Obtener historial de moderación sobre este usuario
    const { data: moderationLogs } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('target_id', userId)
      .eq('target_type', 'user')
      .order('created_at', { ascending: false })

    // 5. Obtener información de admins que hicieron acciones
    const adminIds = moderationLogs?.map((log: ModerationLog) => log.admin_id).filter(Boolean) || []
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', adminIds)

    // Mapear admins a logs
    const logsWithAdmins = moderationLogs?.map((log: ModerationLog) => ({
      ...log,
      admin: admins?.find((a: AdminProfile) => a.id === log.admin_id) || null
    })) || []

    // 6. Calcular estadísticas globales (no paginadas)
    // Contar posts eliminados
    const { count: deletedPostsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('is_deleted', true)

    // Contar comentarios eliminados
    const { count: deletedCommentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', true)

    // Contar posts revisados
    const { count: reviewedPostsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('is_reviewed', true)

    // Obtener sumas de views y likes (necesitamos los datos completos para esto)
    const { data: allPostsForStats } = await supabase
      .from('posts')
      .select('views_count, likes_count')
      .eq('author_id', userId)

    const totalViews = allPostsForStats?.reduce((sum: number, p: PostStats) => sum + (p.views_count || 0), 0) || 0
    const totalLikes = allPostsForStats?.reduce((sum: number, p: PostStats) => sum + (p.likes_count || 0), 0) || 0

    const stats = {
      total_posts: totalPosts || 0,
      total_comments: totalComments || 0,
      deleted_posts: deletedPostsCount || 0,
      deleted_comments: deletedCommentsCount || 0,
      active_comments: (totalComments || 0) - (deletedCommentsCount || 0),
      total_views: totalViews,
      total_likes: totalLikes,
      reviewed_posts: reviewedPostsCount || 0,
      pending_posts: (totalPosts || 0) - (reviewedPostsCount || 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        user: user,
        posts: posts || [],
        comments: comments || [],
        moderation_history: logsWithAdmins,
        stats: stats,
        pagination: {
          posts: {
            current_page: postsPage,
            total_pages: Math.ceil((totalPosts || 0) / postsLimit),
            total_items: totalPosts || 0,
            items_per_page: postsLimit,
            has_next: postsPage < Math.ceil((totalPosts || 0) / postsLimit),
            has_prev: postsPage > 1
          },
          comments: {
            current_page: commentsPage,
            total_pages: Math.ceil((totalComments || 0) / commentsLimit),
            total_items: totalComments || 0,
            items_per_page: commentsLimit,
            has_next: commentsPage < Math.ceil((totalComments || 0) / commentsLimit),
            has_prev: commentsPage > 1
          }
        }
      }
    })

  } catch (error) {
    console.error('Error in user history endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}