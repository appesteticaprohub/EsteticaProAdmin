/**
 * Configuración centralizada para sistema de limpieza de notificaciones
 * Optimizado para soportar 10,000+ usuarios
 */

export const CLEANUP_CONFIG = {
  // Tamaño del batch para operaciones de eliminación
  // 5,000 registros por batch = balance entre velocidad y seguridad
  BATCH_SIZE: 5000,

  // Límite máximo de registros a eliminar por ejecución
  // Protección contra eliminaciones masivas accidentales
  MAX_CLEANUP_PER_RUN: 100000,

  // Delay entre batches (milisegundos)
  // Evita saturar Supabase y permite que otros queries se ejecuten
  DELAY_BETWEEN_BATCHES: 500,

  // Timeout para operaciones de base de datos (segundos)
  DB_TIMEOUT: 30,

  // Límite de registros para preview detallado
  // Si hay más registros, solo mostrar COUNT
  PREVIEW_DETAIL_LIMIT: 50000,
} as const

// Tipos de operaciones de limpieza
export type CleanupOperation = 'preview' | 'delete'

// Resultado de un batch
export interface BatchResult {
  batch_number: number
  deleted_count: number
  success: boolean
  error?: string
}

// Progreso de limpieza
export interface CleanupProgress {
  total_to_delete: number
  deleted_so_far: number
  current_batch: number
  total_batches: number
  percentage: number
  status: 'in_progress' | 'completed' | 'failed'
}