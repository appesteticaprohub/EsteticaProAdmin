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

    // ORDEN CRÍTICO DE ELIMINACIÓN:
    // 1. Primero eliminar contenido relacionado manualmente
    // 2. Luego eliminar de profiles (cascada automática para el resto)
    // 3. Finalmente eliminar de Auth

    console.log(`Iniciando eliminación de usuario staff: ${userId}`)

    // 1. Eliminar contenido del usuario manualmente (para evitar problemas de foreign keys)
    
    // Eliminar likes
    const { error: deleteLikesError } = await supabase
      .from('post_likes')
      .delete()
      .eq('user_id', userId)
    
    if (deleteLikesError) {
      console.error('Error deleting likes:', deleteLikesError)
    }

    // Eliminar notificaciones ENVIADAS al usuario
    const { error: deleteNotificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    
    if (deleteNotificationsError) {
      console.error('Error deleting notifications:', deleteNotificationsError)
    }

    // Eliminar notificaciones CREADAS por el usuario (sender_id)
    const { error: deleteSenderNotificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('sender_id', userId)
    
    if (deleteSenderNotificationsError) {
      console.error('Error deleting sender notifications:', deleteSenderNotificationsError)
    }

    // Eliminar comentarios
    const { error: deleteCommentsError } = await supabase
      .from('comments')
      .delete()
      .eq('user_id', userId)
    
    if (deleteCommentsError) {
      console.error('Error deleting comments:', deleteCommentsError)
    }

    // Eliminar posts Y sus imágenes del storage
    // Primero obtener todos los posts con sus imágenes
    const { data: userPosts, error: fetchPostsError } = await supabase
      .from('posts')
      .select('id, images')
      .eq('author_id', userId)
    
    if (fetchPostsError) {
      console.error('Error fetching user posts:', fetchPostsError)
    } else if (userPosts && userPosts.length > 0) {
      console.log(`Encontrados ${userPosts.length} posts del usuario`)
      
      // Eliminar imágenes de cada post del storage
      for (const post of userPosts) {
        if (post.images && Array.isArray(post.images) && post.images.length > 0) {
          console.log(`Eliminando ${post.images.length} imágenes del post ${post.id}`)
          
          // Extraer los paths de las imágenes desde las URLs
          const imagePaths = post.images.map((url: string) => {
            // URL ejemplo: https://[project].supabase.co/storage/v1/object/public/post-images/[path]
            const match = url.match(/post-images\/(.+)$/)
            return match ? match[1] : null
          }).filter((path: string | null): path is string => path !== null)
          
          if (imagePaths.length > 0) {
            const { error: deleteStorageError } = await supabase.storage
              .from('post-images')
              .remove(imagePaths)
            
            if (deleteStorageError) {
              console.error(`Error deleting images from storage for post ${post.id}:`, deleteStorageError)
            } else {
              console.log(`✅ ${imagePaths.length} imágenes eliminadas del storage`)
            }
          }
        }
      }
    }

    // Ahora sí eliminar los posts de la BD
    const { error: deletePostsError } = await supabase
      .from('posts')
      .delete()
      .eq('author_id', userId)
    
    if (deletePostsError) {
      console.error('Error deleting posts:', deletePostsError)
    } else {
      console.log(`✅ Posts eliminados de la base de datos`)
    }

    // 2. Eliminar de staff_credentials
    const { error: deleteCredError } = await supabase
      .from('staff_credentials')
      .delete()
      .eq('user_id', userId)

    if (deleteCredError) {
      console.error('Error deleting staff credentials:', deleteCredError)
    }

    // 3. Eliminar de profiles
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete user profile' },
        { status: 500 }
      )
    }

    // 4. FINALMENTE: Eliminar de Supabase Auth (invalida sesiones)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      // No retornamos error porque el perfil y contenido ya fueron eliminados
      console.log('Usuario eliminado de BD pero falló eliminación de Auth')
    }

    console.log(`✅ Usuario staff eliminado completamente: ${userId}`)

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