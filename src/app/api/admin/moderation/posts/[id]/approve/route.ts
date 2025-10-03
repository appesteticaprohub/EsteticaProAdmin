import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
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