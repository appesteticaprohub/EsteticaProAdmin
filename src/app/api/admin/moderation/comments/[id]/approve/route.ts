import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient, createServerSupabaseClient } from '@/lib/server-supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación admin
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

    const commentId = params.id
    const supabase = createServerSupabaseAdminClient()

    // Verificar que el comentario existe
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('id, post_id, user_id, is_deleted')
      .eq('id', commentId)
      .single()

    if (fetchError || !comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Marcar como revisado
    const { error: updateError } = await supabase
      .from('comments')
      .update({
        is_reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id
      })
      .eq('id', commentId)

    if (updateError) {
      console.error('Error approving comment:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to approve comment' },
        { status: 500 }
      )
    }

    // Registrar acción en moderation_logs
    await supabase
      .from('moderation_logs')
      .insert({
        admin_id: adminUser.id,
        action_type: 'approve_comment',
        target_type: 'comment',
        target_id: commentId,
        reason: null,
        metadata: {
          post_id: comment.post_id,
          user_id: comment.user_id
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Comment approved successfully'
    })

  } catch (error) {
    console.error('Error in approve comment endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}