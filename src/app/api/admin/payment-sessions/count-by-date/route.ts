import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dateFrom, dateTo } = body;

    // Validar que vengan las fechas
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { success: false, error: 'dateFrom y dateTo son requeridos' },
        { status: 400 }
      );
    }

    console.log('📅 Buscando sesiones desde:', dateFrom, 'hasta:', dateTo);

    const supabase = createServerSupabaseAdminClient();

    // Obtener todas las sesiones PAID y USED en el rango
    const { data, error } = await supabase
      .from('payment_sessions')
      .select('session_id, status, created_at')
      .in('status', ['paid', 'used'])
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo);

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener sesiones' },
        { status: 500 }
      );
    }

    console.log('📦 Registros encontrados:', data?.length);
    console.log('📋 Detalle:', data);

    // Contar manualmente
    const paidCount = data?.filter(s => s.status === 'paid').length || 0;
    const usedCount = data?.filter(s => s.status === 'used').length || 0;

    console.log('✅ Paid:', paidCount, 'Used:', usedCount, 'Total:', paidCount + usedCount);

    return NextResponse.json({
      success: true,
      counts: {
        paid: paidCount,
        used: usedCount,
        total: paidCount + usedCount
      }
    });

  } catch (error) {
    console.error('💥 Error in count-by-date:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
