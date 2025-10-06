import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { PermanentDeleteResponse } from '@/types/admin'

export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario autenticado es admin
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

    const body = await request.json()
    const { post_ids } = body

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'post_ids array is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()
    const errors: string[] = []
    let totalImagesDeleted = 0
    let totalCommentsDeleted = 0
    let totalLikesDeleted = 0

    // Procesar cada post
    for (const postId of post_ids) {
      try {
        // 1. Obtener información del post antes de eliminar (para logs y para eliminar imágenes)
        const { data: post, error: postError } = await supabase
          .from('posts')
          .select('id, title, author_id, images, is_deleted')
          .eq('id', postId)
          .single()

        if (postError || !post) {
          errors.push(`Post ${postId}: Not found`)
          continue
        }

        // Solo permitir eliminar posts que estén marcados como eliminados
        if (!post.is_deleted) {
          errors.push(`Post ${postId}: Not deleted (use soft delete first)`)
          continue
        }

        // 2. Eliminar imágenes del storage
        if (post.images && post.images.length > 0) {
          for (const imageUrl of post.images) {
            try {
              // Extraer el path de la imagen desde la URL
              const url = new URL(imageUrl)
              const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/post-images\/(.+)/)
              
              if (pathMatch && pathMatch[1]) {
                const imagePath = pathMatch[1]
                
                console.log(`Attempting to delete image: ${imagePath}`)
                
                const { error: storageError } = await supabase.storage
                  .from('post-images')
                  .remove([imagePath])

                if (storageError) {
                  console.error(`Error deleting image ${imagePath}:`, storageError)
                  errors.push(`Post ${postId}: Failed to delete image ${imagePath}`)
                } else {
                  console.log(`Successfully deleted image: ${imagePath}`)
                  totalImagesDeleted++
                }
              } else {
                console.error(`Could not extract path from URL: ${imageUrl}`)
                errors.push(`Post ${postId}: Invalid image URL format`)
              }
            } catch (imageError) {
              console.error(`Error processing image URL ${imageUrl}:`, imageError)
              errors.push(`Post ${postId}: Failed to process image URL`)
            }
          }
        }

        // 3. Contar comentarios antes de eliminar
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)

        // 4. Eliminar comentarios asociados (CASCADE)
        const { error: commentsError } = await supabase
          .from('comments')
          .delete()
          .eq('post_id', postId)

        if (commentsError) {
          console.error(`Error deleting comments for post ${postId}:`, commentsError)
          errors.push(`Post ${postId}: Failed to delete comments`)
        } else {
          totalCommentsDeleted += commentsCount || 0
        }

        // 5. Contar likes antes de eliminar
        const { count: likesCount } = await supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)

        // 6. Eliminar likes asociados
        const { error: likesError } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)

        if (likesError) {
          console.error(`Error deleting likes for post ${postId}:`, likesError)
          errors.push(`Post ${postId}: Failed to delete likes`)
        } else {
          totalLikesDeleted += likesCount || 0
        }

        // 7. Registrar en moderation_logs ANTES de eliminar el post
        const postSnapshot = {
          id: post.id,
          title: post.title,
          author_id: post.author_id,
          images_count: post.images?.length || 0,
          comments_deleted: commentsCount || 0,
          likes_deleted: likesCount || 0
        }

        await supabase
          .from('moderation_logs')
          .insert({
            admin_id: adminUser.id,
            action_type: 'delete_post',
            target_type: 'post',
            target_id: postId,
            reason: 'Permanent deletion from cleanup',
            metadata: postSnapshot
          })

        // 8. Eliminar el post físicamente (DELETE)
        const { error: deleteError } = await supabase
          .from('posts')
          .delete()
          .eq('id', postId)

        if (deleteError) {
          console.error(`Error deleting post ${postId}:`, deleteError)
          errors.push(`Post ${postId}: Failed to delete post record`)
        }

      } catch (postProcessError) {
        console.error(`Error processing post ${postId}:`, postProcessError)
        errors.push(`Post ${postId}: ${postProcessError instanceof Error ? postProcessError.message : 'Unknown error'}`)
      }
    }

    // Calcular posts exitosamente eliminados
    const deletedCount = post_ids.length - errors.length

    return NextResponse.json<PermanentDeleteResponse>({
      success: errors.length === 0,
      deleted_count: deletedCount,
      images_deleted: totalImagesDeleted,
      comments_deleted: totalCommentsDeleted,
      likes_deleted: totalLikesDeleted,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error in permanent delete endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        deleted_count: 0,
        images_deleted: 0,
        comments_deleted: 0,
        likes_deleted: 0
      },
      { status: 500 }
    )
  }
}