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

    const supabase = createServerSupabaseAdminClient()

    // Obtener fechas para filtros temporales
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ========== POSTS ==========
    const { count: totalPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })

    const { count: postsToday } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    const { count: postsThisWeek } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    const { count: postsThisMonth } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo)

    const { count: pendingReview } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_reviewed', false)

    // Posts eliminados (mediante logs)
    const { count: deletedPostsToday } = await supabase
      .from('moderation_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', 'delete_post')
      .gte('created_at', today)

    const { count: deletedPostsWeek } = await supabase
      .from('moderation_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', 'delete_post')
      .gte('created_at', weekAgo)

    const { count: deletedPostsMonth } = await supabase
      .from('moderation_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', 'delete_post')
      .gte('created_at', monthAgo)

    // ========== COMMENTS ==========
    const { count: totalComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })

    const { count: commentsToday } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    const { count: commentsThisWeek } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    const { count: commentsThisMonth } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo)

    const { count: deletedCommentsToday } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true)
      .gte('deleted_at', today)

    const { count: deletedCommentsWeek } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true)
      .gte('deleted_at', weekAgo)

    const { count: deletedCommentsMonth } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true)
      .gte('deleted_at', monthAgo)

    // ========== USERS ==========
    const { count: totalActiveUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', false)

    const { count: totalBannedUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true)

    const { count: bannedToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true)
      .gte('banned_at', today)

    const { count: bannedWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true)
      .gte('banned_at', weekAgo)

    const { count: bannedMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_banned', true)
      .gte('banned_at', monthAgo)

    // Construir respuesta
    const stats = {
      posts: {
        total: totalPosts || 0,
        today: postsToday || 0,
        this_week: postsThisWeek || 0,
        this_month: postsThisMonth || 0,
        deleted_today: deletedPostsToday || 0,
        deleted_week: deletedPostsWeek || 0,
        deleted_month: deletedPostsMonth || 0,
        pending_review: pendingReview || 0
      },
      comments: {
        total: totalComments || 0,
        today: commentsToday || 0,
        this_week: commentsThisWeek || 0,
        this_month: commentsThisMonth || 0,
        deleted_today: deletedCommentsToday || 0,
        deleted_week: deletedCommentsWeek || 0,
        deleted_month: deletedCommentsMonth || 0
      },
      users: {
        total_active: totalActiveUsers || 0,
        total_banned: totalBannedUsers || 0,
        banned_today: bannedToday || 0,
        banned_week: bannedWeek || 0,
        banned_month: bannedMonth || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error in moderation stats endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}