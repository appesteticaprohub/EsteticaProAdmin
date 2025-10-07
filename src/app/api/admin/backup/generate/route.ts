import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { BackupService } from '@/lib/backup-service'
import { BackupSQLGenerator } from '@/lib/backup-sql-generator'
import type { BackupConfig } from '@/types/backup'

// Configuración de rate limiting simple (en memoria)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_BACKUPS_PER_HOUR = 5
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hora en ms

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // 2. Verificar que es admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'No tienes permisos de administrador' },
        { status: 403 }
      )
    }

    // 3. Rate limiting
    const now = Date.now()
    const userLimit = rateLimitMap.get(user.id)

    if (userLimit) {
      if (now < userLimit.resetTime) {
        if (userLimit.count >= MAX_BACKUPS_PER_HOUR) {
          return NextResponse.json(
            { error: 'Has excedido el límite de backups por hora. Intenta más tarde.' },
            { status: 429 }
          )
        }
        userLimit.count++
      } else {
        // Reset del contador
        rateLimitMap.set(user.id, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      }
    } else {
      rateLimitMap.set(user.id, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }

    // 4. Parsear configuración del backup
    const config: BackupConfig = await request.json()

    // 5. Validar configuración
    const validation = validateBackupConfig(config)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // 6. Generar el backup
    const backupService = new BackupService()
    const backupData = await backupService.generateBackup(config, user.id)

    // 7. Generar el SQL o JSON según el formato
    let content: string
    let contentType: string
    let fileExtension: string

    if (config.format === 'sql') {
      content = BackupSQLGenerator.generate(backupData)
      content += '\n\nCOMMIT;\n'
      contentType = 'application/sql'
      fileExtension = 'sql'
    } else {
      content = JSON.stringify(backupData, null, 2)
      contentType = 'application/json'
      fileExtension = 'json'
    }

    // 8. Generar nombre del archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `esteticapro_backup_${timestamp}.${fileExtension}`

    // 9. Calcular tamaño del archivo
    const sizeInBytes = Buffer.byteLength(content, 'utf8')
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2)

    // 10. Registrar el backup en logs (opcional, para historial)
    // Esto lo implementaremos en FASE 5

    // 11. Retornar el archivo para descarga
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': sizeInBytes.toString(),
        'X-Backup-Size': sizeInMB,
        'X-Backup-Tables': Object.keys(backupData.tables).length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating backup:', error)
    return NextResponse.json(
      { 
        error: 'Error al generar el backup',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * Valida la configuración del backup
 */
function validateBackupConfig(config: BackupConfig): { valid: boolean; error?: string } {
  // Validar tipo de backup
  if (!['full', 'selective'].includes(config.type)) {
    return { valid: false, error: 'Tipo de backup inválido' }
  }

  // Si es selectivo, debe tener tablas
  if (config.type === 'selective' && (!config.tables || config.tables.length === 0)) {
    return { valid: false, error: 'Debes seleccionar al menos una tabla para backup selectivo' }
  }

  // Validar formato
  if (!['sql', 'json'].includes(config.format)) {
    return { valid: false, error: 'Formato de backup inválido' }
  }

  // Validar fechas si existen
  if (config.dateFrom && config.dateTo) {
    const from = new Date(config.dateFrom)
    const to = new Date(config.dateTo)
    
    if (from > to) {
      return { valid: false, error: 'La fecha "desde" no puede ser mayor que la fecha "hasta"' }
    }

    // Validar que las fechas no sean futuras
    const now = new Date()
    if (from > now || to > now) {
      return { valid: false, error: 'Las fechas no pueden ser futuras' }
    }
  }

  // Validar que al menos una opción esté habilitada
  const { options } = config
  if (!options.includeStructure && !options.includeData && 
      !options.includeRLS && !options.includeTriggers && 
      !options.includeIndexes && !options.includeExtensions) {
    return { valid: false, error: 'Debes incluir al menos una opción en el backup' }
  }

  return { valid: true }
}