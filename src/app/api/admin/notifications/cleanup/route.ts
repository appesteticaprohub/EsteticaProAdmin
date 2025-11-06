import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { CLEANUP_CONFIG } from '@/lib/cleanup-config'

interface CleanupFilters {
  date_before?: string;
  category?: 'critical' | 'important' | 'normal' | 'promotional' | 'all';
  is_read?: boolean;
}

interface CleanupPreview {
  notifications_count: number;
  breakdown: {
    by_category: Record<string, number>;
    by_read_status: { read: number; unread: number };
  };
  estimated_batches: number;
  estimated_time_minutes: number;
  exceeds_limit: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const categoryParam = searchParams.get('category')
    
    const filters: CleanupFilters = {
      date_before: searchParams.get('date_before') || undefined,
      category: categoryParam && categoryParam !== 'all' 
        ? categoryParam as 'critical' | 'important' | 'normal' | 'promotional'
        : undefined,
      is_read: searchParams.get('is_read') ? searchParams.get('is_read') === 'true' : undefined,
    }

    if (!filters.date_before) {
      return NextResponse.json({
        data: null,
        error: 'Se requiere el parámetro date_before'
      }, { status: 400 })
    }

    const supabase = await createServerSupabaseAdminClient()

    // ✅ OPTIMIZACIÓN: Usar COUNT en lugar de traer todos los registros
    let countQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', filters.date_before)
      .eq('type', 'in_app') // Solo notificaciones in-app

    if (filters.category) {
      countQuery = countQuery.eq('category', filters.category)
    }

    if (filters.is_read !== undefined) {
      countQuery = countQuery.eq('is_read', filters.is_read)
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      throw new Error(`Error obteniendo conteo: ${countError.message}`)
    }

    const notificationsCount = totalCount || 0

    // ✅ Calcular breakdown solo si está bajo el límite
    const breakdown = {
      by_category: {} as Record<string, number>,
      by_read_status: { read: 0, unread: 0 }
    }

    if (notificationsCount > 0 && notificationsCount <= CLEANUP_CONFIG.PREVIEW_DETAIL_LIMIT) {
      // Obtener breakdown detallado solo para volúmenes pequeños
      let detailQuery = supabase
        .from('notifications')
        .select('id, category, is_read')
        .lt('created_at', filters.date_before)
        .eq('type', 'in_app')

      if (filters.category) {
        detailQuery = detailQuery.eq('category', filters.category)
      }

      if (filters.is_read !== undefined) {
        detailQuery = detailQuery.eq('is_read', filters.is_read)
      }

      const { data: notifications, error: detailError } = await detailQuery

      if (!detailError && notifications) {
        notifications.forEach((notif: { category: string; is_read: boolean }) => {
          breakdown.by_category[notif.category] = (breakdown.by_category[notif.category] || 0) + 1
          if (notif.is_read) breakdown.by_read_status.read++
          else breakdown.by_read_status.unread++
        })
      }
    }

    // Calcular estimaciones
    const estimatedBatches = Math.ceil(notificationsCount / CLEANUP_CONFIG.BATCH_SIZE)
    const estimatedTimeMinutes = Math.ceil((estimatedBatches * CLEANUP_CONFIG.DELAY_BETWEEN_BATCHES) / 60000)
    const exceedsLimit = notificationsCount > CLEANUP_CONFIG.MAX_CLEANUP_PER_RUN

    const preview: CleanupPreview = {
      notifications_count: notificationsCount,
      breakdown,
      estimated_batches: estimatedBatches,
      estimated_time_minutes: Math.max(1, estimatedTimeMinutes),
      exceeds_limit: exceedsLimit
    }

