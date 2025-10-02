import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const supabase = createServerSupabaseAdminClient()

    // 1. Obtener el post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // 2. Obtener información del autor
    const { data: author } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        country,
        specialty,
        user_type,
        subscription_status,
        is_banned,
        banned_at,
        banned_reason,
        created_at,
        paypal_subscription_id
      `)
      .eq('id', post.author_id)
      .single()

    // 3. Obtener estadísticas del autor
    const { count: totalPosts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', post.author_id)

    const { count: totalComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', post.author_id)
      .eq('is_deleted', false)

    const { count: deletedComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', post.author_id)
      .eq('is_deleted', true)

    // 4. Obtener comentarios del post con información de usuarios
    const { data: comments } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    // Obtener información de usuarios de los comentarios
    const commentUserIds = comments?.map((c: any) => c.user_id).filter(Boolean) || []
    const { data: commentUsers } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_banned')
      .in('id', commentUserIds)

    // Mapear usuarios a comentarios
    const commentsWithUsers = comments?.map((comment: any) => ({
      ...comment,
      user: commentUsers?.find((u: any) => u.id === comment.user_id) || null
    })) || []

    // 5. Obtener historial de baneo si aplica
    const { data: banHistory } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('target_id', post.author_id)
      .eq('target_type', 'user')
      .in('action_type', ['ban_user', 'unban_user'])
      .order('created_at', { ascending: false })

    const response = {
      success: true,
      data: {
        post: post,
        author: {
          ...author,
          stats: {
            total_posts: totalPosts || 0,
            total_comments: totalComments || 0,
            deleted_comments: deletedComments || 0,
            ban_history: banHistory || []
          }
        },
        comments: commentsWithUsers
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in post detail endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}