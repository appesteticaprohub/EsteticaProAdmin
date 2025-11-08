// src/app/api/admin/dashboard/revenue/route.ts

import { NextResponse } from 'next/server'
import { createServerSupabaseAdminClient } from '@/lib/server-supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const supabase = createServerSupabaseAdminClient()

    // Query base - solo perfiles con pagos activos
    let query = supabase
      .from('profiles')
      .select('last_payment_amount, last_payment_date, subscription_status')
      .eq('subscription_status', 'Active')
      .not('last_payment_amount', 'is', null)
      .not('last_payment_date', 'is', null)

    // Aplicar filtros de fecha en last_payment_date si existen
    if (dateFrom) {
      // Inicio del día en Colombia (UTC-5)
      // Convertir a UTC agregando 5 horas
      const dateFromStart = new Date(dateFrom + 'T00:00:00-05:00')
      query = query.gte('last_payment_date', dateFromStart.toISOString())
    }
    if (dateTo) {
      // Final del día en Colombia (UTC-5)
      // Convertir a UTC agregando 5 horas
      const dateToEnd = new Date(dateTo + 'T23:59:59.999-05:00')
      query = query.lte('last_payment_date', dateToEnd.toISOString())
    }

    // Ejecutar query
    const { data, error } = await query

    if (error) {
      console.error('Error fetching revenue:', error)
      throw error
    }

    // Calcular totales
    let totalRevenue = 0
    let paymentCount = 0
    
    if (data) {
      data.forEach((profile: { last_payment_amount: number }) => {
        totalRevenue += profile.last_payment_amount || 0
        paymentCount++
      })
    }

    // Calcular promedio por pago
    const averagePerPayment = paymentCount > 0 ? totalRevenue / paymentCount : 0

    return NextResponse.json({
      success: true,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      paymentCount,
      averagePerPayment: parseFloat(averagePerPayment.toFixed(2)),
      filters: {
        dateFrom,
        dateTo
      }
    })

  } catch (error) {
    console.error('Error in revenue dashboard endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al obtener estadísticas de ingresos' 
      },
      { status: 500 }
    )
  }
}