    return NextResponse.json({
      data: preview,
      error: null
    })

  } catch (error) {
    console.error('Error en cleanup preview:', error)
    
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    
    const filters: CleanupFilters = {
      date_before: body.date_before,
      category: body.category && body.category !== 'all' ? body.category : undefined,
      is_read: body.is_read !== undefined && body.is_read !== 'all' ? body.is_read : undefined,
    }

    if (!filters.date_before) {
      return NextResponse.json({
        data: null,
        error: 'Se requiere el parámetro date_before'
      }, { status: 400 })
    }

    const supabase = await createServerSupabaseAdminClient()

    // ✅ PASO 1: Obtener el conteo total primero
    let countQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', filters.date_before)
      .eq('type', 'in_app') // Solo notificaciones in-app

    if (filters.category) {
      countQuery = countQuery.eq('category', filters.category)
    }

    if (filters.is_read !== undefined) {
      countQuery = countQuery.eq('is_read', filters.is_read)
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      throw new Error(`Error obteniendo conteo: ${countError.message}`)
    }

    const totalToDelete = totalCount || 0

    if (totalToDelete === 0) {
      return NextResponse.json({
        data: {
          notifications_deleted: 0,
          batches_processed: 0,
          time_elapsed_seconds: 0
        },
        error: null
      })
    }

    // ✅ VERIFICAR LÍMITE DE SEGURIDAD
    if (totalToDelete > CLEANUP_CONFIG.MAX_CLEANUP_PER_RUN) {
      return NextResponse.json({
        data: null,
        error: `La cantidad de registros (${totalToDelete}) excede el límite máximo permitido (${CLEANUP_CONFIG.MAX_CLEANUP_PER_RUN}). Por seguridad, ajusta los filtros para reducir el volumen.`
      }, { status: 400 })
    }

    // ✅ PASO 2: Eliminar en batches
    let totalDeleted = 0
    let batchesProcessed = 0
    const totalBatches = Math.ceil(totalToDelete / CLEANUP_CONFIG.BATCH_SIZE)

    console.log(`🗑️ Iniciando limpieza de ${totalToDelete} notificaciones in-app en ${totalBatches} batches`)

    for (let i = 0; i < totalBatches; i++) {
      try {
        // Primero obtener los IDs que vamos a eliminar para tener el conteo real
        let selectQuery = supabase
          .from('notifications')
          .select('id', { count: 'exact' })
          .lt('created_at', filters.date_before)
          .eq('type', 'in_app')
          .limit(CLEANUP_CONFIG.BATCH_SIZE)

        if (filters.category) {
          selectQuery = selectQuery.eq('category', filters.category)
        }

        if (filters.is_read !== undefined) {
          selectQuery = selectQuery.eq('is_read', filters.is_read)
        }

        const { count: toDeleteCount, error: selectError } = await selectQuery

        if (selectError) {
          console.error(`❌ Error obteniendo registros del batch ${i + 1}:`, selectError)
          throw new Error(`Error en batch ${i + 1}: ${selectError.message}`)
        }

        const batchSize = toDeleteCount || 0

        // Si no hay nada que eliminar, terminamos
        if (batchSize === 0) {
          console.log(`✅ No hay más registros para eliminar`)
          break
        }

        // Ahora sí eliminamos
        let deleteQuery = supabase
          .from('notifications')
          .delete()
          .lt('created_at', filters.date_before)
          .eq('type', 'in_app')
          .limit(CLEANUP_CONFIG.BATCH_SIZE)

        if (filters.category) {
          deleteQuery = deleteQuery.eq('category', filters.category)
        }

        if (filters.is_read !== undefined) {
          deleteQuery = deleteQuery.eq('is_read', filters.is_read)
        }

        const { error: deleteError } = await deleteQuery

        if (deleteError) {
          console.error(`❌ Error en batch ${i + 1}:`, deleteError)
          throw new Error(`Error en batch ${i + 1}: ${deleteError.message}`)
        }

        const batchDeleted = batchSize
        totalDeleted += batchDeleted
        batchesProcessed++

        console.log(`✅ Batch ${i + 1}/${totalBatches}: ${batchDeleted} registros eliminados (Total: ${totalDeleted}/${totalToDelete})`)

        // Si este batch eliminó menos registros de lo esperado, terminamos
        if (batchDeleted < CLEANUP_CONFIG.BATCH_SIZE) {
          console.log(`✅ Limpieza completada anticipadamente - no hay más registros`)
          break
        }

        // Delay entre batches para no saturar la BD
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, CLEANUP_CONFIG.DELAY_BETWEEN_BATCHES))
        }

      } catch (batchError) {
        console.error(`❌ Error procesando batch ${i + 1}:`, batchError)
        throw batchError
      }
    }

    const timeElapsed = Math.round((Date.now() - startTime) / 1000)

    console.log(`✅ Limpieza completada: ${totalDeleted} registros eliminados en ${batchesProcessed} batches (${timeElapsed}s)`)

    return NextResponse.json({
      data: {
        notifications_deleted: totalDeleted,
        batches_processed: batchesProcessed,
        time_elapsed_seconds: timeElapsed
      },
      error: null
    })

  } catch (error) {
    const timeElapsed = Math.round((Date.now() - startTime) / 1000)
    console.error(`❌ Error ejecutando limpieza después de ${timeElapsed}s:`, error)
    
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}