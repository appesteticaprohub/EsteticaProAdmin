import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

interface ApprovePostRequest {
  admin_id: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const body: ApprovePostRequest = await request.json()
    const { admin_id } = body

    // Validación
    if (!admin_id) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()

    // 1. Verificar que el post existe
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, title, author_id, is_reviewed')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // 2. Verificar si ya está revisado
    if (post.is_reviewed) {
      return NextResponse.json(
        { success: false, error: 'Post is already reviewed' },
        { status: 400 }
      )
    }

    // 3. Marcar post como revisado
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        is_reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin_id
      })
      .eq('id', postId)

    if (updateError) {
      console.error('Error approving post:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to approve post' },
        { status: 500 }
      )
    }

    // 4. Registrar acción en moderation_logs
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: admin_id,
        action_type: 'approve_post',
        target_type: 'post',
        target_id: postId,
        reason: 'Post approved by moderator',
        metadata: {
          post_title: post.title,
          post_author_id: post.author_id,
          approved_at: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Error creating moderation log:', logError)
    }

    console.log(`Post approved successfully: ${postId}`)

    return NextResponse.json({
      success: true,
      message: 'Post approved successfully',
      post_id: postId
    })

  } catch (error) {
    console.error('Error in approve post endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}