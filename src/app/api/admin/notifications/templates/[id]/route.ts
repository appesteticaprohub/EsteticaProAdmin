import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// GET - Obtener un template especÃ­fico por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createServerSupabaseAdminClient()

    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    if (!template) {
      return NextResponse.json(
        { data: null, error: 'Template no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: template,
      error: null
    })

  } catch (error) {
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { subject, html_content, is_active } = body

    const supabase = await createServerSupabaseAdminClient()

    // Verificar que no es un template del sistema
    const { data: existingTemplate } = await supabase
      .from('email_templates')
      .select('is_system')
      .eq('id', id)
      .single()

    if (existingTemplate?.is_system) {
      return NextResponse.json(
        { data: null, error: 'No se pueden modificar templates del sistema' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (subject !== undefined) updateData.subject = subject
    if (html_content !== undefined) updateData.html_content = html_content
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', id)
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

  } catch (error) {
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createServerSupabaseAdminClient()

    // Verificar que no es un template del sistema
    const { data: existingTemplate } = await supabase
      .from('email_templates')
      .select('is_system')
      .eq('id', id)
      .single()

    if (existingTemplate?.is_system) {
      return NextResponse.json(
        { data: null, error: 'No se pueden eliminar templates del sistema' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { message: 'Template eliminado correctamente' },
      error: null
    })

  } catch (error) {
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}