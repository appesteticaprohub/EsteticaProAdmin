import { NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();

    // Obtener parámetro de filtro de subscription_status
    const { searchParams } = new URL(request.url);
    const subscriptionStatus = searchParams.get('subscription_status') || 'all';

    // Construir query con filtro opcional
    let query = supabase
      .from('notification_preferences')
      .select('user_id, profiles!inner(id, email, subscription_status, is_banned)')
      .eq('email_content', true)
      .eq('profiles.is_banned', false); // Excluir usuarios baneados

    // Aplicar filtro de subscription_status si no es "all"
    if (subscriptionStatus && subscriptionStatus !== 'all') {
      query = query.eq('profiles.subscription_status', subscriptionStatus);
    }

    const { data: preferences, error } = await query;

    if (error) {
      console.error('Error al contar suscriptores:', error);
      return NextResponse.json(
        { error: 'Error al obtener conteo de suscriptores' },
        { status: 500 }
      );
    }

    // Filtrar manualmente los que tienen email válido
    const validRecipients = preferences?.filter(pref => {
      const profile = Array.isArray(pref.profiles) ? pref.profiles[0] : pref.profiles;
      return profile && profile.email;
    }) || [];

    const count = validRecipients.length;

   return NextResponse.json({ 
      count: count,
      subscription_status: subscriptionStatus
    });

  } catch (error) {
    console.error('Error en subscribers-count:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}