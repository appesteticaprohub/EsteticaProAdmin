import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

// GET - Obtener posts disponibles para newsletter
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Obtener posts recientes con información del autor
    // Primero obtener los posts
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, title, content, created_at, views_count, likes_count, comments_count, category, author_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    console.log('📊 Posts query result:', posts)
    console.log('📊 Posts count:', posts?.length)
    console.log('📊 Error:', error)

      console.log('📊 Posts query result:', posts)
    console.log('📊 Posts count:', posts?.length)
    console.log('📊 Error:', error)

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      )
    }

    // Obtener información de autores
    const authorIds = posts?.map(p => p.author_id) || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // Formatear posts para newsletter
    const formattedPosts = posts?.map(post => {
      const profile = profileMap.get(post.author_id)
      
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        author_name: profile?.full_name || profile?.email || 'Usuario',
        author_email: profile?.email,
        created_at: post.created_at,
        views_count: post.views_count,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        category: post.category,
        // Extracto para newsletter (primeras 150 caracteres)
        excerpt: post.content?.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
      }
    })

    return NextResponse.json({
      data: formattedPosts,
      error: null
    })

  } catch (error) {
    return NextResponse.json(
      { data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}