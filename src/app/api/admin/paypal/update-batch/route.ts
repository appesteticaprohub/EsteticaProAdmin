// src/app/api/admin/paypal/update-batch/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server-supabase';
import { cancelActiveSubscriptionsForPriceChange } from '@/lib/paypal';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verificar autenticación de admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario sea admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { newPrice, batchSize = 100, offset = 0 } = await request.json();

    if (!newPrice || isNaN(parseFloat(newPrice))) {
      return NextResponse.json(
        { error: 'Precio inválido' },
        { status: 400 }
      );
    }

    // NUEVA ESTRATEGIA: Solo obtener usuarios Active para cancelar
    // Payment_Failed y Grace_Period mantendrán sus suscripciones PayPal
    const { data: subscriptions, error: subsError, count } = await supabase
      .from('profiles')
      .select('id, email, paypal_subscription_id', { count: 'exact' })
      .eq('subscription_status', 'Active')  // Solo usuarios Active
      .not('paypal_subscription_id', 'is', null)
      .eq('is_banned', false)
      .range(offset, offset + batchSize - 1);

    if (subsError) {
      console.error('Error obteniendo suscripciones:', subsError);
      return NextResponse.json(
        { error: 'Error obteniendo suscripciones' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        message: 'No hay más suscripciones Active para cancelar',
        updated: 0,
        failed: 0,
        total: count || 0,
        hasMore: false,
        nextOffset: offset
      });
    }

    // NUEVA ESTRATEGIA: Cancelar suscripciones Active en PayPal
    console.log(`🔄 Cancelando ${subscriptions.length} suscripciones Active en PayPal...`);
    
    const results = await cancelActiveSubscriptionsForPriceChange(subscriptions);

    const totalSubscriptions = count || 0;
    const processedSoFar = offset + subscriptions.length;
    const hasMore = processedSoFar < totalSubscriptions;
    const nextOffset = hasMore ? offset + batchSize : offset;

    return NextResponse.json({
      message: `Bloque procesado: ${results.cancelled} canceladas, ${results.failed} fallidas`,
      updated: results.cancelled,  // Para mantener compatibilidad con frontend
      failed: results.failed,
      errors: results.errors,
      processedSoFar,
      total: totalSubscriptions,
      hasMore,
      nextOffset,
      progress: totalSubscriptions > 0 
        ? Math.round((processedSoFar / totalSubscriptions) * 100)
        : 100
    });

  } catch (error) {
    console.error('Error en update-batch:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}