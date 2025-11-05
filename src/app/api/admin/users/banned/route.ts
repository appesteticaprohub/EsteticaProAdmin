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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Parámetros de filtros
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const supabase = createServerSupabaseAdminClient()

    // ========================================
    // OPTIMIZACIÓN: Query única con COUNT
    // ========================================
    
    // Construir los filtros en un array para reutilizarlos
    const filters: string[] = ['is_banned.eq.true']
    
    if (search) {
      filters.push(`or(full_name.ilike.%${search}%,email.ilike.%${search}%)`)
    }
    
    if (dateFrom) {
      filters.push(`banned_at.gte.${dateFrom}`)
    }
    
    if (dateTo) {
      filters.push(`banned_at.lte.${dateTo}`)
    }

    // Query para obtener el count total con filtros
    let countQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    filters.forEach(filter => {
      const [column, operator, value] = filter.split('.')
      if (operator === 'eq') {
        countQuery = countQuery.eq(column, value === 'true')
      } else if (operator === 'gte') {
        countQuery = countQuery.gte(column, value)
      } else if (operator === 'lte') {
        countQuery = countQuery.lte(column, value)
      } else if (column === 'or') {
        countQuery = countQuery.or(filter.replace('or(', '').replace(')', ''))
      }
    })

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting banned users:', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to count banned users' },
        { status: 500 }
      )
    }

    const totalPages = Math.ceil((totalCount || 0) / limit)
    
    // Si la página solicitada está fuera de rango, retornar vacío
    if (page > totalPages && totalPages > 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: totalCount || 0,
          limit: limit,
          has_next: false,
          has_prev: page > 1
        }
      })
    }

    // ========================================
    // OPTIMIZACIÓN: Query principal simplificada
    // Sin stats adicionales por ahora
    // ========================================
    
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        is_banned,
        banned_at,
        banned_by,
        banned_reason,
        created_at,
        user_type,
        subscription_status,
        country,
        specialty,
        role
      `)
      .eq('is_banned', true)

    // Aplicar filtros
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (dateFrom) {
      // Comparar desde el inicio del día en zona horaria de Bogotá
      const fromDate = `${dateFrom}T00:00:00-05:00`
      query = query.gte('banned_at', fromDate)
    }

    if (dateTo) {
      // Comparar hasta el final del día en zona horaria de Bogotá
      const toDate = `${dateTo}T23:59:59-05:00`
      query = query.lte('banned_at', toDate)
    }

    // Ordenar y paginar
    query = query
      .order('banned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching banned users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch banned users' },
        { status: 500 }
      )
    }

    // Si no hay usuarios, retornar respuesta vacía
    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: totalCount || 0,
          limit: limit,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      })
    }

    // ========================================
    // OPTIMIZACIÓN: Obtener banned_by admins en UNA SOLA QUERY
    // ========================================
    
    const bannedByIds = users
      .map(u => u.banned_by)
      .filter((id): id is string => id !== null)
    
    let adminInfoMap: Record<string, { id: string; full_name: string | null; email: string }> = {}
    
    if (bannedByIds.length > 0) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', bannedByIds)
      
      if (admins) {
        adminInfoMap = admins.reduce((acc, admin) => {
          acc[admin.id] = admin
          return acc
        }, {} as Record<string, { id: string; full_name: string | null; email: string }>)
      }
    }

    // Mapear usuarios con info del admin
    const usersWithDetails = users.map(user => ({
      ...user,
      banned_by_admin: user.banned_by ? adminInfoMap[user.banned_by] || null : null
    }))

    return NextResponse.json({
      success: true,
      data: usersWithDetails,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: totalCount || 0,
        limit: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in banned users listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}