// src/app/api/admin/paypal/update-batch/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server-supabase';
import { updatePayPalSubscriptionPrice } from '@/lib/paypal';

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

    // Obtener el bloque de suscripciones activas con paypal_subscription_id
    const { data: subscriptions, error: subsError, count } = await supabase
      .from('profiles')
      .select('id, email, paypal_subscription_id', { count: 'exact' })
      .eq('subscription_status', 'Active')
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
        message: 'No hay más suscripciones para actualizar',
        updated: 0,
        failed: 0,
        total: count || 0,
        hasMore: false,
        nextOffset: offset
      });
    }

    // Actualizar suscripciones en PayPal una por una
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as Array<{ email: string; paypal_id: string; error: string }>
    };

    for (const subscription of subscriptions) {
      try {
        console.log(`🔄 Actualizando PayPal: ${subscription.email}`);
        
        const result = await updatePayPalSubscriptionPrice(
          subscription.paypal_subscription_id!,
          newPrice
        );

        if (result.ok) {
          results.updated++;
          console.log(`✅ Actualizado: ${subscription.email}`);
        } else {
          results.failed++;
          results.errors.push({
            email: subscription.email,
            paypal_id: subscription.paypal_subscription_id!,
            error: typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
          });
          console.log(`❌ Error: ${subscription.email}`);
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          email: subscription.email,
          paypal_id: subscription.paypal_subscription_id!,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
        console.error(`❌ Excepción: ${subscription.email}`, error);
      }

      // Pausa de 1 segundo entre llamadas a PayPal
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const totalSubscriptions = count || 0;
    const processedSoFar = offset + subscriptions.length;
    const hasMore = processedSoFar < totalSubscriptions;
    const nextOffset = hasMore ? offset + batchSize : offset;

    return NextResponse.json({
      message: `Bloque procesado: ${results.updated} actualizadas, ${results.failed} fallidas`,
      updated: results.updated,
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