import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { cancelPayPalSubscription } from '@/lib/paypal'
import type { BanUserRequest, BanUserResponse } from '@/types/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const body: BanUserRequest = await request.json()
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

    // Validaciones básicas
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      )
    }


    const supabase = createServerSupabaseAdminClient()

    // 1. Verificar que el usuario existe y obtener su info
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name, paypal_subscription_id, subscription_status, is_banned')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // 2. Verificar que no esté ya banneado
    if (user.is_banned) {
      return NextResponse.json(
        { success: false, error: 'User is already banned' },
        { status: 400 }
      )
    }

    // 3. Cancelar suscripción de PayPal si existe
    let paypalCancelled = false
    let paypalError = null

    if (user.paypal_subscription_id) {
      console.log(`🔄 Cancelling PayPal subscription: ${user.paypal_subscription_id}`)
      
      const cancelResult = await cancelPayPalSubscription(
        user.paypal_subscription_id,
        `User banned - Reason: ${reason}`
      )

      if (cancelResult.success) {
        paypalCancelled = true
        console.log(`✅ PayPal subscription cancelled successfully`)
      } else {
        paypalError = cancelResult.error
        console.error(`❌ Failed to cancel PayPal subscription:`, cancelResult.error)
        // Continuamos con el baneo aunque falle PayPal
      }
    }

    // 4. Actualizar perfil del usuario en la BD
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason.trim(),
        banned_by: admin_id,
        // Si cancelamos PayPal exitosamente, actualizamos el estado
        ...(paypalCancelled && {
          subscription_status: 'Cancelled',
          auto_renewal_enabled: false
        })
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update user profile' },
        { status: 500 }
      )
    }

    // 5. Registrar acción en moderation_logs
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: admin_id,
        action_type: 'ban_user',
        target_type: 'user',
        target_id: userId,
        reason: reason.trim(),
        metadata: {
          user_email: user.email,
          user_name: user.full_name,
          previous_subscription_status: user.subscription_status,
          paypal_subscription_id: user.paypal_subscription_id,
          paypal_cancelled: paypalCancelled,
          paypal_error: paypalError,
          banned_at: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('Error creating moderation log:', logError)
      // No retornamos error aquí, el baneo ya se completó
    }

    // 6. TODO: Destruir todas las sesiones activas del usuario
    // Esto se puede implementar con Supabase Auth más adelante
    // await supabase.auth.admin.signOut(userId)

    console.log(`✅ User banned successfully: ${user.email}`)

    const response: BanUserResponse = {
      success: true,
      user_id: userId,
      paypal_cancelled: paypalCancelled,
      ...(paypalError && { error: `PayPal error: ${paypalError}` })
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error in ban user endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}