import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// ========== SISTEMA DE CACHÉ ==========
interface StatsCache {
  data: any | null
  timestamp: number
}

const statsCache: StatsCache = {
  data: null,
  timestamp: 0
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos en milisegundos

function isCacheValid(): boolean {
  const now = Date.now()
  return statsCache.data !== null && (now - statsCache.timestamp) < CACHE_DURATION
}

function getCachedStats() {
  return statsCache.data
}

function setCacheStats(data: any) {
  statsCache.data = data
  statsCache.timestamp = Date.now()
}

function clearCache() {
  statsCache.data = null
  statsCache.timestamp = 0
}

// ========== ENDPOINT ==========
export async function GET() {
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

    // ========== VERIFICAR CACHÉ ==========
    if (isCacheValid()) {
      const cachedData = getCachedStats()
      return NextResponse.json({
        success: true,
        data: cachedData.stats,
        cached: true,
        cache_expires_in: Math.round((CACHE_DURATION - (Date.now() - statsCache.timestamp)) / 1000) // segundos restantes
      })
    }

    // ========== SI NO HAY CACHÉ VÁLIDO, EJECUTAR QUERIES ==========
    const supabase = createServerSupabaseAdminClient()

    // Obtener fechas para filtros temporales
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Ejecutar queries en paralelo para mejor performance
    const [
      // POSTS
      totalPostsResult,
      postsTodayResult,
      postsThisWeekResult,
      postsThisMonthResult,
      pendingReviewResult,
      deletedPostsTodayResult,
      deletedPostsWeekResult,
      deletedPostsMonthResult,
      
      // COMMENTS
      totalCommentsResult,
      commentsTodayResult,
      commentsThisWeekResult,
      commentsThisMonthResult,
      deletedCommentsTodayResult,
      deletedCommentsWeekResult,
      deletedCommentsMonthResult,
      
      // USERS
      totalActiveUsersResult,
      totalBannedUsersResult,
      bannedTodayResult,
      bannedWeekResult,
      bannedMonthResult
    ] = await Promise.all([
      // ========== POSTS ==========
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_reviewed', false),
      supabase.from('moderation_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'delete_post').gte('created_at', today),
      supabase.from('moderation_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'delete_post').gte('created_at', weekAgo),
      supabase.from('moderation_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'delete_post').gte('created_at', monthAgo),
      
      // ========== COMMENTS ==========
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', true).gte('deleted_at', today),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', true).gte('deleted_at', weekAgo),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', true).gte('deleted_at', monthAgo),
      
      // ========== USERS ==========
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', false),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true).gte('banned_at', today),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true).gte('banned_at', weekAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true).gte('banned_at', monthAgo)
    ])

    // Construir respuesta
    const stats = {
      posts: {
        total: totalPostsResult.count || 0,
        today: postsTodayResult.count || 0,
        this_week: postsThisWeekResult.count || 0,
        this_month: postsThisMonthResult.count || 0,
        deleted_today: deletedPostsTodayResult.count || 0,
        deleted_week: deletedPostsWeekResult.count || 0,
        deleted_month: deletedPostsMonthResult.count || 0,
        pending_review: pendingReviewResult.count || 0
      },
      comments: {
        total: totalCommentsResult.count || 0,
        today: commentsTodayResult.count || 0,
        this_week: commentsThisWeekResult.count || 0,
        this_month: commentsThisMonthResult.count || 0,
        deleted_today: deletedCommentsTodayResult.count || 0,
        deleted_week: deletedCommentsWeekResult.count || 0,
        deleted_month: deletedCommentsMonthResult.count || 0
      },
      users: {
        total_active: totalActiveUsersResult.count || 0,
        total_banned: totalBannedUsersResult.count || 0,
        banned_today: bannedTodayResult.count || 0,
        banned_week: bannedWeekResult.count || 0,
        banned_month: bannedMonthResult.count || 0
      }
    }

    // ========== GUARDAR EN CACHÉ ==========
    setCacheStats({ stats })

    return NextResponse.json({
      success: true,
      data: stats,
      cached: false,
      cache_duration: CACHE_DURATION / 1000 // en segundos
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

// ========== ENDPOINT PARA LIMPIAR CACHÉ (OPCIONAL) ==========
export async function DELETE() {
  try {
    // Verificar autenticación admin
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
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
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    clearCache()

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })

  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}