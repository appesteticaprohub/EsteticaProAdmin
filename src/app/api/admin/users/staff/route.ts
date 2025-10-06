import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdminClient, createServerSupabaseClient } from '@/lib/server-supabase'

// GET - Listar usuarios staff
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

    const supabase = createServerSupabaseAdminClient()

    // Query a profiles WHERE role = 'staff'
    // JOIN con staff_credentials para obtener contraseñas
    // Especificamos la relación por user_id (no por created_by)
    const { data: staffUsers, error, count } = await supabase
      .from('profiles')
      .select(`
        *,
        staff_credentials!staff_credentials_user_id_fkey (
          password_plain,
          created_by,
          updated_at
        )
      `, { count: 'exact' })
      .eq('role', 'staff')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching staff users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch staff users' },
        { status: 500 }
      )
    }

    // Transformar datos para incluir password_plain en el nivel principal
    const formattedUsers = (staffUsers || []).map((user: any) => ({
      id: user.id,
      email: user.email,
      password_plain: user.staff_credentials?.[0]?.password_plain || '',
      full_name: user.full_name,
      country: user.country,
      specialty: user.specialty,
      created_at: user.created_at,
      created_by: user.staff_credentials?.[0]?.created_by,
      user_type: user.user_type,
      subscription_status: user.subscription_status
    }))

    // Calcular paginación
    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: count || 0,
      page: page,
      limit: limit,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in staff users listing endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo usuario staff
export async function POST(request: NextRequest) {
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

    // Obtener datos del body
    const body = await request.json()
    const { email, password, full_name, country, specialty } = body

    // Validaciones básicas
    if (!email || !password || !full_name || !country || !specialty) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdminClient()

    // Verificar que el email no exista
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      )
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: full_name
      }
    })

    if (createAuthError || !authUser.user) {
      console.error('Error creating auth user:', createAuthError)
      return NextResponse.json(
        { success: false, error: 'Failed to create user in authentication system' },
        { status: 500 }
      )
    }

    // 2. Actualizar perfil en profiles con role 'staff'
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: full_name,
        country: country,
        specialty: specialty,
        role: 'staff',
        user_type: 'premium',
        subscription_status: 'Active',
        subscription_expires_at: null,
        paypal_subscription_id: null,
        auto_renewal_enabled: false
      })
      .eq('id', authUser.user.id)
      .select()
      .single()

    if (profileError) {
      console.error('Error updating profile:', profileError)
      // Intentar eliminar el usuario de Auth si falla la actualización del perfil
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    // 3. Crear registro en staff_credentials
    const { error: credentialsError } = await supabase
      .from('staff_credentials')
      .insert({
        user_id: authUser.user.id,
        email: email,
        password_plain: password,
        created_by: adminUser.id
      })

    if (credentialsError) {
      console.error('Error creating staff credentials:', credentialsError)
      // Rollback: eliminar usuario y perfil
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to store staff credentials' },
        { status: 500 }
      )
    }

    // Retornar usuario creado
    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        password_plain: password,
        full_name: profile.full_name,
        country: profile.country,
        specialty: profile.specialty,
        created_at: profile.created_at,
        user_type: profile.user_type,
        subscription_status: profile.subscription_status
      },
      message: 'Staff user created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error in create staff user endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}