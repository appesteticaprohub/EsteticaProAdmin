'use client';

import { useState, useEffect, useCallback } from 'react';

interface CurrentPriceData {
  currentPrice: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

interface RecipientCount {
  total: number;
  breakdown: {
    Active: number;
    Payment_Failed: number;
    Grace_Period: number;
  };
}

interface SendBatchResponse {
  success: boolean;
  data?: {
    message: string;
    emails_sent: number;
    notifications_created: number;
    errors: number;
    total_users: number;
    nextOffset: number;
    hasMore: boolean;
    resend_test_mode?: boolean;
  };
  error?: string;
}

export default function PriceManagement() {
  const [currentData, setCurrentData] = useState<CurrentPriceData | null>(null);
  const [recipientCount, setRecipientCount] = useState<RecipientCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPrice, setNewPrice] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<'immediate' | 'next_cycle'>('next_cycle');
  
  // Estados para el sistema de bloques
  const [batchSize, setBatchSize] = useState<number>(100);
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [sentCount, setSentCount] = useState<number>(0);
  const [notificationsCreated, setNotificationsCreated] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [hasMoreToSend, setHasMoreToSend] = useState<boolean>(true);
  const [priceUpdated, setPriceUpdated] = useState<boolean>(false);
  const [resendTestMode, setResendTestMode] = useState<boolean>(false);
  // Estados para actualización de PayPal por bloques
  const [paypalBatchSize, setPaypalBatchSize] = useState<number>(100);
  const [paypalCurrentOffset, setPaypalCurrentOffset] = useState<number>(0);
  const [paypalUpdatedCount, setPaypalUpdatedCount] = useState<number>(0);
  const [paypalFailedCount, setPaypalFailedCount] = useState<number>(0);
  const [isUpdatingPaypal, setIsUpdatingPaypal] = useState<boolean>(false);
  const [hasMorePaypalToUpdate, setHasMorePaypalToUpdate] = useState<boolean>(true);
  const [totalPaypalSubscriptions, setTotalPaypalSubscriptions] = useState<number>(0);

   const fetchRecipientCount = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/price-change/count');
      const data = await response.json();
      
