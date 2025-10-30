// src/app/api/admin/update-price/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';


interface UpdatePriceRequest {
  newPrice: number;
  effectiveDate: 'immediate' | 'next_cycle';
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

    // Las suscripciones de PayPal se actualizarán manualmente por bloques
    // usando el endpoint /api/admin/paypal/update-batch

    // Preparar mensaje de respuesta
    let message = `✅ Precio actualizado exitosamente a $${newPrice.toFixed(2)} USD en la configuración de la aplicación.`;
    
    if (effectiveDate === 'immediate') {
      message += ' El cambio es efectivo inmediatamente.';
    } else {
      message += ' El cambio será efectivo en el próximo ciclo de facturación.';
    }

    message += '\n\n📋 Próximos pasos:\n';
    message += '1. Usa la sección "Actualizar Suscripciones PayPal" para actualizar precios en bloques\n';
    message += '2. Luego envía notificaciones a los usuarios desde el panel de control';

    console.log(`✅ Precio actualizado en configuración. Usa los paneles para actualizar PayPal y enviar notificaciones.`);

    return NextResponse.json({
      success: true,
      message,
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