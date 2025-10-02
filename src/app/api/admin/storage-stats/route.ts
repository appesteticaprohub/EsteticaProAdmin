import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import type { StorageStats } from '@/types/admin'

export async function GET() {
  try {
    const supabase = createServerSupabaseAdminClient()

    // 1. Obtener total de imágenes y posts con imágenes
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('images, author_id, created_at')
      .not('images', 'is', null)

    if (postsError) {
      console.error('Error fetching posts:', postsError)
      return NextResponse.json(
        { error: 'Error al obtener estadísticas de posts' },
        { status: 500 }
      )
    }

    // Calcular estadísticas
    const totalImages = posts?.reduce((sum: number, post: any) => {
      return sum + (post.images?.length || 0)
    }, 0) || 0

    // 2. Obtener información del bucket de storage
    const { data: files, error: storageError } = await supabase
      .storage
      .from('post-images')
      .list()

    let storageUsedMb = 0
    if (!storageError && files) {
      // Obtener tamaño de archivos (esto es una aproximación)
      // En producción real, Supabase no expone el tamaño directamente
      // Por ahora usamos una estimación basada en cantidad
      storageUsedMb = totalImages * 0.5 // Aproximación: 0.5 MB por imagen
    }

    // 3. Calcular imágenes este mes y esta semana
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)

    const imagesThisMonth = posts?.filter((post: any) => {
      const createdAt = new Date(post.created_at)
      return createdAt >= startOfMonth
    }).reduce((sum: number, post: any) => sum + (post.images?.length || 0), 0) || 0

    const imagesThisWeek = posts?.filter((post: any) => {
      const createdAt = new Date(post.created_at)
      return createdAt >= startOfWeek
    }).reduce((sum: number, post: any) => sum + (post.images?.length || 0), 0) || 0

    // 4. Calcular promedio de imágenes por post
    const postsWithImages = posts?.filter((p: any) => p.images && p.images.length > 0) || []
    const averageImagesPerPost = postsWithImages.length > 0
      ? totalImages / postsWithImages.length
      : 0

    // 5. Top uploaders (usuarios con más imágenes)
    const uploaderMap = new Map<string, number>()
    posts?.forEach((post: any) => {
      if (post.images && post.images.length > 0) {
        const count = uploaderMap.get(post.author_id) || 0
        uploaderMap.set(post.author_id, count + post.images.length)
      }
    })

    // Obtener nombres de usuarios
    const topUploaderIds = Array.from(uploaderMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', topUploaderIds)

    const topUploaders = topUploaderIds.map(id => {
      const profile = profiles?.find((p: any) => p.id === id)
      return {
        user_id: id,
        user_name: profile?.full_name || 'Usuario sin nombre',
        image_count: uploaderMap.get(id) || 0
      }
    })

    // 6. Tendencia mensual (últimos 6 meses)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthName = monthDate.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short' 
      })

      const count = posts?.filter((post: any) => {
        const createdAt = new Date(post.created_at)
        return createdAt >= monthDate && createdAt <= monthEnd
      }).reduce((sum: number, post: any) => sum + (post.images?.length || 0), 0) || 0

      monthlyTrend.push({
        month: monthName,
        count
      })
    }

    const stats: StorageStats = {
      total_images: totalImages,
      storage_used_mb: Math.round(storageUsedMb * 100) / 100,
      storage_used_gb: Math.round((storageUsedMb / 1024) * 100) / 100,
      images_this_month: imagesThisMonth,
      images_this_week: imagesThisWeek,
      average_images_per_post: Math.round(averageImagesPerPost * 100) / 100,
      top_uploaders: topUploaders,
      monthly_trend: monthlyTrend
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error('Error in GET /api/admin/storage-stats:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}