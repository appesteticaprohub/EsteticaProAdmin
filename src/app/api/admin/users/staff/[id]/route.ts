import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient, createServerSupabaseClient } from '@/lib/server-supabase'

// DELETE - Eliminar usuario staff permanentemente
export async function DELETE(
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

    // Verificar que el usuario existe y es staff
    const { data: staffUser, error: userError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
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
        { success: false, error: 'User is not a staff member. Cannot delete from this endpoint.' },
        { status: 400 }
      )
    }

    // Obtener estadísticas antes de eliminar
    const { count: postsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)

    const { count: commentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: notificationsCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: likesCount } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // 1. PRIMERO: Eliminar usuario de Supabase Auth (esto invalida todas sus sesiones)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete user from authentication system' },
        { status: 500 }
      )
    }

    // 2. Eliminar de staff_credentials
    const { error: deleteCredError } = await supabase
      .from('staff_credentials')
      .delete()
      .eq('user_id', userId)

    if (deleteCredError) {
      console.error('Error deleting staff credentials:', deleteCredError)
    }

    // 3. Eliminar de profiles (esto eliminará posts, comments, etc por cascada)
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError)
      // Continuamos porque el usuario de Auth ya fue eliminado
    }

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      // No retornamos error aquí porque el perfil ya fue eliminado
    }

    // La cascada ON DELETE en la base de datos automáticamente elimina:
    // - Registro en profiles
    // - Registro en staff_credentials
    // - Posts del usuario
    // - Comentarios del usuario
    // - Likes del usuario
    // - Notificaciones del usuario

    return NextResponse.json({
      success: true,
      message: 'Staff user deleted permanently',
      deleted: {
        posts: postsCount || 0,
        comments: commentsCount || 0,
        notifications: notificationsCount || 0,
        likes: likesCount || 0
      }
    })

  } catch (error) {
    console.error('Error in delete staff user endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}