import { NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();

    // Contar suscriptores desde notification_preferences (igual que el envío)
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('user_id, profiles!inner(id, email)')
      .eq('email_content', true);

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
      count: count
    });

  } catch (error) {
    console.error('Error en subscribers-count:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}