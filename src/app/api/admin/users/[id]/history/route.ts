import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

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

    // 2. Obtener todos los posts del usuario
    const { data: posts } = await supabase
      .from('posts')
      .select('id, title, content, created_at, views_count, likes_count, comments_count, category, images, is_reviewed')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })

    // 3. Obtener todos los comentarios del usuario
    const { data: comments } = await supabase
      .from('comments')
      .select('id, content, post_id, created_at, is_deleted, deleted_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 4. Obtener historial de moderación sobre este usuario
    const { data: moderationLogs } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('target_id', userId)
      .eq('target_type', 'user')
      .order('created_at', { ascending: false })

    // 5. Obtener información de admins que hicieron acciones
    const adminIds = moderationLogs?.map((log: any) => log.admin_id).filter(Boolean) || []
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', adminIds)

    // Mapear admins a logs
    const logsWithAdmins = moderationLogs?.map((log: any) => ({
      ...log,
      admin: admins?.find((a: any) => a.id === log.admin_id) || null
    })) || []

    // 6. Calcular estadísticas
    const stats = {
      total_posts: posts?.length || 0,
      total_comments: comments?.length || 0,
      deleted_comments: comments?.filter((c: any) => c.is_deleted).length || 0,
      active_comments: comments?.filter((c: any) => !c.is_deleted).length || 0,
      total_views: posts?.reduce((sum: number, p: any) => sum + (p.views_count || 0), 0) || 0,
      total_likes: posts?.reduce((sum: number, p: any) => sum + (p.likes_count || 0), 0) || 0,
      reviewed_posts: posts?.filter((p: any) => p.is_reviewed).length || 0,
      pending_posts: posts?.filter((p: any) => !p.is_reviewed).length || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        user: user,
        posts: posts || [],
        comments: comments || [],
        moderation_history: logsWithAdmins,
        stats: stats
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