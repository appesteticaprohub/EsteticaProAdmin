import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

interface DeleteCommentRequest {
  admin_id: string
  reason: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params
    const body: DeleteCommentRequest = await request.json()
    const { admin_id, reason } = body

    // Validaciones
    if (!admin_id) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()

    // 1. Verificar que el comentario existe
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

    // 2. Verificar si ya está eliminado
    if (comment.is_deleted) {
      return NextResponse.json(
        { success: false, error: 'Comment is already deleted' },
        { status: 400 }
      )
    }

    // 3. Soft delete del comentario
    const { error: deleteError } = await supabase
      .from('comments')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', commentId)

    if (deleteError) {
      console.error('Error deleting comment:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete comment' },
        { status: 500 }
      )
    }

    // 4. Decrementar contador de comentarios en el post
    const { error: decrementError } = await supabase.rpc('decrement_comment_count', {
      post_id_param: comment.post_id
    })

    if (decrementError) {
      console.error('Error decrementing comment count:', decrementError)
      // No retornamos error, el comentario ya se eliminó
    }

    // 5. Registrar acción en moderation_logs
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: admin_id,
        action_type: 'delete_comment',
        target_type: 'comment',
        target_id: commentId,
        reason: reason.trim(),
        metadata: {
          comment_content: comment.content.substring(0, 100),
          comment_user_id: comment.user_id,
          comment_post_id: comment.post_id,
          deleted_at: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Error creating moderation log:', logError)
    }

    console.log(`Comment deleted successfully: ${commentId}`)

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
      comment_id: commentId
    })

  } catch (error) {
    console.error('Error in delete comment endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}