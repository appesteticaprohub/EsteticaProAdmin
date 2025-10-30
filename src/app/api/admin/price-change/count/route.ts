// src/app/api/admin/price-change/count/route.ts

import { NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';

export async function GET() {
  try {
    const supabase = await createServerSupabaseAdminClient();

    // Contar usuarios con estados que recibirán notificación
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period'])
      .eq('is_banned', false);

    if (error) {
      console.error('Error contando destinatarios:', error);
      return NextResponse.json({
        success: false,
        error: 'Error al contar destinatarios'
      }, { status: 500 });
    }

    // Obtener breakdown por estado
    const { data: breakdown, error: breakdownError } = await supabase
      .from('profiles')
      .select('subscription_status')
      .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period'])
      .eq('is_banned', false);

    const statusCounts = {
      Active: 0,
      Payment_Failed: 0,
      Grace_Period: 0
    };

    if (!breakdownError && breakdown) {
      breakdown.forEach((profile: { subscription_status: string }) => {
        if (profile.subscription_status in statusCounts) {
          statusCounts[profile.subscription_status as keyof typeof statusCounts]++;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        total: count || 0,
        breakdown: statusCounts
      }
    });

  } catch (error) {
    console.error('Error en price-change/count:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}