import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();
    console.log('Current timestamp for comparison:', now);

    // Obtener todas las sesiones primero para debug
    const { data: allSessions, error: allError } = await supabase
      .from('payment_sessions')
      .select('session_id, status, expires_at, created_at');

    if (allError) {
      console.error('Error fetching all sessions:', allError);
      return NextResponse.json(
        { error: 'Database connection failed', details: allError.message },
        { status: 500 }
      );
    }

    console.log('Total sessions found:', allSessions?.length || 0);
    console.log('Sample session:', allSessions?.[0]);

    // Mostrar estructura de columnas disponibles
    if (allSessions && allSessions.length > 0) {
      console.log('Available columns:', Object.keys(allSessions[0]));
    }

    // Calcular estadísticas manualmente
    const stats = {
      pendingValid: 0,
      pendingExpired: 0,
      expiredMarked: 0,
      used: 0,
      paid: 0,
      total: allSessions?.length || 0
    };

    allSessions?.forEach(session => {
      if (session.status === 'pending') {
        if (new Date(session.expires_at) > new Date()) {
          stats.pendingValid++;
        } else {
          stats.pendingExpired++;
        }
      } else if (session.status === 'expired') {
        stats.expiredMarked++;
      } else if (session.status === 'used') {
        stats.used++;
      } else if (session.status === 'paid') {
        stats.paid++;
      }
    });

    console.log('Calculated stats:', stats);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: now,
      debug: {
        totalFound: allSessions?.length || 0,
        sampleStatuses: allSessions?.slice(0, 3).map(s => s.status) || []
      }
    });

  } catch (error) {
    console.error('Unexpected error in session-stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}