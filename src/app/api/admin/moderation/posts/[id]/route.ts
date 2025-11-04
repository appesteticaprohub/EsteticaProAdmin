import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

// Interfaces para tipar los datos de Supabase
interface CommentFromDB {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  parent_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
}

interface CommentUserFromDB {
  id: string
  full_name: string | null
  email: string
  is_banned: boolean
}

interface CommentWithUser extends CommentFromDB {
  user: CommentUserFromDB | null
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

    const { count: totalCommentsCount } = await supabase
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
    // Obtener parámetros de paginación
    const searchParams = request.nextUrl.searchParams
    const commentsPage = parseInt(searchParams.get('comments_page') || '1')
    const commentsLimit = parseInt(searchParams.get('comments_limit') || '50')
    const commentsOffset = (commentsPage - 1) * commentsLimit

    // Obtener total de comentarios
    const { count: totalComments } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    // Obtener comentarios paginados
    const { data: comments } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(commentsOffset, commentsOffset + commentsLimit - 1)

    // Obtener información de usuarios de los comentarios
    const commentUserIds = (comments as CommentFromDB[] | null)?.map((c) => c.user_id).filter(Boolean) || []
    const { data: commentUsers } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_banned')
      .in('id', commentUserIds)

    // Mapear usuarios a comentarios
    const commentsWithUsers: CommentWithUser[] = (comments as CommentFromDB[] | null)?.map((comment) => ({
      ...comment,
      user: (commentUsers as CommentUserFromDB[] | null)?.find((u) => u.id === comment.user_id) || null
    })) || []

    // 5. Obtener historial de baneo si aplica
    const { data: banHistory } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('target_id', post.author_id)
      .eq('target_type', 'user')
      .in('action_type', ['ban_user', 'unban_user'])
      .order('created_at', { ascending: false })

    const totalCommentsPages = Math.ceil((totalComments || 0) / commentsLimit)

    const response = {
      success: true,
      data: {
        post: post,
        author: {
          ...author,
          stats: {
            total_posts: totalPosts || 0,
            total_comments: totalCommentsCount || 0,
            deleted_comments: deletedComments || 0,
            ban_history: banHistory || []
          }
        },
        comments: commentsWithUsers,
        comments_pagination: {
          current_page: commentsPage,
          total_pages: totalCommentsPages,
          total_comments: totalComments || 0,
          comments_per_page: commentsLimit,
          has_more: commentsPage < totalCommentsPages
        }
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

export async function PATCH(
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

    const { id: postId } = await params
    const body = await request.json()
    const { category } = body

    // Validar que se envió una categoría
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category is required' },
        { status: 400 }
      )
    }

    // Validar que la categoría es válida
    const validCategories = [
      'casos-clinicos',
      'complicaciones',
      'tendencias-facial',
      'tendencias-corporal',
      'tendencias-capilar',
      'tendencias-spa',
      'gestion-empresarial'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()

    // Verificar que el post existe
    const { data: existingPost, error: checkError } = await supabase
      .from('posts')
      .select('id, category, title, author_id')
      .eq('id', postId)
      .single()

    if (checkError || !existingPost) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // Actualizar la categoría del post
    const { error: updateError } = await supabase
      .from('posts')
      .update({ category })
      .eq('id', postId)

    if (updateError) {
      console.error('Error updating post category:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update category' },
        { status: 500 }
      )
    }

    // Registrar en moderation_logs
    await supabase
      .from('moderation_logs')
      .insert({
        admin_id: adminUser.id,
        action_type: 'recategorize_post',
        target_type: 'post',
        target_id: postId,
        reason: `Categoría cambiada de "${existingPost.category || 'sin categoría'}" a "${category}"`,
        metadata: {
          old_category: existingPost.category,
          new_category: category,
          post_title: existingPost.title,
          post_author_id: existingPost.author_id
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Category updated successfully'
    })

  } catch (error) {
    console.error('Error in PATCH endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}