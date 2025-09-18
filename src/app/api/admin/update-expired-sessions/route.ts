import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();
    
    // Primero, contar cuántas sesiones serán actualizadas
    const { data: sessionsToUpdate, error: countError } = await supabase
      .from('payment_sessions')
      .select('session_id')
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (countError) {
      console.error('Error counting sessions to update:', countError);
      return NextResponse.json(
        { error: 'Database query failed', details: countError.message },
        { status: 500 }
      );
    }

    const countToUpdate = sessionsToUpdate?.length || 0;
    console.log(`Found ${countToUpdate} pending sessions to mark as expired`);

    if (countToUpdate === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired sessions found to update',
        updated: 0,
        timestamp: now
      });
    }

    // Actualizar status de pending a expired para sesiones expiradas
    const { data: updateResult, error: updateError } = await supabase
      .from('payment_sessions')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', now)
      .select('session_id');

    if (updateError) {
      console.error('Error updating expired sessions:', updateError);
      return NextResponse.json(
        { error: 'Database update failed', details: updateError.message },
        { status: 500 }
      );
    }

    const updatedCount = updateResult?.length || 0;
    console.log(`Successfully updated ${updatedCount} sessions to expired status`);

    return NextResponse.json({
      success: true,
      message: `${updatedCount} sessions marked as expired`,
      updated: updatedCount,
      timestamp: now
    });

  } catch (error) {
    console.error('Unexpected error in update-expired-sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}