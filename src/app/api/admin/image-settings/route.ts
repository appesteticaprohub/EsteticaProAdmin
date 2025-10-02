import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import type { ImageSettings, ImageSettingsUpdateRequest } from '@/types/admin'

// GET: Obtener configuración actual de imágenes
export async function GET() {
  try {
    const supabase = createServerSupabaseAdminClient()

    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'max_images_per_post',
        'max_image_size_mb',
        'allowed_formats',
        'compression_quality',
        'max_width',
        'max_height'
      ])

    if (error) {
      console.error('Error fetching image settings:', error)
      return NextResponse.json(
        { error: 'Error al obtener configuración de imágenes' },
        { status: 500 }
      )
    }

    // Convertir array de settings a objeto
    const imageSettings: Partial<ImageSettings> = {}
    settings?.forEach((setting: { key: string; value: string }) => {
      const key = setting.key as keyof ImageSettings
      try {
        imageSettings[key] = JSON.parse(setting.value) as any
      } catch {
        imageSettings[key] = setting.value as any
      }
    })

    return NextResponse.json({ data: imageSettings })
  } catch (error) {
    console.error('Error in GET /api/admin/image-settings:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT: Actualizar configuración de imágenes
export async function PUT(request: NextRequest) {
  try {
    const body: ImageSettingsUpdateRequest = await request.json()
    const supabase = createServerSupabaseAdminClient()

    // Validaciones
    if (body.max_images_per_post !== undefined) {
      if (body.max_images_per_post < 1 || body.max_images_per_post > 10) {
        return NextResponse.json(
          { error: 'El número máximo de imágenes debe estar entre 1 y 10' },
          { status: 400 }
        )
      }
    }

    if (body.max_image_size_mb !== undefined) {
      if (body.max_image_size_mb < 0.5 || body.max_image_size_mb > 10) {
        return NextResponse.json(
          { error: 'El tamaño máximo debe estar entre 0.5 y 10 MB' },
          { status: 400 }
        )
      }
    }

    if (body.compression_quality !== undefined) {
      if (body.compression_quality < 0.1 || body.compression_quality > 1) {
        return NextResponse.json(
          { error: 'La calidad de compresión debe estar entre 0.1 y 1' },
          { status: 400 }
        )
      }
    }

    if (body.max_width !== undefined || body.max_height !== undefined) {
      const width = body.max_width || 1920
      const height = body.max_height || 1920
      if (width < 500 || width > 4000 || height < 500 || height > 4000) {
        return NextResponse.json(
          { error: 'Las dimensiones máximas deben estar entre 500 y 4000 píxeles' },
          { status: 400 }
        )
      }
    }

    // Actualizar cada configuración
    const updates = []
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        const updatePromise = supabase
          .from('app_settings')
          .upsert(
            {
              key,
              value: JSON.stringify(value),
              description: getSettingDescription(key),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
          )
        updates.push(updatePromise)
      }
    }

    const results = await Promise.all(updates)
    
    // Verificar si hubo errores
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('Errors updating settings:', errors)
      return NextResponse.json(
        { error: 'Error al actualizar algunas configuraciones' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Configuración actualizada exitosamente' 
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/image-settings:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Helper para obtener descripción de cada setting
function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    max_images_per_post: 'Número máximo de imágenes permitidas por post',
    max_image_size_mb: 'Tamaño máximo por imagen en MB',
    allowed_formats: 'Formatos de imagen permitidos',
    compression_quality: 'Calidad de compresión de imágenes (0.1 a 1)',
    max_width: 'Ancho máximo de imagen en píxeles',
    max_height: 'Alto máximo de imagen en píxeles'
  }
  return descriptions[key] || ''
}