import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { UnbanUserRequest } from '@/types/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    // El body es opcional para unban
    let reason: string | undefined
    try {
      const body: UnbanUserRequest = await request.json()
      reason = body.reason
    } catch {
      // Si no hay body, continuamos sin razón
      reason = undefined
    }

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

    // 1. Verificar que el usuario existe y está banneado
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_banned, banned_at, banned_reason, subscription_status')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.is_banned) {
      return NextResponse.json(
        { success: false, error: 'User is not banned' },
        { status: 400 }
      )
    }

    // 2. Actualizar perfil del usuario - remover baneo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_banned: false,
        banned_at: null,
        banned_reason: null,
        banned_by: null
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update user profile' },
        { status: 500 }
      )
    }

    // 3. Registrar acción en moderation_logs
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: admin_id,
        action_type: 'unban_user',
        target_type: 'user',
        target_id: userId,
        reason: reason || 'User unbanned - No reason provided',
        metadata: {
          user_email: user.email,
          user_name: user.full_name,
          previous_banned_at: user.banned_at,
          previous_banned_reason: user.banned_reason,
          current_subscription_status: user.subscription_status,
          unbanned_at: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Error creating moderation log:', logError)
      // No retornamos error, el desbaneo ya se completó
    }

    console.log(`User unbanned successfully: ${user.email}`)

    return NextResponse.json(
      { 
        success: true, 
        user_id: userId,
        message: 'User unbanned successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error in unban user endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}