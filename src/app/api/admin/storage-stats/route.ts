import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import type { StorageStats } from '@/types/admin'

export async function GET() {
  try {
    const supabase = createServerSupabaseAdminClient()

    // 1. OBTENER TODOS LOS ARCHIVOS FÍSICOS DEL STORAGE (recursivamente)
    const { data: allFiles, error: storageError } = await supabase
      .storage
      .from('post-images')
      .list('', {
        limit: 10000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (storageError) {
      console.error('Error fetching storage files:', storageError)
      return NextResponse.json(
        { error: 'Error al obtener archivos del storage' },
        { status: 500 }
      )
    }

    // Si no hay archivos en storage, retornar estadísticas en cero
    if (!allFiles || allFiles.length === 0) {
      const emptyStats: StorageStats = {
        total_images: 0,
        storage_used_mb: 0,
        storage_used_gb: 0,
        images_this_month: 0,
        images_this_week: 0,
        average_images_per_post: 0,
        top_uploaders: [],
        monthly_trend: generateEmptyMonthlyTrend()
      }
      return NextResponse.json({ data: emptyStats })
    }

    // 2. OBTENER ARCHIVOS EN SUBCARPETAS (user-xxx/)
    let allImageFiles: any[] = []
    
    // Primero obtenemos las carpetas de usuarios
    const userFolders = allFiles.filter((item: any) => item.id === null) // Las carpetas tienen id null
    
    for (const folder of userFolders) {
      const { data: folderFiles, error: folderError } = await supabase
        .storage
        .from('post-images')
        .list(folder.name, {
          limit: 10000,
          offset: 0
        })
      
      if (!folderError && folderFiles) {
        // Agregar el path completo a cada archivo
        const filesWithPath = folderFiles
          .filter((f: any) => f.id !== null) // Solo archivos, no carpetas
          .map((f: any) => ({
            ...f,
            fullPath: `${folder.name}/${f.name}`
          }))
        allImageFiles.push(...filesWithPath)
      }
    }

    // Si después de buscar en subcarpetas no hay archivos, retornar vacío
    if (allImageFiles.length === 0) {
      const emptyStats: StorageStats = {
        total_images: 0,
        storage_used_mb: 0,
        storage_used_gb: 0,
        images_this_month: 0,
        images_this_week: 0,
        average_images_per_post: 0,
        top_uploaders: [],
        monthly_trend: generateEmptyMonthlyTrend()
      }
      return NextResponse.json({ data: emptyStats })
    }

    // 3. CALCULAR TAMAÑO REAL DEL STORAGE (sumando metadata.size de cada archivo)
    const totalBytes = allImageFiles.reduce((sum: number, file: any) => {
      return sum + (file.metadata?.size || 0)
    }, 0)
    const storageUsedMb = totalBytes / (1024 * 1024) // Convertir bytes a MB

    // 4. OBTENER POSTS CON IMÁGENES PARA CRUZAR CON STORAGE
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

    // 5. VALIDAR QUE LAS URLS EN LA BD EXISTAN EN STORAGE FÍSICO
    const storageFileNames = new Set(allImageFiles.map((f: any) => f.name))
    
    const validPosts = posts?.map((post: any) => {
      if (!post.images || post.images.length === 0) return post
      
      // Filtrar solo las imágenes que existen físicamente en storage
      const validImages = post.images.filter((url: string) => {
        const fileName = url.split('/').pop() // Extraer nombre del archivo de la URL
        return fileName && storageFileNames.has(fileName)
      })
      
      return {
        ...post,
        images: validImages
      }
    }).filter((post: any) => post.images && post.images.length > 0) || []

    const totalImages = allImageFiles.length // Usar archivos físicos reales

    // 6. CALCULAR IMÁGENES ESTE MES Y ESTA SEMANA (basado en created_at del storage)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)

    const imagesThisMonth = allImageFiles.filter((file: any) => {
      const createdAt = new Date(file.created_at)
      return createdAt >= startOfMonth
    }).length

    const imagesThisWeek = allImageFiles.filter((file: any) => {
      const createdAt = new Date(file.created_at)
      return createdAt >= startOfWeek
    }).length

    // 7. CALCULAR PROMEDIO DE IMÁGENES POR POST (solo posts con imágenes válidas)
    const postsWithImages = validPosts.filter((p: any) => p.images && p.images.length > 0)
    const averageImagesPerPost = postsWithImages.length > 0
      ? totalImages / postsWithImages.length
      : 0

    // 8. TOP UPLOADERS (usuarios con más imágenes REALES)
    const uploaderMap = new Map<string, number>()
    validPosts.forEach((post: any) => {
      if (post.images && post.images.length > 0) {
        const count = uploaderMap.get(post.author_id) || 0
        uploaderMap.set(post.author_id, count + post.images.length)
      }
    })

    const topUploaderIds = Array.from(uploaderMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)

    let topUploaders: Array<{ user_id: string; user_name: string; image_count: number }> = []

    if (topUploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', topUploaderIds)

      topUploaders = topUploaderIds.map(id => {
        const profile = profiles?.find((p: any) => p.id === id)
        return {
          user_id: id,
          user_name: profile?.full_name || 'Usuario sin nombre',
          image_count: uploaderMap.get(id) || 0
        }
      })
    }

    // 9. TENDENCIA MENSUAL (últimos 6 meses) - basada en created_at del storage
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthName = monthDate.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short' 
      })

      const count = allImageFiles.filter((file: any) => {
        const createdAt = new Date(file.created_at)
        return createdAt >= monthDate && createdAt <= monthEnd
      }).length

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

// Función helper para generar tendencia mensual vacía
function generateEmptyMonthlyTrend() {
  const now = new Date()
  const trend = []
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthName = monthDate.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short' 
    })
    
    trend.push({
      month: monthName,
      count: 0
    })
  }
  
  return trend
}