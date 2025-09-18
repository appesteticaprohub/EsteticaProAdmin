import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Primero, contar cuántas sesiones serán eliminadas
    const { data: sessionsToDelete, error: countError } = await supabase
      .from('payment_sessions')
      .select('session_id')
      .eq('status', 'expired');

    if (countError) {
      console.error('Error counting sessions to delete:', countError);
      return NextResponse.json(
        { error: 'Database query failed', details: countError.message },
        { status: 500 }
      );
    }

    const countToDelete = sessionsToDelete?.length || 0;
    console.log(`Found ${countToDelete} expired sessions to delete`);

    if (countToDelete === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired sessions found to delete',
        deleted: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Eliminar sesiones con status='expired'
    const { data: deleteResult, error: deleteError } = await supabase
      .from('payment_sessions')
      .delete()
      .eq('status', 'expired')
      .select('session_id');

    if (deleteError) {
      console.error('Error deleting expired sessions:', deleteError);
      return NextResponse.json(
        { error: 'Database deletion failed', details: deleteError.message },
        { status: 500 }
      );
    }

    const deletedCount = deleteResult?.length || 0;
    console.log(`Successfully deleted ${deletedCount} expired sessions`);

    return NextResponse.json({
      success: true,
      message: `${deletedCount} expired sessions deleted`,
      deleted: deletedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Unexpected error in cleanup-expired-sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}