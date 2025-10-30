// src/app/api/admin/paypal/subscriptions-count/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server-supabase';

export async function GET() {
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

    // Contar suscripciones activas con paypal_subscription_id
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'Active')
      .not('paypal_subscription_id', 'is', null)
      .eq('is_banned', false);

    if (error) {
      console.error('Error contando suscripciones PayPal:', error);
      return NextResponse.json(
        { error: 'Error al contar suscripciones' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      total: count || 0
    });

  } catch (error) {
    console.error('Error en subscriptions-count:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}