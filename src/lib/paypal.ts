// src/lib/paypal.ts
// Configuración de PayPal para la app admin
const PAYPAL_CONFIG = {
  currency: 'USD',
  environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
  clientId: process.env.PAYPAL_CLIENT_ID!,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
};

const PAYPAL_BASE_URL = PAYPAL_CONFIG.environment === 'production' 
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

// Obtener token de acceso de PayPal
async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// Actualizar precio de una suscripción específica
export async function updatePayPalSubscriptionPrice(subscriptionId: string, newPrice: string) {
  const accessToken = await getPayPalAccessToken();
  
  // PASO 1: Obtener el plan_id actual de la suscripción
  console.log(`📋 Obteniendo plan_id de la suscripción ${subscriptionId}...`);
  const subscriptionResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!subscriptionResponse.ok) {
    const errorText = await subscriptionResponse.text();
    console.error(`❌ Error obteniendo suscripción:`, errorText);
    return {
      status: subscriptionResponse.status,
      ok: false,
      data: null,
      error: errorText
    };
  }

  const subscriptionData = await subscriptionResponse.json();
  const planId = subscriptionData.plan_id;
  
  if (!planId) {
    console.error(`❌ No se encontró plan_id en la suscripción`);
    return {
      status: 400,
      ok: false,
      data: null,
      error: 'plan_id not found in subscription'
    };
  }

  console.log(`✅ plan_id obtenido: ${planId}`);
  
  // PASO 2: Actualizar el precio usando el plan_id correcto
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/revise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      plan_id: planId, // Usar el plan_id real
      pricing_revision: {
        pricing_scheme: {
          fixed_price: {
            value: newPrice,
            currency_code: PAYPAL_CONFIG.currency
          }
        }
      }
    }),
  });

  let errorData = null;
  let successData = null;

  if (response.ok) {
    successData = await response.json();
  } else {
    // Intentar parsear como JSON primero
    const errorText = await response.text();
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = errorText;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data: successData,
    error: errorData
  };
}

// Actualizar múltiples suscripciones
export async function updateMultipleSubscriptionsPrices(subscriptions: Array<{id: string, paypal_subscription_id: string}>, newPrice: string) {
  const results = [];
  
  for (const subscription of subscriptions) {
    try {
      console.log(`🔄 Actualizando suscripción PayPal: ${subscription.paypal_subscription_id}`);
      
      const result = await updatePayPalSubscriptionPrice(subscription.paypal_subscription_id, newPrice);
      
      results.push({
        userId: subscription.id,
        paypalSubscriptionId: subscription.paypal_subscription_id,
        success: result.ok,
        status: result.status,
        error: result.error
      });

      if (result.ok) {
        console.log(`✅ Suscripción ${subscription.paypal_subscription_id}: ${result.status}`);
      } else {
        console.log(`❌ Suscripción ${subscription.paypal_subscription_id}: ${result.status}`);
        console.log(`❌ Error detallado de PayPal:`, JSON.stringify(result.error, null, 2));
      }
      
    } catch (error) {
      console.error(`❌ Error actualizando suscripción ${subscription.paypal_subscription_id}:`, error);
      
      results.push({
        userId: subscription.id,
        paypalSubscriptionId: subscription.paypal_subscription_id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Pequeño delay entre llamadas para no saturar la API de PayPal
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Verificar estado de suscripción
export async function verifyPayPalSubscription(subscriptionId: string) {
  const accessToken = await getPayPalAccessToken();
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return response.json();
}

// Cancelar suscripción de PayPal (para baneo de usuarios)
export async function cancelPayPalSubscription(subscriptionId: string, reason: string = 'User banned by administrator') {
  try {
    const accessToken = await getPayPalAccessToken();
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        reason: reason
      }),
    });

    // PayPal retorna 204 No Content en éxito
    if (response.status === 204) {
      return {
        success: true,
        status: 204,
        message: 'Subscription cancelled successfully'
      };
    }

    // Si no es 204, algo salió mal
    const errorText = await response.text();
    return {
      success: false,
      status: response.status,
      error: errorText || 'Failed to cancel subscription'
    };

  } catch (error) {
    console.error('Error cancelling PayPal subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Cancelar múltiples suscripciones activas para cambio de precio
export async function cancelActiveSubscriptionsForPriceChange(subscriptions: Array<{id: string, paypal_subscription_id: string, email: string}>) {
  const results = {
    cancelled: 0,
    failed: 0,
    errors: [] as Array<{ email: string; paypal_id: string; error: string }>
  };
  
  for (const subscription of subscriptions) {
    try {
      console.log(`🔄 Cancelando PayPal para cambio de precio: ${subscription.email}`);
      
      const result = await cancelPayPalSubscription(
        subscription.paypal_subscription_id, 
        "Subscription cancelled due to price change - user will maintain access until expiration"
      );
      
      if (result.success) {
        results.cancelled++;
        console.log(`✅ Cancelado: ${subscription.email}`);
      } else {
        results.failed++;
        results.errors.push({
          email: subscription.email,
          paypal_id: subscription.paypal_subscription_id,
          error: typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
        });
        console.log(`❌ Error cancelando: ${subscription.email}`);
      }

    } catch (error) {
      results.failed++;
      results.errors.push({
        email: subscription.email,
        paypal_id: subscription.paypal_subscription_id,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      console.error(`❌ Excepción cancelando: ${subscription.email}`, error);
    }
    
    // Pausa de 1 segundo entre llamadas a PayPal para respetar rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}