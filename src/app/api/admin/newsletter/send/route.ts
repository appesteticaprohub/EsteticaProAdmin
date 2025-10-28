import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// Interfaces para tipar los datos
interface PostFromDB {
  id: string
  title: string
  content: string
  created_at: string
  category: string | null
  author_id: string
}

interface ProfileFromDB {
  id: string
  full_name: string | null
  email: string
}

interface PostWithProfile extends PostFromDB {
  profiles?: ProfileFromDB
}

interface RecipientData {
  user_id: string
  email: string
  full_name: string | null
}

interface PreferenceFromDB {
  user_id: string
  profiles: ProfileFromDB | ProfileFromDB[]
}

interface EmailLogEntry {
  user_id: string
  template_key: string
  email: string
  status: 'sent' | 'failed'
  resend_id: string | null
  error_message: string | null
}

// POST - Enviar newsletter masiva con posts seleccionados
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      post_ids, 
      custom_subject,
      batchSize = 100,
      offset = 0 
    } = body

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Se requiere al menos un post_id' },
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

    // Obtener destinatarios (usuarios con email_content = true) CON PAGINACIÓN
    const { data: preferences, error: recipientsError } = await supabase
      .from('notification_preferences')
      .select('user_id, profiles!inner(id, email, full_name)')
      .eq('email_content', true)
      .range(offset, offset + batchSize - 1)

    const recipients: RecipientData[] = (preferences as PreferenceFromDB[] | null)?.map((pref) => {
      const profile = Array.isArray(pref.profiles) ? pref.profiles[0] : pref.profiles
      return {
        user_id: pref.user_id,
        email: profile?.email,
        full_name: profile?.full_name
      }
    }).filter((r): r is RecipientData => Boolean(r.email)) || []

    console.log('📧 Recipients en este bloque:', recipients.length)
    console.log('📧 Offset actual:', offset)

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
      .select('id, title, content, created_at, category, author_id')
      .in('id', post_ids)
      .order('created_at', { ascending: false })

    if (postsError || !posts || posts.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Error obteniendo posts seleccionados' },
        { status: 500 }
      )
    }

    // Obtener información de autores
    const authorIds = (posts as PostFromDB[]).map((p) => p.author_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds)

    const profileMap = new Map((profiles as ProfileFromDB[] | null)?.map((p) => [p.id, p]) || [])
    
    const postsWithProfiles: PostWithProfile[] = (posts as PostFromDB[]).map((post) => ({
      ...post,
      profiles: profileMap.get(post.author_id)
    }))

    if (postsError || !posts || posts.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Error obteniendo posts seleccionados' },
        { status: 500 }
      )
    }

    // Si no hay destinatarios en este bloque, significa que terminamos
    if (recipients.length === 0) {
      return NextResponse.json({
        data: {
          message: 'No hay más destinatarios en este bloque',
          emails_sent: 0,
          emails_failed: 0,
          total_recipients: 0,
          nextOffset: offset,
          hasMore: false,
          batchSize: 0
        },
        error: null
      })
    }

    // Iniciar proceso de envío masivo del bloque actual
    const sendResult = await sendNewsletterToRecipients(
      recipients,
      postsWithProfiles,
      custom_subject || 'Lo Nuevo en EsteticaProHub'
    )

    // Calcular siguiente offset
    const nextOffset = offset + recipients.length
    const hasMore = recipients.length === batchSize

    // Solo actualizar last_sent_at si es el último bloque
    if (!hasMore) {
      console.log('📅 Último bloque - Actualizando last_sent_at para settings.id:', settings.id)
      const { data: updatedSettings, error: updateError } = await supabase
        .from('newsletter_settings')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', settings.id)
        .select()
      
      if (updateError) {
        console.error('❌ Error actualizando last_sent_at:', updateError)
      } else {
        console.log('✅ last_sent_at actualizado:', updatedSettings)
      }
    }

    return NextResponse.json({
      data: {
        message: `Bloque enviado: ${sendResult.success_count} exitosos, ${sendResult.failed_count} fallidos`,
        emails_sent: sendResult.success_count,
        emails_failed: sendResult.failed_count,
        total_recipients: recipients.length,
        posts_included: posts.length,
        nextOffset: nextOffset,
        hasMore: hasMore,
        batchSize: recipients.length
      },
      error: null
    })

  } catch (error) {
    console.error('Error sending newsletter:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Función para envío masivo de newsletter
async function sendNewsletterToRecipients(recipients: RecipientData[], posts: PostWithProfile[], subject: string) {
    console.log('📮 Iniciando envío de newsletter')
  console.log('📮 Recipients:', recipients.length)
  console.log('📮 Posts:', posts.length)
  console.log('📮 Subject:', subject)
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
  const emailLogs: EmailLogEntry[] = []

  // Generar HTML de posts
  const postsHtml = generatePostsHtml(posts)

  

  for (const recipient of recipients) {
        console.log('📤 Enviando a:', recipient.email)
    try {
      let finalHtml = template?.html_content || generateDefaultNewsletterTemplate()

      // Reemplazar variables manualmente (sin función externa)
      const userName = recipient.full_name || recipient.email?.split('@')[0] || 'Usuario'
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/perfil`

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
        userId: recipient.user_id,
        skipLogging: true  // 👈 NUEVO: Evita el logging automático para que solo lo haga el batch
      })

      console.log('📬 Resultado para', recipient.email, ':', emailResult)

      // Guardar log del envío
      emailLogs.push({
        user_id: recipient.user_id,
        template_key: 'posts_newsletter',
        email: recipient.email,
        status: emailResult.success ? 'sent' : 'failed',
        resend_id: emailResult.data?.data?.id || null,
        error_message: emailResult.error || null
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
      
      // Guardar log del error
      emailLogs.push({
        user_id: recipient.user_id,
        template_key: 'posts_newsletter',
        email: recipient.email,
        status: 'failed',
        resend_id: null,
        error_message: error instanceof Error ? error.message : 'Error desconocido'
      })
    }

    // Pausa de 600ms entre emails (máx 2 por segundo = 500ms + margen)
    await new Promise(resolve => setTimeout(resolve, 600))
  }

  // Guardar logs en base de datos
  if (emailLogs.length > 0) {
    console.log('💾 Guardando', emailLogs.length, 'logs en BD...')
    const { error: logError } = await supabase
      .from('email_logs')
      .insert(emailLogs)
    
    if (logError) {
      console.error('❌ Error guardando logs:', logError)
    } else {
      console.log('✅ Logs guardados correctamente')
    }
  }

  return { success_count, failed_count }
}



  

// Función para generar HTML de posts para newsletter
function generatePostsHtml(posts: PostWithProfile[]): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://esteticaprohub.com').replace(/\/$/, '')

  return posts.map((post) => {
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