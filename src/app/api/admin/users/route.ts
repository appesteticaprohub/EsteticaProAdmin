import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    // Verificar que el usuario autenticado es admin
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No active session' },
        { status: 401 }
      )
    }

    const { data: adminProfile, error: adminError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    // Parámetros de búsqueda
    const searchName = searchParams.get('search_name')
    const searchEmail = searchParams.get('search_email')

    // Parámetros de filtros adicionales
    const status = searchParams.get('status')
    const role = searchParams.get('role')
    const isBanned = searchParams.get('is_banned')
    const country = searchParams.get('country')
    const autoRenewal = searchParams.get('auto_renewal')
    const subscriptionStatus = searchParams.get('subscription_status')
    
    // Parámetros de ordenamiento
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = (searchParams.get('sort_order') || 'desc') as 'asc' | 'desc'

    const supabase = createServerSupabaseAdminClient()

    // Construir query base
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })

    // Aplicar filtro de búsqueda por nombre
    if (searchName && searchName.trim() !== '') {
      query = query.ilike('full_name', `%${searchName.trim()}%`)
    }

    // Aplicar filtro de búsqueda por email
    if (searchEmail && searchEmail.trim() !== '') {
      query = query.ilike('email', `%${searchEmail.trim()}%`)
    }

    // Aplicar filtros adicionales
    if (status === 'active') {
      query = query.eq('is_banned', false)
    } else if (status === 'banned') {
      query = query.eq('is_banned', true)
    }

    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    if (isBanned && isBanned !== 'all') {
      query = query.eq('is_banned', isBanned === 'true')
    }

    if (country && country !== 'all') {
      query = query.eq('country', country)
    }

    if (autoRenewal && autoRenewal !== 'all') {
      query = query.eq('auto_renewal_enabled', autoRenewal === 'true')
    }

    if (subscriptionStatus && subscriptionStatus !== 'all') {
      query = query.eq('subscription_status', subscriptionStatus)
    }

    // Ordenar
    const ascending = sortOrder === 'asc'
    query = query.order(sortBy, { ascending })

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data: users, error, count } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      users: users || [],
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: count || 0,
        limit: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in users listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}