// src/app/api/admin/dashboard/stats/route.ts

import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { getDateRanges, calculateGrowthPercentage } from '@/lib/dashboard-stats'

export async function GET() {
  try {
    const supabase = createServerSupabaseAdminClient()
    const dateRanges = getDateRanges()

    // ========== USUARIOS ==========
    // Total de usuarios
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Usuarios del mes actual
    const { count: usersThisMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRanges.thisMonth.start)
      .lte('created_at', dateRanges.thisMonth.end)

    // Usuarios del mes anterior
    const { count: usersLastMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRanges.lastMonth.start)
      .lt('created_at', dateRanges.lastMonth.end)

    // Usuarios nuevos hoy
    const { count: usersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRanges.today.start)
      .lte('created_at', dateRanges.today.end)

    // Usuarios nuevos esta semana
    const { count: usersThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRanges.thisWeek.start)
      .lte('created_at', dateRanges.thisWeek.end)

    // Usuarios nuevos este año
    const { count: usersThisYear } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRanges.thisYear.start)
      .lte('created_at', dateRanges.thisYear.end)

    // ========== POSTS ==========
    // Total posts activos
    const { count: totalActivePosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)

    // Total posts eliminados
    const { count: totalDeletedPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true)

    // Posts del mes actual
    const { count: postsThisMonth } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('created_at', dateRanges.thisMonth.start)
      .lte('created_at', dateRanges.thisMonth.end)

    // Posts del mes anterior
    const { count: postsLastMonth } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('created_at', dateRanges.lastMonth.start)
      .lt('created_at', dateRanges.lastMonth.end)

    // Posts hoy
    const { count: postsToday } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('created_at', dateRanges.today.start)
      .lte('created_at', dateRanges.today.end)

    // Posts esta semana
    const { count: postsThisWeek } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('created_at', dateRanges.thisWeek.start)
      .lte('created_at', dateRanges.thisWeek.end)

    // Posts este año
    const { count: postsThisYear } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('created_at', dateRanges.thisYear.start)
      .lte('created_at', dateRanges.thisYear.end)

    // ========== SUSCRIPCIONES ==========
    // Total suscripciones activas
    const { count: totalActiveSubscriptions } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')

    // Suscripciones del mes actual
    const { count: subscriptionsThisMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')
      .gte('created_at', dateRanges.thisMonth.start)
      .lte('created_at', dateRanges.thisMonth.end)

    // Suscripciones del mes anterior
    const { count: subscriptionsLastMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')
      .gte('created_at', dateRanges.lastMonth.start)
      .lt('created_at', dateRanges.lastMonth.end)

    // Suscripciones hoy
    const { count: subscriptionsToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')
      .gte('created_at', dateRanges.today.start)
      .lte('created_at', dateRanges.today.end)

    // Suscripciones esta semana
    const { count: subscriptionsThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')
      .gte('created_at', dateRanges.thisWeek.start)
      .lte('created_at', dateRanges.thisWeek.end)

    // Suscripciones este año
    const { count: subscriptionsThisYear } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')
      .gte('created_at', dateRanges.thisYear.start)
      .lte('created_at', dateRanges.thisYear.end)

    // ========== ESTADO DEL SISTEMA ==========
    // Verificar conexión a BD
    const { error: dbError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    // Calcular porcentajes de crecimiento
    const usersGrowth = calculateGrowthPercentage(usersThisMonth || 0, usersLastMonth || 0)
    const postsGrowth = calculateGrowthPercentage(postsThisMonth || 0, postsLastMonth || 0)
    const subscriptionsGrowth = calculateGrowthPercentage(subscriptionsThisMonth || 0, subscriptionsLastMonth || 0)

    return NextResponse.json({
      users: {
        total: totalUsers || 0,
        growthPercentage: usersGrowth,
        newToday: usersToday || 0,
        newThisWeek: usersThisWeek || 0,
        newThisMonth: usersThisMonth || 0,
        newThisYear: usersThisYear || 0
      },
      posts: {
        total: totalActivePosts || 0,
        deleted: totalDeletedPosts || 0,
        growthPercentage: postsGrowth,
        publishedToday: postsToday || 0,
        publishedThisWeek: postsThisWeek || 0,
        publishedThisMonth: postsThisMonth || 0,
        publishedThisYear: postsThisYear || 0
      },
      subscriptions: {
        active: totalActiveSubscriptions || 0,
        growthPercentage: subscriptionsGrowth,
        activatedToday: subscriptionsToday || 0,
        activatedThisWeek: subscriptionsThisWeek || 0,
        activatedThisMonth: subscriptionsThisMonth || 0,
        activatedThisYear: subscriptionsThisYear || 0
      },
      system: {
        serverStatus: 'active',
        databaseStatus: dbError ? 'disconnected' : 'connected',
        version: 'v1.0.0'
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}