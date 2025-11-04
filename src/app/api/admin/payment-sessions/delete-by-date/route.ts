import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';

export async function DELETE(request: NextRequest) {
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

    const supabase = createServerSupabaseAdminClient();

    // Eliminar sesiones PAID y USED en el rango
    const { data, error } = await supabase
      .from('payment_sessions')
      .delete()
      .in('status', ['paid', 'used'])
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .select();

    if (error) {
      console.error('Error deleting sessions:', error);
      return NextResponse.json(
        { success: false, error: 'Error al eliminar sesiones' },
        { status: 500 }
      );
    }

    const deletedCount = data?.length || 0;

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `${deletedCount} sesiones eliminadas exitosamente`
    });

  } catch (error) {
    console.error('Error in delete-by-date:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}