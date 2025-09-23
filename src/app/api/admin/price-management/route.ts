import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseAdminClient();

    // Obtener configuración de precio
    const { data: priceSetting, error: priceError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'SUBSCRIPTION_PRICE')
      .single();

    if (priceError) {
      console.error('Error obteniendo configuración de precio:', priceError);
      return NextResponse.json({
        success: false,
        message: 'No se encontró configuración de precio. Por favor, crea el registro SUBSCRIPTION_PRICE en app_settings.'
      }, { status: 500 });
    }

    const currentPrice = parseFloat(priceSetting.value);

    // Contar suscripciones activas que serían afectadas
    const { count: activeSubscriptions, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period']);

    if (countError) {
      console.error('Error contando suscripciones activas:', countError);
      return NextResponse.json({
        success: false,
        message: 'Error al contar suscripciones activas'
      }, { status: 500 });
    }

    // Calcular ingresos mensuales actuales
    const totalRevenue = currentPrice * (activeSubscriptions || 0);

    return NextResponse.json({
      success: true,
      data: {
        currentPrice,
        activeSubscriptions: activeSubscriptions || 0,
        totalRevenue
      }
    });

  } catch (error) {
    console.error('Error in price-management API:', error);
    return NextResponse.json({
      success: false,
      message: 'Error interno del servidor'
    }, { status: 500 });
  }
}