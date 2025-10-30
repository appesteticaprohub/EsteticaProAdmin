// src/app/api/admin/price-change/send-batch/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdminClient } from '@/lib/server-supabase';
import { sendEmail } from '@/lib/resend';

interface SendBatchRequest {
  newPrice: string;
  batchSize?: number;
  offset?: number;
}

interface RecipientData {
  id: string;
  email: string;
  full_name: string | null;
  subscription_status: string;
}

interface EmailLogEntry {
  user_id: string;
  template_key: string;
  email: string;
  status: 'sent' | 'failed';
  resend_id: string | null;
  error_message: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendBatchRequest = await request.json();
    const { 
      newPrice,
      batchSize = 100,
      offset = 0
    } = body;

    if (!newPrice || parseFloat(newPrice) <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Precio inválido'
      }, { status: 400 });
    }

    const supabase = await createServerSupabaseAdminClient();

    // Obtener usuarios del bloque actual con paginación
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, subscription_status')
      .in('subscription_status', ['Active', 'Payment_Failed', 'Grace_Period'])
      .eq('is_banned', false)
      .range(offset, offset + batchSize - 1);

    if (usersError) {
      console.error('Error obteniendo usuarios:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener usuarios'
      }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No hay más usuarios en este bloque',
          emails_sent: 0,
          notifications_created: 0,
          errors: 0,
          total_users: 0,
          nextOffset: offset,
          hasMore: false
        }
      });
    }

    console.log(`📦 Procesando bloque: ${users.length} usuarios (offset: ${offset})`);

    const results = {
      emails_sent: 0,
      notifications_created: 0,
      errors: 0,
      total_users: users.length,
      resend_test_mode_detected: false
    };

    const emailLogs: EmailLogEntry[] = [];

    // 1. Crear notificaciones in-app para este bloque
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const notifications = users.map((user: RecipientData) => ({
      user_id: user.id,
      type: 'in_app' as const,
      category: 'important' as const,
      title: 'Actualización de Precios',
      message: `El precio de suscripción ha sido actualizado a $${newPrice}. Este cambio será efectivo para nuevas suscripciones y renovaciones.`,
      cta_text: null,
      cta_url: null,
      expires_at: expiresAt,
      is_read: false
    }));

    const { data: notifData, error: notifError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id');

    if (notifError) {
      console.error('❌ Error insertando notificaciones:', notifError);
      results.errors += users.length;
    } else {
      results.notifications_created = notifData?.length || 0;
      console.log(`✅ Notificaciones in-app creadas: ${results.notifications_created}`);
    }

    // 2. Obtener template una sola vez antes del loop (optimización)
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, html_content')
      .eq('template_key', 'price_change')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('❌ Error obteniendo template price_change:', templateError);
      
      // Si no hay template, marcar todos como fallidos
      users.forEach(user => {
        results.errors++;
        emailLogs.push({
          user_id: user.id,
          template_key: 'price_change',
          email: user.email,
          status: 'failed',
          resend_id: null,
          error_message: `Template no encontrado: ${templateError?.message || 'Unknown'}`
        });
      });

      // Guardar logs y retornar
      if (emailLogs.length > 0) {
        await supabase.from('email_logs').insert(emailLogs);
      }

      return NextResponse.json({
        success: false,
        error: 'Template price_change no encontrado o inactivo',
        data: {
          emails_sent: 0,
          notifications_created: results.notifications_created,
          errors: users.length,
          total_users: users.length,
          nextOffset: offset,
          hasMore: false
        }
      }, { status: 500 });
    }

    console.log('✅ Template obtenido correctamente');

    // 3. Enviar emails a cada usuario del bloque
    for (const user of users) {
      try {
        // Reemplazar variables en el template
        const variables = {
          nombre: user.full_name || 'Usuario',
          precio: newPrice,
          app_url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        };

        let personalizedHtml = template.html_content;
        let personalizedSubject = template.subject;

        // Reemplazar cada variable
        Object.entries(variables).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          personalizedHtml = personalizedHtml.replace(regex, value);
          personalizedSubject = personalizedSubject.replace(regex, value);
        });

        // Enviar email directamente (sendEmail maneja los errores)
        console.log(`📤 Enviando email a: ${user.email}`);
        
        const emailResult = await sendEmail({
          to: user.email,
          subject: personalizedSubject,
          html: personalizedHtml,
          skipLogging: true  // Haremos logging manual en batch
        });

        console.log(`📧 Resultado para ${user.email}:`, emailResult.success ? '✅ Exitoso' : '❌ Fallido');
        
        if (emailResult.success) {
          results.emails_sent++;
          
          emailLogs.push({
            user_id: user.id,
            template_key: 'price_change',
            email: user.email,
            status: 'sent',
            resend_id: emailResult.data?.data?.id || null,
            error_message: null
          });
        } else {
          results.errors++;
          
          // Detectar si es error 403 de Resend (modo prueba)
          const errorMessage = emailResult.error || 'Error desconocido';
          const isResendTestMode = errorMessage.includes('validation_error') && errorMessage.includes('testing emails');
          
          if (isResendTestMode) {
            results.resend_test_mode_detected = true;
            console.warn(`   ⚠️ Resend en modo prueba - Solo permite enviar a email verificado`);
          } else {
            console.error(`   Error: ${errorMessage}`);
          }
          
          emailLogs.push({
            user_id: user.id,
            template_key: 'price_change',
            email: user.email,
            status: 'failed',
            resend_id: null,
            error_message: errorMessage
          });
        }

        // Pausa breve entre envíos (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error inesperado enviando a usuario ${user.id}:`, error);
        results.errors++;
        
        emailLogs.push({
          user_id: user.id,
          template_key: 'price_change',
          email: user.email,
          status: 'failed',
          resend_id: null,
          error_message: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    // 4. Guardar logs de emails en batch
    if (emailLogs.length > 0) {
      const { error: logsError } = await supabase
        .from('email_logs')
        .insert(emailLogs);

      if (logsError) {
        console.error('❌ Error guardando logs de emails:', logsError);
      } else {
        console.log(`✅ Logs guardados: ${emailLogs.length}`);
      }
    }

    // Calcular siguiente offset
    const nextOffset = offset + users.length;
    const hasMore = users.length === batchSize;

    console.log(`📊 Resultado del bloque:`);
    console.log(`   - Emails enviados: ${results.emails_sent}`);
    console.log(`   - Notificaciones creadas: ${results.notifications_created}`);
    console.log(`   - Errores: ${results.errors}`);
    console.log(`   - Siguiente offset: ${nextOffset}`);
    console.log(`   - Hay más bloques: ${hasMore}`);

    // Mensaje personalizado si se detectó modo prueba de Resend
    let message = `Bloque procesado: ${results.emails_sent} emails enviados, ${results.notifications_created} notificaciones creadas`;
    
    if (results.resend_test_mode_detected && results.emails_sent === 0) {
      message += ' ⚠️ Resend está en modo prueba - verifica tu dominio en resend.com/domains para enviar a usuarios reales';
    }

    return NextResponse.json({
      success: true,
      data: {
        message,
        emails_sent: results.emails_sent,
        notifications_created: results.notifications_created,
        errors: results.errors,
        total_users: results.total_users,
        nextOffset: nextOffset,
        hasMore: hasMore,
        resend_test_mode: results.resend_test_mode_detected
      }
    });

  } catch (error) {
    console.error('Error en send-batch:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 });
  }
}