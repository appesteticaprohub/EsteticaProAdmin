import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

interface DeletePostRequest {
  reason: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const body: DeletePostRequest = await request.json()
    const { reason } = body

    // Obtener admin_id de la sesión autenticada
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No active session' },
        { status: 401 }
      )
    }

    // Verificar que el usuario autenticado es admin
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

    const admin_id = adminUser.id

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()

    // 1. Verificar que el post existe
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, title, author_id, content')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // 2. Eliminar el post (hard delete por ahora, o puedes agregar columna is_deleted)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (deleteError) {
      console.error('Error deleting post:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete post' },
        { status: 500 }
      )
    }

    // 3. Registrar acción en moderation_logs
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: admin_id,
        action_type: 'delete_post',
        target_type: 'post',
        target_id: postId,
        reason: reason.trim(),
        metadata: {
          post_title: post.title,
          post_author_id: post.author_id,
          post_content_preview: post.content.substring(0, 100),
          deleted_at: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Error creating moderation log:', logError)
    }

    console.log(`Post deleted successfully: ${postId}`)

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
      post_id: postId
    })

  } catch (error) {
    console.error('Error in delete post endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}