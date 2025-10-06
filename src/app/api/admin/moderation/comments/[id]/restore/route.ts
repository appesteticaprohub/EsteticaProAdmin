import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params

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

    const supabase = createServerSupabaseAdminClient()

    // 1. Verificar que el comentario existe y está eliminado
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, content, user_id, post_id, is_deleted')
      .eq('id', commentId)
      .single()

    if (commentError || !comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }

    if (!comment.is_deleted) {
      return NextResponse.json(
        { success: false, error: 'Comment is not deleted' },
        { status: 400 }
      )
    }

    // 2. Restaurar el comentario (revertir soft delete)
    const { error: restoreError } = await supabase
      .from('comments')
      .update({
        is_deleted: false,
        deleted_at: null
      })
      .eq('id', commentId)

    if (restoreError) {
      console.error('Error restoring comment:', restoreError)
      return NextResponse.json(
        { success: false, error: 'Failed to restore comment' },
        { status: 500 }
      )
    }

    // 3. Incrementar contador de comentarios en el post
    const { error: incrementError } = await supabase.rpc('increment_comment_count', {
      post_id_param: comment.post_id
    })

    if (incrementError) {
      console.error('Error incrementing comment count:', incrementError)
      // No retornamos error, el comentario ya se restauró
    }

    // 4. Registrar acción en moderation_logs
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: admin_id,
        action_type: 'restore_comment',
        target_type: 'comment',
        target_id: commentId,
        reason: 'Comentario restaurado por administrador',
        metadata: {
          comment_content_preview: comment.content.substring(0, 100),
          comment_user_id: comment.user_id,
          comment_post_id: comment.post_id,
          restored_at: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Error creating moderation log:', logError)
    }

    console.log(`Comment restored successfully: ${commentId}`)

    return NextResponse.json({
      success: true,
      message: 'Comment restored successfully',
      comment_id: commentId
    })

  } catch (error) {
    console.error('Error in restore comment endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}