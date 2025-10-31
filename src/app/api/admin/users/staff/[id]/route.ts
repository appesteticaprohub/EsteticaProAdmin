import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient, createServerSupabaseClient } from '@/lib/server-supabase'

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

    console.log(`🗑️  Iniciando eliminación del usuario staff: ${userId} (${staffUser.email})`)

    // ============================================
    // PASO 1: DECREMENTAR CONTADORES DE POSTS AFECTADOS POR LIKES
    // ============================================
    console.log('📊 Paso 1: Actualizando contadores de likes en posts...')
    
    // Obtener todos los posts que el usuario dio like
    const { data: userLikes, error: likesError } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId)

    if (likesError) {
      console.error('Error fetching user likes:', likesError)
    } else if (userLikes && userLikes.length > 0) {
      console.log(`Encontrados ${userLikes.length} likes del usuario a eliminar`)
      
      // Obtener posts únicos
      const postIds = [...new Set(userLikes.map(like => like.post_id))]
      
      // Decrementar likes_count en cada post
      for (const postId of postIds) {
        // Obtener el likes_count actual
        const { data: currentPost } = await supabase
          .from('posts')
          .select('likes_count')
          .eq('id', postId)
          .single()
        
        if (currentPost) {
          const newCount = Math.max((currentPost.likes_count || 0) - 1, 0)
          const { error: updateError } = await supabase
            .from('posts')
            .update({ likes_count: newCount })
            .eq('id', postId)
          
          if (updateError) {
            console.error(`Error decrementing likes_count for post ${postId}:`, updateError)
          }
        }
      }
      
      console.log(`✅ Contadores de likes actualizados en ${postIds.length} posts`)
    }

    // ============================================
    // PASO 2: DECREMENTAR CONTADORES DE POSTS AFECTADOS POR COMENTARIOS
    // ============================================
    console.log('📊 Paso 2: Actualizando contadores de comentarios en posts...')
    
    // Obtener todos los comentarios del usuario (incluyendo ya eliminados)
    const { data: userComments, error: commentsError } = await supabase
      .from('comments')
      .select('post_id')
      .eq('user_id', userId)

    if (commentsError) {
      console.error('Error fetching user comments:', commentsError)
    } else if (userComments && userComments.length > 0) {
      console.log(`Encontrados ${userComments.length} comentarios del usuario a eliminar`)
      
      // Agrupar comentarios por post_id
      const commentsByPost = userComments.reduce((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // Decrementar comments_count en cada post
      for (const [postId, count] of Object.entries(commentsByPost)) {
        // Obtener el comments_count actual
        const { data: currentPost } = await supabase
          .from('posts')
          .select('comments_count')
          .eq('id', postId)
          .single()
        
        if (currentPost) {
          const newCount = Math.max((currentPost.comments_count || 0) - count, 0)
          const { error: updateError } = await supabase
            .from('posts')
            .update({ comments_count: newCount })
            .eq('id', postId)
          
          if (updateError) {
            console.error(`Error decrementing comments_count for post ${postId}:`, updateError)
          } else {
            console.log(`✅ Decrementados ${count} comentarios en post ${postId}`)
          }
        }
      }
      
      console.log(`✅ Contadores de comentarios actualizados en ${Object.keys(commentsByPost).length} posts`)
    }

    // ============================================
    // PASO 3: ELIMINAR NOTIFICACIONES GENERADAS POR EL USUARIO
    // ============================================
    console.log('🔔 Paso 3: Eliminando notificaciones generadas por el usuario...')
    
    // Primero obtener el nombre del usuario para buscar en los mensajes
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()
    
    if (userProfile && userProfile.full_name) {
      const actorName = userProfile.full_name
      
      // Buscar notificaciones donde el mensaje incluye el nombre del usuario
      // Patrones: "A {nombre} le gustó...", "{nombre} comentó...", "{nombre} respondió...", "{nombre} te mencionó..."
      const { data: socialNotifications, error: fetchNotifsError } = await supabase
        .from('notifications')
        .select('id, message')
        .or(`message.ilike.A ${actorName} le gustó%,message.ilike.${actorName} comentó%,message.ilike.${actorName} respondió%,message.ilike.${actorName} te mencionó%`)
      
      if (fetchNotifsError) {
        console.error('Error fetching social notifications:', fetchNotifsError)
      } else if (socialNotifications && socialNotifications.length > 0) {
        console.log(`Encontradas ${socialNotifications.length} notificaciones sociales generadas por ${actorName}`)
        
        // Eliminar estas notificaciones
        const notificationIds = socialNotifications.map(n => n.id)
        const { error: deleteNotifsError } = await supabase
          .from('notifications')
          .delete()
          .in('id', notificationIds)
        
        if (deleteNotifsError) {
          console.error('Error deleting social notifications:', deleteNotifsError)
        } else {
          console.log(`✅ ${socialNotifications.length} notificaciones sociales eliminadas`)
        }
      } else {
        console.log('No se encontraron notificaciones sociales del usuario')
      }
    } else {
      console.log('No se pudo obtener el nombre del usuario para eliminar notificaciones')
    }
    
    // También eliminar notificaciones administrativas (si las hay)
    const { data: deletedAdminNotifs, error: adminNotifsError } = await supabase
      .from('notifications')
      .delete()
      .eq('created_by_admin_id', userId)
      .select('id')

    if (adminNotifsError) {
      console.error('Error deleting admin notifications:', adminNotifsError)
    } else {
      const deletedAdminCount = deletedAdminNotifs?.length || 0
      if (deletedAdminCount > 0) {
        console.log(`✅ ${deletedAdminCount} notificaciones administrativas eliminadas`)
      }
    }

    // ============================================
    // PASO 4: CONTEO PARA REPORTE (código original)
    // ============================================
    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: commentsCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: notificationsCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: postsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)

    console.log(`📋 Resumen de eliminación:`)
    console.log(`  - Posts: ${postsCount || 0}`)
    console.log(`  - Comentarios: ${commentsCount || 0}`)
    console.log(`  - Likes: ${likesCount || 0}`)
    console.log(`  - Notificaciones: ${notificationsCount || 0}`)

    // ============================================
    // PASO 5: ELIMINAR DATOS DEL USUARIO (código original)
    // ============================================
    
    // 1. Eliminar likes del usuario
    const { error: deleteLikesError } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
    
    if (deleteLikesError) {
      console.error('Error deleting likes:', deleteLikesError)
    }

    // Eliminar comentarios del usuario
    const { error: deleteCommentsError } = await supabase
      .from('comments')
      .delete()
      .eq('user_id', userId)
    
    if (deleteCommentsError) {
      console.error('Error deleting comments:', deleteCommentsError)
    }

    // Eliminar notificaciones del usuario (las que recibió)
    const { error: deleteNotificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    
    if (deleteNotificationsError) {
      console.error('Error deleting notifications:', deleteNotificationsError)
    }

    // Eliminar posts Y sus imágenes del storage
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
          
          const imagePaths = post.images.map((url: string) => {
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

    // Eliminar los posts de la BD
    const { error: deletePostsError } = await supabase
      .from('posts')
      .delete()
      .eq('author_id', userId)
    
    if (deletePostsError) {
      console.error('Error deleting posts:', deletePostsError)
    } else {
      console.log(`✅ Posts eliminados de la base de datos`)
    }

    // Eliminar de staff_credentials
    const { error: deleteCredError } = await supabase
      .from('staff_credentials')
      .delete()
      .eq('user_id', userId)

    if (deleteCredError) {
      console.error('Error deleting staff credentials:', deleteCredError)
    }

    // Eliminar de profiles
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

    // Eliminar de Supabase Auth
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      console.log('Usuario eliminado de BD pero falló eliminación de Auth')
    }

    console.log(`✅ Usuario staff eliminado completamente: ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Staff user deleted permanently with all related data cleaned',
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