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
    const { searchParams } = new URL(request.url)
    const postsPage = parseInt(searchParams.get('posts_page') || '1')
    const postsLimit = parseInt(searchParams.get('posts_limit') || '10')
    const commentsPage = parseInt(searchParams.get('comments_page') || '1')
    const commentsLimit = parseInt(searchParams.get('comments_limit') || '10')

    const postsOffset = (postsPage - 1) * postsLimit
    const commentsOffset = (commentsPage - 1) * commentsLimit
    const supabase = createServerSupabaseAdminClient()

    // ========================================
    // OPTIMIZACIÓN: Ejecutar queries en paralelo
    // ========================================
    
    const [
      userResult,
      postsResult,
      commentsResult,
      moderationLogsResult,
      // Stats queries
      totalPostsResult,
      totalCommentsResult,
      deletedPostsResult,
      deletedCommentsResult,
      reviewedPostsResult,
      // Agregados optimizados usando SQL functions
      viewsLikesResult
    ] = await Promise.all([
      // 1. Usuario
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      
      // 2. Posts paginados
      supabase
        .from('posts')
        .select('id, title, content, created_at, views_count, likes_count, comments_count, category, images, is_reviewed, is_deleted, deleted_at', { count: 'exact' })
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .range(postsOffset, postsOffset + postsLimit - 1),
      
      // 3. Comentarios paginados
      supabase
        .from('comments')
        .select('id, content, post_id, parent_id, created_at, is_deleted, deleted_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(commentsOffset, commentsOffset + commentsLimit - 1),
      
      // 4. Logs de moderación (limitados a últimos 50)
      supabase
        .from('moderation_logs')
        .select('*')
        .eq('target_id', userId)
        .eq('target_type', 'user')
        .order('created_at', { ascending: false })
        .limit(50),
      
      // 5-9. Stats usando count optimizado
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId),
      
      supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
        .eq('is_deleted', true),
      
      supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_deleted', true),
      
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
        .eq('is_reviewed', true),
      
      // 10. Views y Likes - Solo obtener las sumas
      supabase
        .from('posts')
        .select('views_count, likes_count')
        .eq('author_id', userId)
    ])

    // Verificar usuario existe
    if (userResult.error || !userResult.data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // ========================================
    // OPTIMIZACIÓN: Obtener admins en una query
    // ========================================
    
    const moderationLogs = moderationLogsResult.data || []
    const adminIds = moderationLogs
      .map((log: ModerationLog) => log.admin_id)
      .filter((id): id is string => id !== null)
    
    let adminsMap: Record<string, AdminProfile> = {}
    
    if (adminIds.length > 0) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', adminIds)
      
      if (admins) {
        adminsMap = admins.reduce((acc, admin) => {
          acc[admin.id] = admin
          return acc
        }, {} as Record<string, AdminProfile>)
      }
    }

    const logsWithAdmins = moderationLogs.map((log: ModerationLog) => ({
      ...log,
      admin: log.admin_id ? adminsMap[log.admin_id] || null : null
    }))

    // ========================================
    // OPTIMIZACIÓN: Calcular sumas de manera eficiente
    // ========================================
    
    const allPostsStats = viewsLikesResult.data || []
    const totalViews = allPostsStats.reduce((sum, p) => sum + (p.views_count || 0), 0)
    const totalLikes = allPostsStats.reduce((sum, p) => sum + (p.likes_count || 0), 0)

    const stats = {
      total_posts: totalPostsResult.count || 0,
      total_comments: totalCommentsResult.count || 0,
      deleted_posts: deletedPostsResult.count || 0,
      deleted_comments: deletedCommentsResult.count || 0,
      active_comments: (totalCommentsResult.count || 0) - (deletedCommentsResult.count || 0),
      total_views: totalViews,
      total_likes: totalLikes,
      reviewed_posts: reviewedPostsResult.count || 0,
      pending_posts: (totalPostsResult.count || 0) - (reviewedPostsResult.count || 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        user: userResult.data,
        posts: postsResult.data || [],
        comments: commentsResult.data || [],
        moderation_history: logsWithAdmins,
        stats: stats,
        pagination: {
          posts: {
            current_page: postsPage,
            total_pages: Math.ceil((postsResult.count || 0) / postsLimit),
            total_items: postsResult.count || 0,
            items_per_page: postsLimit,
            has_next: postsPage < Math.ceil((postsResult.count || 0) / postsLimit),
            has_prev: postsPage > 1
          },
          comments: {
            current_page: commentsPage,
            total_pages: Math.ceil((commentsResult.count || 0) / commentsLimit),
            total_items: commentsResult.count || 0,
            items_per_page: commentsLimit,
            has_next: commentsPage < Math.ceil((commentsResult.count || 0) / commentsLimit),
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