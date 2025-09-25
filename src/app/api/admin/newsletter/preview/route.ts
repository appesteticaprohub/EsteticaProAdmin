import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// POST - Generar preview de newsletter con posts seleccionados
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { post_ids, custom_subject } = body

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Se requiere al menos un post_id' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseAdminClient()

    // Obtener posts seleccionados con información del autor
    const { data: posts, error } = await supabase
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

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { data: null, error: 'No se encontraron posts con los IDs proporcionados' },
        { status: 404 }
      )
    }

    // Generar HTML de la newsletter
    const newsletterHtml = generateNewsletterHtml(posts, custom_subject)
    
    // Obtener conteo de destinatarios
    const { count: recipientCount } = await supabase.rpc('get_content_email_recipients')

    return NextResponse.json({
      data: {
        html_preview: newsletterHtml,
        subject: custom_subject || 'Lo Nuevo en EsteticaProHub',
        recipient_count: recipientCount || 0,
        posts_included: posts.length,
        posts: posts.map(post => {
          const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
          return {
            id: post.id,
            title: post.title,
            author: profile?.full_name || profile?.email,
            created_at: post.created_at
          }
        })
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

// Función para generar HTML de newsletter
function generateNewsletterHtml(posts: any[], customSubject?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esteticaprohub.com'
  
  const postsHtml = posts.map(post => {
    const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
    const excerpt = post.content?.replace(/<[^>]*>/g, '').substring(0, 200) + '...'
    const postUrl = `${baseUrl}/post/${post.id}`
    const authorName = profile?.full_name || profile?.email?.split('@')[0] || 'Usuario'
    const formattedDate = new Date(post.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    return `
      <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fafafa;">
        <h2 style="color: #2c3e50; margin-bottom: 10px; font-size: 20px;">
          <a href="${postUrl}" style="color: #2c3e50; text-decoration: none;">${post.title}</a>
        </h2>
        <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 10px;">
          Por ${authorName} • ${formattedDate}
          ${post.category ? ` • ${post.category}` : ''}
        </p>
        <p style="color: #34495e; line-height: 1.6; margin-bottom: 15px;">${excerpt}</p>
        <a href="${postUrl}" 
           style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">
          Leer más →
        </a>
      </div>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${customSubject || 'Lo Nuevo en EsteticaProHub'}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 0;">
        <!-- Header -->
        <div style="background-color: #2c3e50; color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">EsteticaProHub</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Lo que te perdiste esta semana</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px;">
          <p style="color: #2c3e50; font-size: 16px; margin-bottom: 25px;">
            Hola {{nombre}},<br><br>
            Aquí tienes los posts más recientes de la comunidad EsteticaProHub:
          </p>
          
          ${postsHtml}
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 15px;">
              ¿No quieres recibir más newsletters? 
              <a href="${baseUrl}/perfil" style="color: #3498db;">Cambia tus preferencias aquí</a>
            </p>
            <p style="color: #bdc3c7; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} EsteticaProHub. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}