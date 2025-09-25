import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// POST - Enviar newsletter masiva con posts seleccionados
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { post_ids, custom_subject, confirm_send } = body

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Se requiere al menos un post_id' },
        { status: 400 }
      )
    }

    if (!confirm_send) {
      return NextResponse.json(
        { data: null, error: 'Confirmación de envío requerida (confirm_send: true)' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseAdminClient()

    // Verificar que newsletter está habilitada
    const { data: settings } = await supabase
      .from('newsletter_settings')
      .select('id, is_enabled')
      .single()

    if (!settings?.is_enabled) {
      return NextResponse.json(
        { data: null, error: 'Newsletter está deshabilitada en la configuración' },
        { status: 403 }
      )
    }

    // Obtener destinatarios
    const { data: recipients, error: recipientsError } = await supabase.rpc('get_content_email_recipients')

    if (recipientsError || !recipients) {
      return NextResponse.json(
        { data: null, error: 'Error obteniendo destinatarios' },
        { status: 500 }
      )
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { data: null, error: 'No hay usuarios suscritos a newsletter' },
        { status: 400 }
      )
    }

    // Obtener posts seleccionados
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        created_at,
        category,
        author_id,
        profiles!inner(full_name, email)
      `)
      .in('id', post_ids)
      .order('created_at', { ascending: false })

    if (postsError || !posts || posts.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Error obteniendo posts seleccionados' },
        { status: 500 }
      )
    }

    // Iniciar proceso de envío masivo
    const sendResult = await sendNewsletterToRecipients(
      recipients,
      posts,
      custom_subject || 'Lo Nuevo en EsteticaProHub'
    )

    // Actualizar configuración de newsletter con última fecha de envío
    await supabase
      .from('newsletter_settings')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', settings.id)

    return NextResponse.json({
      data: {
        message: 'Newsletter enviada exitosamente',
        emails_sent: sendResult.success_count,
        emails_failed: sendResult.failed_count,
        total_recipients: recipients.length,
        posts_included: posts.length
      },
      error: null
    })

  } catch (error) {
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Función para envío masivo de newsletter
async function sendNewsletterToRecipients(recipients: any[], posts: any[], subject: string) {
  // Importación dinámica para evitar problemas de módulos
  const { sendEmail } = await import('@/lib/resend')
  const supabase = await createServerSupabaseAdminClient()

  // Obtener template de newsletter
  const { data: template } = await supabase
    .from('email_templates')
    .select('html_content')
    .eq('template_key', 'posts_newsletter')
    .single()

  let success_count = 0
  let failed_count = 0

  // Generar HTML de posts
  const postsHtml = generatePostsHtml(posts)

  for (const recipient of recipients) {
    try {
      let finalHtml = template?.html_content || generateDefaultNewsletterTemplate()

      // Reemplazar variables manualmente (sin función externa)
      const userName = recipient.full_name || recipient.email?.split('@')[0] || 'Usuario'
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/perfil`

      finalHtml = finalHtml
        .replace(/{{nombre}}/g, userName)
        .replace(/{{posts_content}}/g, postsHtml)
        .replace(/{{unsubscribe_url}}/g, unsubscribeUrl)

      // Usar sendEmail directamente
      const emailResult = await sendEmail({
        to: recipient.email,
        subject: subject,
        html: finalHtml,
        templateKey: 'posts_newsletter',
        userId: recipient.user_id
      })

      if (emailResult.success) {
        success_count++
      } else {
        failed_count++
        console.error(`Error enviando newsletter a ${recipient.email}:`, emailResult.error)
      }

    } catch (error) {
      failed_count++
      console.error(`Error enviando newsletter a ${recipient.email}:`, error)
    }

    // Pequeña pausa para no saturar Resend
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { success_count, failed_count }
}

// Función para generar HTML de posts para newsletter
function generatePostsHtml(posts: any[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esteticaprohub.com'

  return posts.map(post => {
    const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
    const excerpt = post.content?.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
    const postUrl = `${baseUrl}/post/${post.id}`
    const authorName = profile?.full_name || profile?.email?.split('@')[0] || 'Usuario'
    const formattedDate = new Date(post.created_at).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric'
    })

    return `
      <div style="margin-bottom: 25px; padding: 15px; border-left: 4px solid #3498db; background-color: #f8f9fa;">
        <h3 style="color: #2c3e50; margin: 0 0 8px 0; font-size: 18px;">
          <a href="${postUrl}" style="color: #2c3e50; text-decoration: none;">${post.title}</a>
        </h3>
        <p style="color: #7f8c8d; font-size: 13px; margin: 0 0 10px 0;">
          ${authorName} • ${formattedDate}
        </p>
        <p style="color: #34495e; line-height: 1.5; margin: 0 0 12px 0; font-size: 14px;">${excerpt}</p>
        <a href="${postUrl}" 
           style="color: #3498db; text-decoration: none; font-size: 14px; font-weight: 500;">
          Leer completo →
        </a>
      </div>
    `
  }).join('')
}

function generateDefaultNewsletterTemplate(): string {
  return `
    <html>
    <body>
        <h1>Hola {{nombre}},</h1>
        <p>Esto es lo que te perdiste esta semana en EsteticaProHub:</p>
        <div>
            {{posts_content}}
        </div>
        <p>¡No te pierdas las próximas actualizaciones!</p>
        <small><a href="{{unsubscribe_url}}">Cambiar preferencias de email</a></small>
    </body>
    </html>
  `
}