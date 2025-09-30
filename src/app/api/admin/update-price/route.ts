import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';
import { updateMultipleSubscriptionsPrices } from '../../../../lib/paypal';
import { NotificationBroadcastService } from '@/lib/notification-service';

interface UpdatePriceRequest {
  newPrice: number;
  effectiveDate: 'immediate' | 'next_cycle';
}

interface PayPalUpdateResult {
  userId: string;
  paypalSubscriptionId: string;
  success: boolean;
  status?: number;
  error?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdatePriceRequest = await request.json();
    const { newPrice, effectiveDate } = body;

    // Validar entrada
    if (!newPrice || newPrice <= 0) {
      return NextResponse.json({
        success: false,
        message: 'El precio debe ser mayor a 0'
      }, { status: 400 });
    }

    if (!effectiveDate || !['immediate', 'next_cycle'].includes(effectiveDate)) {
      return NextResponse.json({
        success: false,
        message: 'Fecha efectiva inválida'
      }, { status: 400 });
    }

    const supabase = await createServerSupabaseAdminClient();

    // Actualizar el precio en app_settings
    const { error: updateError } = await supabase
      .from('app_settings')
      .update({ 
        value: newPrice.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('key', 'SUBSCRIPTION_PRICE');

    if (updateError) {
      console.error('Error actualizando precio en app_settings:', updateError);
      return NextResponse.json({
        success: false,
        message: 'Error al actualizar configuración de precio'
      }, { status: 500 });
    }

    // Contar suscripciones que serán afectadas
    const { count: affectedCount, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period']);

    if (countError) {
      console.error('Error contando suscripciones afectadas:', countError);
    }

    // Obtener suscripciones activas que necesitan actualización en PayPal
    const { data: activeSubscriptions, error: subscriptionsError } = await supabase
      .from('profiles')
      .select('id, paypal_subscription_id, email, full_name')
      .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period'])
      .not('paypal_subscription_id', 'is', null);

    if (subscriptionsError) {
      console.error('Error obteniendo suscripciones activas:', subscriptionsError);
      return NextResponse.json({
        success: false,
        message: 'Error al obtener suscripciones para actualizar'
      }, { status: 500 });
    }

    let paypalResults: PayPalUpdateResult[] = [];
    let successfulUpdates = 0;
    let failedUpdates = 0;

    // Actualizar suscripciones en PayPal si existen
    if (activeSubscriptions && activeSubscriptions.length > 0) {
      console.log(`🔄 Actualizando ${activeSubscriptions.length} suscripciones en PayPal...`);
      
      try {
        paypalResults = await updateMultipleSubscriptionsPrices(
          activeSubscriptions.map(sub => ({
            id: sub.id,
            paypal_subscription_id: sub.paypal_subscription_id!
          })),
          newPrice.toString()
        );

        // Contar resultados exitosos y fallidos
        successfulUpdates = paypalResults.filter(result => result.success).length;
        failedUpdates = paypalResults.filter(result => !result.success).length;

        console.log(`✅ Suscripciones actualizadas exitosamente: ${successfulUpdates}`);
        console.log(`❌ Suscripciones que fallaron: ${failedUpdates}`);

      } catch (error) {
        console.error('Error actualizando suscripciones en PayPal:', error);
        failedUpdates = activeSubscriptions.length;
      }
    }

    // Enviar notificaciones reales a todos los usuarios activos
    let notificationResults = null
    
    try {
      console.log(`📧 Enviando notificaciones de cambio de precio...`);
      
      const notifResult = await NotificationBroadcastService.sendPriceChangeNotification(newPrice.toString())
      
      if (notifResult.success && notifResult.data) {
        notificationResults = notifResult.data
        console.log(`✅ Notificaciones enviadas:`);
        console.log(`   - Emails enviados: ${notifResult.data.emails_sent}`);
        console.log(`   - Notificaciones in-app: ${notifResult.data.notifications_created}`);
        console.log(`   - Errores: ${notifResult.data.errors}`);
      } else {
        console.error('❌ Error enviando notificaciones:', notifResult.error);
      }
    } catch (notifError) {
      console.error('❌ Error en servicio de notificaciones:', notifError);
    }

    // Preparar mensaje de respuesta
    let message = `Precio actualizado exitosamente a $${newPrice.toFixed(2)} USD en la configuración base.`;
    
    if (effectiveDate === 'immediate') {
      message += ' El cambio es efectivo inmediatamente.';
    } else {
      message += ' El cambio será efectivo en el próximo ciclo de facturación.';
    }

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      message += ` Se procesaron ${activeSubscriptions.length} suscripciones activas: ${successfulUpdates} exitosas, ${failedUpdates} fallidas.`;
      
      if (failedUpdates > 0) {
        message += ' Las suscripciones fallidas mantendrán el precio anterior hasta la próxima renovación.';
      }
    } else {
      message += ' No se encontraron suscripciones activas para actualizar en PayPal.';
    }

    return NextResponse.json({
      success: true,
      message,
      affectedSubscriptions: affectedCount || 0,
      paypalUpdates: {
        total: activeSubscriptions?.length || 0,
        successful: successfulUpdates,
        failed: failedUpdates,
        results: paypalResults
      },
      notifications: notificationResults ? {
        emails_sent: notificationResults.emails_sent,
        notifications_created: notificationResults.notifications_created,
        errors: notificationResults.errors,
        total_users: notificationResults.total_users
      } : null,
      newPrice,
      effectiveDate
    });

  } catch (error) {
    console.error('Error in update-price API:', error);
    return NextResponse.json({
      success: false,
      message: 'Error interno del servidor'
    }, { status: 500 });
  }
}