      if (data.success) {
        setRecipientCount(data.data);
      } else {
        alert('Error al obtener conteo de destinatarios');
      }
    } catch (error) {
      console.error('Error fetching recipient count:', error);
      alert('Error al obtener conteo de destinatarios');
    }
  }, []);

  const fetchPayPalSubscriptionsCount = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/paypal/subscriptions-count');
      const data = await response.json();
      
      if (data.success) {
        setTotalPaypalSubscriptions(data.total);
      }
    } catch (error) {
      console.error('Error fetching PayPal subscriptions count:', error);
    }
  }, []);

  useEffect(() => {
    fetchCurrentPriceData();
    fetchRecipientCount();
    fetchPayPalSubscriptionsCount();
  }, [fetchRecipientCount, fetchPayPalSubscriptionsCount]);

  const fetchCurrentPriceData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/price-management');
      const data = await response.json();
      if (data.success) {
        setCurrentData(data.data);
        setNewPrice(data.data.currentPrice.toString());
      }
    } catch (error) {
      console.error('Error fetching price data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      alert('Por favor ingresa un precio válido mayor a 0');
      return;
    }

    if (!currentData) return;

    // Validar que el precio sea diferente
    if (parseFloat(newPrice) === currentData.currentPrice) {
      alert('El nuevo precio debe ser diferente al actual');
      return;
    }

    const confirmUpdate = confirm(
      `¿Estás seguro de actualizar el precio?\n\n` +
      `Precio actual: $${currentData.currentPrice}\n` +
      `Nuevo precio: $${newPrice}\n` +
      `Fecha efectiva: ${effectiveDate === 'immediate' ? 'Inmediata' : 'Próximo ciclo'}\n\n` +
      `Esto solo actualizará el precio en la configuración.\n` +
      `Luego podrás notificar a los usuarios por bloques.`
    );

    if (!confirmUpdate) return;

    try {
      const response = await fetch('/api/admin/update-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPrice: parseFloat(newPrice),
          effectiveDate
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${result.message}`);
        setPriceUpdated(true);
        fetchCurrentPriceData();
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Error al actualizar el precio');
    }
  };

  const sendNotificationBatch = async () => {
    if (!priceUpdated) {
      alert('Primero debes actualizar el precio antes de enviar notificaciones');
      return;
    }

    // Solo confirmar al inicio
    if (currentOffset === 0) {
      const confirmSend = confirm(
        `¿Estás seguro de enviar notificaciones?\n\n` +
        `Destinatarios totales: ${recipientCount?.total || 0} usuarios\n` +
        `- Active: ${recipientCount?.breakdown.Active || 0}\n` +
        `- Payment_Failed: ${recipientCount?.breakdown.Payment_Failed || 0}\n` +
        `- Grace_Period: ${recipientCount?.breakdown.Grace_Period || 0}\n\n` +
        `Tamaño de bloque: ${batchSize} usuarios\n\n` +
        `Podrás enviar bloque por bloque manualmente.`
      );

      if (!confirmSend) return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/admin/price-change/send-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPrice: newPrice,
          batchSize: batchSize,
          offset: currentOffset
        })
      });

      if (response.ok) {
        const result: SendBatchResponse = await response.json();
        const data = result.data;

        if (data) {
          // Actualizar contadores
          setSentCount(prev => prev + (data.emails_sent || 0));
          setNotificationsCreated(prev => prev + (data.notifications_created || 0));
          setFailedCount(prev => prev + (data.errors || 0));
          setCurrentOffset(data.nextOffset || 0);
          setHasMoreToSend(data.hasMore || false);
          
          // Detectar si Resend está en modo prueba
          if (data.resend_test_mode) {
            setResendTestMode(true);
          }

          if (data.hasMore) {
            let message = `✅ Bloque enviado correctamente!\n\n` +
                  `Emails exitosos: ${data.emails_sent || 0}\n` +
                  `Notificaciones creadas: ${data.notifications_created || 0}\n` +
                  `Fallidos: ${data.errors || 0}\n\n` +
                  `Progreso: ${sentCount + (data.emails_sent || 0)} / ${recipientCount?.total || 0}`;
            
            if (data.resend_test_mode) {
              message += '\n\n⚠️ Resend está en modo prueba - verifica tu dominio en resend.com/domains para enviar emails a usuarios reales.';
            }
            
            alert(message);
          } else {
            let message = `🎉 ¡Notificaciones completadas!\n\n` +
                  `Total emails enviados: ${sentCount + (data.emails_sent || 0)}\n` +
                  `Total notificaciones in-app: ${notificationsCreated + (data.notifications_created || 0)}\n` +
                  `Total fallidos: ${failedCount + (data.errors || 0)}`;
            
            if (resendTestMode || data.resend_test_mode) {
              message += '\n\n⚠️ Nota: Algunos emails fallaron porque Resend está en modo prueba. En producción con dominio verificado, todos los emails se enviarán correctamente.';
            }
            
            alert(message);
          }
        }
      } else {
        const error = await response.json();
        alert(`Error al enviar bloque: ${error.error || error.message}`);
      }
    } catch (error) {
      console.error('Error sending batch:', error);
      alert('Error al enviar el bloque de notificaciones');
    } finally {
      setIsSending(false);
    }
  };

  const resetSending = () => {
    setCurrentOffset(0);
    setSentCount(0);
    setNotificationsCreated(0);
    setFailedCount(0);
    setHasMoreToSend(true);
    setPriceUpdated(false);
    setResendTestMode(false);
    alert('✅ Listo para nuevo cambio de precio');
  };

  const updatePayPalBatch = async () => {
    if (!priceUpdated) {
      alert('Primero debes actualizar el precio antes de actualizar PayPal');
      return;
    }

    // 🆕 VALIDAR QUE SE HAYAN ENVIADO LAS NOTIFICACIONES PRIMERO
    if (sentCount === 0) {
      alert('⚠️ Primero debes enviar las notificaciones de cambio de precio antes de cancelar PayPal');
      return;
    }

    // Solo confirmar al inicio
    if (paypalCurrentOffset === 0) {
      const confirmUpdate = confirm(
        `¿Estás seguro de actualizar suscripciones en PayPal?\n\n` +
        `Total de suscripciones activas: ${totalPaypalSubscriptions}\n` +
        `Tamaño de bloque: ${paypalBatchSize} suscripciones\n` +
        `Nuevo precio: $${newPrice}\n\n` +
        `Cada bloque tomará aproximadamente ${Math.ceil(paypalBatchSize * 1.1 / 60)} minutos.\n` +
        `Podrás actualizar bloque por bloque manualmente.`
      );

      if (!confirmUpdate) return;
    }

    setIsUpdatingPaypal(true);

    try {
      const response = await fetch('/api/admin/paypal/update-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPrice: newPrice,
          batchSize: paypalBatchSize,
          offset: paypalCurrentOffset
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Actualizar contadores
        setPaypalUpdatedCount(prev => prev + (result.updated || 0));
        setPaypalFailedCount(prev => prev + (result.failed || 0));
        setPaypalCurrentOffset(result.nextOffset || 0);
        setHasMorePaypalToUpdate(result.hasMore || false);

        if (result.hasMore) {
          let message = `✅ Bloque actualizado en PayPal!\n\n` +
                `Exitosas: ${result.updated || 0}\n` +
                `Fallidas: ${result.failed || 0}\n\n` +
                `Progreso: ${paypalUpdatedCount + (result.updated || 0)} / ${result.total || totalPaypalSubscriptions}`;
          
          if (result.errors && result.errors.length > 0) {
            message += `\n\nErrores:\n${result.errors.slice(0, 3).map((e: { email: string; error: string }) => `- ${e.email}: ${e.error}`).join('\n')}`;
            if (result.errors.length > 3) {
              message += `\n... y ${result.errors.length - 3} más`;
            }
          }
          
          alert(message);
        } else {
          let message = `🎉 ¡Actualización de PayPal completada!\n\n` +
                `Total actualizadas: ${paypalUpdatedCount + (result.updated || 0)}\n` +
                `Total fallidas: ${paypalFailedCount + (result.failed || 0)}`;
          
          if (result.errors && result.errors.length > 0) {
            message += `\n\nErrores:\n${result.errors.slice(0, 5).map((e: { email: string; error: string }) => `- ${e.email}: ${e.error}`).join('\n')}`;
          }
          
          alert(message);
        }
      } else {
        const error = await response.json();
        alert(`Error al actualizar bloque: ${error.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error updating PayPal batch:', error);
      alert('Error al actualizar el bloque de PayPal');
    } finally {
      setIsUpdatingPaypal(false);
    }
  };

  const resetPayPalUpdate = () => {
    setPaypalCurrentOffset(0);
    setPaypalUpdatedCount(0);
    setPaypalFailedCount(0);
    setHasMorePaypalToUpdate(true);
    alert('✅ Listo para actualizar PayPal de nuevo');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          💰 Gestión de Precios de Suscripción
        </h2>

        {/* Información actual */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Precio Actual</p>
            <p className="text-2xl font-bold text-blue-600">
              ${currentData?.currentPrice.toFixed(2)} USD
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Suscripciones Activas</p>
            <p className="text-2xl font-bold text-green-600">
              {currentData?.activeSubscriptions || 0}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Ingresos Mensuales</p>
            <p className="text-2xl font-bold text-purple-600">
              ${currentData?.totalRevenue.toFixed(2)} USD
            </p>
          </div>
        </div>

        {/* Destinatarios de notificación */}
        {recipientCount && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3">
              📧 Usuarios que recibirán notificación
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-xl font-bold text-yellow-600">
                  {recipientCount.total}
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-gray-600">Active</p>
                <p className="text-xl font-bold text-green-600">
                  {recipientCount.breakdown.Active}
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-gray-600">Payment Failed</p>
                <p className="text-xl font-bold text-orange-600">
                  {recipientCount.breakdown.Payment_Failed}
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-gray-600">Grace Period</p>
                <p className="text-xl font-bold text-red-600">
                  {recipientCount.breakdown.Grace_Period}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulario de actualización */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nuevo Precio (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={priceUpdated || sentCount > 0}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              placeholder="15.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Efectiva
            </label>
            <select
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value as 'immediate' | 'next_cycle')}
              disabled={priceUpdated || sentCount > 0}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="next_cycle">Próximo Ciclo de Facturación</option>
              <option value="immediate">Inmediato</option>
            </select>
          </div>

          <button
            onClick={handleUpdatePrice}
            disabled={priceUpdated || sentCount > 0}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {priceUpdated ? '✅ Precio Actualizado' : '💾 Actualizar Precio en Configuración'}
          </button>
        </div>
      </div>
      {/* Panel de envío por bloques */}
      {priceUpdated && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            📤 Envío de Notificaciones por Bloques
          </h3>

          <div className="space-y-4">
            {/* Configuración de bloque */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Total Destinatarios</p>
                <p className="text-xl font-bold text-blue-600">
                  {recipientCount?.total || 0}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="text-xs text-gray-600 block mb-1">
                  Tamaño de Bloque
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  disabled={isSending || sentCount > 0}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5 (prueba)</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>

            {/* Barra de progreso */}
            {sentCount > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span className="font-medium">Progreso del Envío</span>
                  <span className="font-bold">
                    {notificationsCreated} / {recipientCount?.total || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                    style={{ width: `${Math.min((notificationsCreated / (recipientCount?.total || 1)) * 100, 100)}%` }}
                  >
                    {Math.round((notificationsCreated / (recipientCount?.total || 1)) * 100)}%
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded text-center">
                    <span className="text-green-600 font-medium">✅ Emails: {sentCount}</span>
                  </div>
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <span className="text-blue-600 font-medium">📲 In-app: {notificationsCreated}</span>
                  </div>
                  {failedCount > 0 && (
                    <div className="bg-red-50 p-2 rounded text-center">
                      <span className="text-red-600 font-medium">❌ Fallidos: {failedCount}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advertencia de modo prueba */}
            {resendTestMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Resend en modo prueba:</strong> Los emails solo se envían a tu dirección verificada. 
                  Las notificaciones in-app se crean normalmente. En producción con dominio verificado, todos los emails se enviarán correctamente.
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="space-y-2">
              <button
                onClick={sendNotificationBatch}
                disabled={isSending || !hasMoreToSend}
                className="w-full px-4 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSending 
                  ? '⏳ Enviando...' 
                  : !hasMoreToSend 
                    ? '✅ Envío Completado' 
                    : sentCount > 0 
                      ? `📤 Enviar Siguiente Bloque (${Math.min(batchSize, (recipientCount?.total || 0) - currentOffset)} usuarios)` 
                      : '📧 Iniciar Envío por Bloques'}
              </button>

              {!hasMoreToSend && sentCount > 0 && (
                <button
                  onClick={resetSending}
                  className="w-full px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  🔄 Preparar Nuevo Cambio de Precio
                </button>
              )}
            </div>
          </div>
        </div>
        
      )}
      {/* Panel de actualización de PayPal por bloques */}
      {priceUpdated && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            💳 Actualizar Suscripciones PayPal por Bloques
          </h3>

          <div className="space-y-4">
            {/* Información y configuración */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Suscripciones Activas</p>
                <p className="text-xl font-bold text-purple-600">
                  {totalPaypalSubscriptions}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="text-xs text-gray-600 block mb-1">
                  Tamaño de Bloque
                </label>
                <select
                  value={paypalBatchSize}
                  onChange={(e) => setPaypalBatchSize(Number(e.target.value))}
                  disabled={isUpdatingPaypal || paypalUpdatedCount > 0}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={5}>5 (prueba - ~0.5 min)</option>
                  <option value={50}>50 (~1 min)</option>
                  <option value={100}>100 (~2 min)</option>
                  <option value={200}>200 (~4 min)</option>
                </select>
              </div>
            </div>

            {/* Barra de progreso PayPal */}
            {paypalUpdatedCount > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span className="font-medium">Progreso de Actualización PayPal</span>
                  <span className="font-bold">
                    {paypalUpdatedCount} / {totalPaypalSubscriptions}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                    style={{ width: `${Math.min((paypalUpdatedCount / (totalPaypalSubscriptions || 1)) * 100, 100)}%` }}
                  >
                    {Math.round((paypalUpdatedCount / (totalPaypalSubscriptions || 1)) * 100)}%
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded text-center">
                    <span className="text-green-600 font-medium">✅ Actualizadas: {paypalUpdatedCount}</span>
                  </div>
                  {paypalFailedCount > 0 && (
                    <div className="bg-red-50 p-2 rounded text-center">
                      <span className="text-red-600 font-medium">❌ Fallidas: {paypalFailedCount}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info importante */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-red-800 mb-2">
                🚨 <strong>Orden Correcto:</strong> Primero envía las notificaciones de cambio de precio, DESPUÉS cancela PayPal.
              </p>
              <p className="text-xs text-red-700">
                Esto evita que los usuarios reciban notificaciones incorrectas de cancelación.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 mb-2">
                ℹ️ <strong>Importante:</strong> Cada bloque toma ~1 segundo por suscripción debido al rate limit de PayPal. 
                Un bloque de 100 tomará aproximadamente 2 minutos.
              </p>
              <p className="text-xs text-blue-700">
                💡 <strong>Se incluyen:</strong> Active, Payment_Failed y Grace_Period (usuarios con suscripciones activas en PayPal)
              </p>
            </div>

            {/* Botones de acción PayPal */}
            <div className="space-y-2">
              <button
                onClick={updatePayPalBatch}
                disabled={isUpdatingPaypal || !hasMorePaypalToUpdate}
                className="w-full px-4 py-3 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isUpdatingPaypal 
                  ? '⏳ Actualizando PayPal...' 
                  : !hasMorePaypalToUpdate 
                    ? '✅ Actualización PayPal Completada' 
                    : paypalUpdatedCount > 0 
                      ? `💳 Actualizar Siguiente Bloque (${Math.min(paypalBatchSize, totalPaypalSubscriptions - paypalCurrentOffset)} suscripciones)` 
                      : '🚀 Iniciar Actualización PayPal'}
              </button>

              {!hasMorePaypalToUpdate && paypalUpdatedCount > 0 && (
                <button
                  onClick={resetPayPalUpdate}
                  className="w-full px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  🔄 Resetear Actualización PayPal
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}