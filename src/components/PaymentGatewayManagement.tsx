'use client';

import { useState, useEffect } from 'react';

interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string;
}

interface SessionStats {
  pendingValid: number;
  pendingExpired: number;
  expiredMarked: number;
  used: number;
  paid: number;
  total: number;
}

interface SessionStatsResponse {
  success: boolean;
  stats: SessionStats;
}

export default function PaymentGatewayManagement() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [updatingExpired, setUpdatingExpired] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSessionStats();
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

  const fetchSessionStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch('/api/admin/session-stats');
      const data: SessionStatsResponse = await response.json();
      if (data.success) {
        setSessionStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching session stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const updateExpiredSessions = async () => {
    setUpdatingExpired(true);
    try {
      const response = await fetch('/api/admin/update-expired-sessions', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        // Refrescar estadísticas después de actualizar
        await fetchSessionStats();
      }
    } catch (error) {
      console.error('Error updating expired sessions:', error);
    } finally {
      setUpdatingExpired(false);
    }
  };

  const cleanupExpiredSessions = async () => {
    setCleaningUp(true);
    try {
      const response = await fetch('/api/admin/cleanup-expired-sessions', {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        // Refrescar estadísticas después de limpiar
        await fetchSessionStats();
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    } finally {
      setCleaningUp(false);
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
      {/* Nueva sección: Gestión de Sesiones de Pago */}
      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Gestión de Sesiones de Pago</h3>
              <p className="text-sm text-gray-500 mt-1">
                Monitorea y limpia sesiones de pago expiradas
              </p>
            </div>
            <button
              onClick={fetchSessionStats}
              disabled={loadingStats}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loadingStats ? 'Actualizando...' : 'Actualizar Stats'}
            </button>
          </div>
        </div>

        {/* Estadísticas de Sesiones */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">
              {sessionStats?.pendingValid ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Pending Válidas</div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-800">
              {sessionStats?.pendingExpired ?? 0}
            </div>
            <div className="text-xs text-yellow-600 mt-1">Pending Expiradas</div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-800">
              {sessionStats?.expiredMarked ?? 0}
            </div>
            <div className="text-xs text-red-600 mt-1">Marcadas Expired</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-800">
              {sessionStats?.used ?? 0}
            </div>
            <div className="text-xs text-green-600 mt-1">Usadas</div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-800">
              {sessionStats?.paid ?? 0}
            </div>
            <div className="text-xs text-blue-600 mt-1">Pagadas</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-800">
              {sessionStats?.total ?? 0}
            </div>
            <div className="text-xs text-purple-600 mt-1">Total</div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={updateExpiredSessions}
            disabled={updatingExpired || (sessionStats?.pendingExpired ?? 0) === 0}
            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updatingExpired ? 'Actualizando...' : `Actualizar Estados Expirados (${sessionStats?.pendingExpired ?? 0})`}
          </button>
          
          <button
            onClick={cleanupExpiredSessions}
            disabled={cleaningUp || (sessionStats?.expiredMarked ?? 0) === 0}
            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cleaningUp ? 'Eliminando...' : `Eliminar Sesiones Expiradas (${sessionStats?.expiredMarked ?? 0})`}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>• <strong>Pending Válidas:</strong> Sesiones pendientes que aún no han expirado</p>
          <p>• <strong>Pending Expiradas:</strong> Sesiones pendientes que ya expiraron pero aún no están marcadas</p>
          <p>• <strong>Marcadas Expired:</strong> Sesiones que ya fueron marcadas como expiradas</p>
        </div>
      </div>
    </div>
  );
}