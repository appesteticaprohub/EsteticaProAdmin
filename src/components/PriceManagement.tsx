'use client';

import { useState, useEffect } from 'react';

interface CurrentPriceData {
  currentPrice: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

interface PriceUpdateResponse {
  success: boolean;
  message: string;
  affectedSubscriptions?: number;
}

export default function PriceManagement() {
  const [currentData, setCurrentData] = useState<CurrentPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPrice, setNewPrice] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<'immediate' | 'next_cycle'>('next_cycle');
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<PriceUpdateResponse | null>(null);

  useEffect(() => {
    fetchCurrentPriceData();
  }, []);

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

  const handlePriceUpdate = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      setUpdateResult({
        success: false,
        message: 'Por favor ingresa un precio válido mayor a 0'
      });
      return;
    }

    setUpdating(true);
    setUpdateResult(null);

    try {
      const response = await fetch('/api/admin/update-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPrice: parseFloat(newPrice),
          effectiveDate,
        }),
      });

      const data = await response.json();
      setUpdateResult(data);

      if (data.success) {
        // Refrescar datos después de actualizar
        await fetchCurrentPriceData();
      }
    } catch (error) {
      console.error('Error updating price:', error);
      setUpdateResult({
        success: false,
        message: 'Error al actualizar el precio. Inténtalo de nuevo.'
      });
    } finally {
      setUpdating(false);
    }
  };

  const estimatedRevenueChange = currentData && newPrice
    ? (parseFloat(newPrice) - currentData.currentPrice) * currentData.activeSubscriptions
    : 0;

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Gestión Precios</h2>
          <p className="text-gray-600 mt-1">Administra los precios de las suscripciones</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Cargando datos de precios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Cambio de Precios</h2>
        <p className="text-gray-600 mt-1">Administra los precios de las suscripciones de forma global</p>
      </div>

      {/* Información actual */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Información Actual</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              ${currentData?.currentPrice.toFixed(2)} USD
            </div>
            <div className="text-sm text-gray-500 mt-1">Precio Vigente</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {currentData?.activeSubscriptions || 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">Suscripciones Activas</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              ${currentData?.totalRevenue.toFixed(2)} USD
            </div>
            <div className="text-sm text-gray-500 mt-1">Ingresos Mensuales</div>
          </div>
        </div>
      </div>

      {/* Formulario de cambio de precio */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cambiar Precio Global</h3>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="newPrice" className="block text-sm font-medium text-gray-700">
              Nuevo Precio (USD)
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="newPrice"
                step="0.01"
                min="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="10.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">USD</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fecha Efectiva
            </label>
            <div className="mt-2 space-y-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="next_cycle"
                  checked={effectiveDate === 'next_cycle'}
                  onChange={(e) => setEffectiveDate(e.target.value as 'next_cycle')}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Próximo ciclo de facturación (recomendado)
                </span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="immediate"
                  checked={effectiveDate === 'immediate'}
                  onChange={(e) => setEffectiveDate(e.target.value as 'immediate')}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Inmediatamente
                </span>
              </label>
            </div>
          </div>

          {/* Vista previa del impacto */}
          {newPrice && parseFloat(newPrice) !== currentData?.currentPrice && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Vista Previa del Impacto</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• {currentData?.activeSubscriptions} suscripciones serán actualizadas</p>
                <p>• Cambio en ingresos estimado: 
                  <span className={`font-medium ml-1 ${estimatedRevenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {estimatedRevenueChange >= 0 ? '+' : ''}${Math.abs(estimatedRevenueChange).toFixed(2)} USD/mes
                  </span>
                </p>
                <p>• Aplicación: {effectiveDate === 'immediate' ? 'Inmediata' : 'Próximo ciclo de facturación'}</p>
              </div>
            </div>
          )}

          {/* Resultado de la actualización */}
          {updateResult && (
            <div className={`p-4 rounded-lg ${updateResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className={`text-sm ${updateResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {updateResult.message}
                {updateResult.affectedSubscriptions && (
                  <div className="mt-1">
                    Suscripciones actualizadas: {updateResult.affectedSubscriptions}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handlePriceUpdate}
              disabled={updating || !newPrice || parseFloat(newPrice) === currentData?.currentPrice}
              className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Aplicando Cambio...' : 'Aplicar Cambio de Precio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}