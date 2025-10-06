import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient, createServerSupabaseClient } from '@/lib/server-supabase'

// PATCH - Actualizar contraseña de usuario staff
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar que el usuario autenticado es admin
    const supabase = createServerSupabaseAdminClient()
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

    const { id: userId } = await params

    // Obtener nueva contraseña del body
    const body = await request.json()
    const { new_password } = body

    // Validaciones
    if (!new_password) {
      return NextResponse.json(
        { success: false, error: 'New password is required' },
        { status: 400 }
      )
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe y es staff
    const { data: staffUser, error: userError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (userError || !staffUser) {
      return NextResponse.json(
        { success: false, error: 'Staff user not found' },
        { status: 404 }
      )
    }

    if (staffUser.role !== 'staff') {
      return NextResponse.json(
        { success: false, error: 'User is not a staff member' },
        { status: 400 }
      )
    }

    // 1. Actualizar contraseña en Supabase Auth
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: new_password }
    )

    if (updateAuthError) {
      console.error('Error updating auth password:', updateAuthError)
      return NextResponse.json(
        { success: false, error: 'Failed to update password in authentication system' },
        { status: 500 }
      )
    }

    // 2. Actualizar password_plain en staff_credentials
    const { error: updateCredError } = await supabase
      .from('staff_credentials')
      .update({
        password_plain: new_password,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateCredError) {
      console.error('Error updating staff credentials:', updateCredError)
      return NextResponse.json(
        { success: false, error: 'Failed to update staff credentials' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })

  } catch (error) {
    console.error('Error in update staff password endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}