'use client';

import { useState, useEffect } from 'react';

interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string;
}

export default function PaymentGatewayManagement() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data.settings || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    setUpdating(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });

      if (response.ok) {
        // Actualizar el estado local
        setSettings(prev => 
          prev.map(setting => 
            setting.key === key 
              ? { ...setting, value }
              : setting
          )
        );
      } else {
        console.error('Error updating setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    } finally {
      setUpdating(false);
    }
  };

  const autoRenewalSetting = settings.find(s => s.key === 'ENABLE_AUTO_RENEWAL');
  const isAutoRenewalEnabled = autoRenewalSetting?.value === 'true';

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Gestión Pasarela Pagos</h2>
          <p className="text-gray-600 mt-1">Aquí puedes modificar el comportamiento de la Pasarela de pagos</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Cargando configuraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión Pasarela Pagos</h2>
        <p className="text-gray-600 mt-1">Aquí puedes modificar el comportamiento de la Pasarela de pagos</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración de Pagos</h3>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">Tipo de Suscripción</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {isAutoRenewalEnabled 
                    ? 'Suscripciones automáticas mensuales habilitadas' 
                    : 'Pagos únicos por acceso de 1 mes habilitados'
                  }
                </p>
              </div>
              
              <div className="flex items-center">
                <span className="mr-3 text-sm text-gray-700">
                  {isAutoRenewalEnabled ? 'Automático' : 'Pago Único'}
                </span>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => updateSetting('ENABLE_AUTO_RENEWAL', isAutoRenewalEnabled ? 'false' : 'true')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                    updating ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    isAutoRenewalEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isAutoRenewalEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <h4 className="font-medium text-gray-900 mb-2">Comportamiento actual:</h4>
            {isAutoRenewalEnabled ? (
              <ul className="list-disc list-inside space-y-1">
                <li>Los usuarios verán "Suscripción mensual automática"</li>
                <li>Se crearán suscripciones recurrentes en PayPal</li>
                <li>Los pagos se renovarán automáticamente cada mes</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                <li>Los usuarios verán "Pago único - Acceso por 1 mes"</li>
                <li>Se crearán pagos únicos en PayPal</li>
                <li>Los usuarios deberán pagar manualmente cada mes</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}