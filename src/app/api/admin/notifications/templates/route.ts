import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// GET - Obtener todos los templates
export async function GET() {
  try {
    const supabase = await createServerSupabaseAdminClient()
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      templates: templates || [],
      error: null
    })
  } catch (err) {
    console.error('Error al obtener templates:', err)
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template_key, subject, html_content, is_active = true } = body

    if (!template_key || !subject || !html_content) {
      return NextResponse.json(
        { data: null, error: 'Campos requeridos: template_key, subject, html_content' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseAdminClient()

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({
        template_key,
        subject,
        html_content,
        is_active,
        is_system: false
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: template,
      error: null
    })
  } catch (err) {
    console.error('Error al crear template:', err)
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}