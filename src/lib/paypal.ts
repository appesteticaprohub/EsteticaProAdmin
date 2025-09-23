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
  
  // PayPal no permite cambiar el precio directamente, necesitamos usar "revise"
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/revise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      plan_id: null, // Mantenemos el plan actual
      pricing_revision: {
        pricing_scheme: {
          fixed_price: {
            value: newPrice,
            currency_code: PAYPAL_CONFIG.currency
          }
        }
      },
      effective_time: new Date().toISOString()
    }),
  });

  return {
    status: response.status,
    ok: response.ok,
    data: response.ok ? await response.json() : null,
    error: !response.ok ? await response.text() : null
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

      console.log(`${result.ok ? '✅' : '❌'} Suscripción ${subscription.paypal_subscription_id}: ${result.status}`);
      
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