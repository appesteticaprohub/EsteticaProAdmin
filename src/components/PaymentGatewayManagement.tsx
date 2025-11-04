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

interface DateRangeCounts {
  paid: number;
  used: number;
  total: number;
}

export default function PaymentGatewayManagement() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [updatingExpired, setUpdatingExpired] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Estados para filtro de fechas
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRangeCounts, setDateRangeCounts] = useState<DateRangeCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [deletingByDate, setDeletingByDate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const fetchCountsByDateRange = async () => {
    if (!dateFrom || !dateTo) {
      alert('Por favor selecciona ambas fechas');
      return;
    }

    setLoadingCounts(true);
    try {
      const response = await fetch('/api/admin/payment-sessions/count-by-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateFrom: `${dateFrom}T00:00:00`,
          dateTo: `${dateTo}T23:59:59`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDateRangeCounts(data.counts);
      } else {
        alert('Error al obtener conteo');
      }
    } catch (error) {
      console.error('Error fetching counts by date:', error);
      alert('Error al obtener conteo');
    } finally {
      setLoadingCounts(false);
    }
  };

  const deleteSessionsByDateRange = async () => {
    if (!dateFrom || !dateTo) {
      return;
    }

    setDeletingByDate(true);
    try {
      const response = await fetch('/api/admin/payment-sessions/delete-by-date', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateFrom: `${dateFrom}T00:00:00`,
          dateTo: `${dateTo}T23:59:59`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ ${data.deletedCount} sesiones eliminadas exitosamente`);
        // Limpiar el conteo y refrescar stats generales
        setDateRangeCounts(null);
        setShowDeleteConfirm(false);
        await fetchSessionStats();
      } else {
        alert('Error al eliminar sesiones');
      }
    } catch (error) {
      console.error('Error deleting sessions by date:', error);
      alert('Error al eliminar sesiones');
    } finally {
      setDeletingByDate(false);
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
                <li>Los usuarios verán &quot;Suscripción mensual automática&quot;</li>
                <li>Se crearán suscripciones recurrentes en PayPal</li>
                <li>Los pagos se renovarán automáticamente cada mes</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                <li>Los usuarios verán &quot;Pago único - Acceso por 1 mes&quot;</li>
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
        {/* Nueva sección: Filtro por Rango de Fechas */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">🗓️ Eliminar Sesiones por Rango de Fechas</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={fetchCountsByDateRange}
            disabled={loadingCounts || !dateFrom || !dateTo}
            className="w-full mb-4 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingCounts ? '🔍 Buscando...' : '🔍 Buscar Sesiones en Rango'}
          </button>

          {/* Mostrar conteo si existe */}
          {dateRangeCounts && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h5 className="text-sm font-medium text-blue-900 mb-3">
                📊 Sesiones encontradas ({dateFrom} - {dateTo}):
              </h5>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dateRangeCounts.paid}
                  </div>
                  <div className="text-xs text-blue-700">Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dateRangeCounts.used}
                  </div>
                  <div className="text-xs text-green-700">Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {dateRangeCounts.total}
                  </div>
                  <div className="text-xs text-purple-700">Total</div>
                </div>
              </div>

              {dateRangeCounts.total > 0 && !showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  🗑️ Eliminar Paid y Used ({dateRangeCounts.total})
                </button>
              )}

              {showDeleteConfirm && (
                <div className="bg-red-50 border border-red-300 rounded-md p-4">
                  <p className="text-sm text-red-800 font-medium mb-3">
                    ⚠️ ¿Estás seguro de eliminar {dateRangeCounts.total} sesiones?
                  </p>
                  <p className="text-xs text-red-700 mb-4">
                    • {dateRangeCounts.paid} sesiones Paid (pagadas pero no usadas)<br />
                    • {dateRangeCounts.used} sesiones Used (ya transferidas a perfiles)<br />
                    <br />
                    Esta acción NO afecta las suscripciones activas de usuarios.<br />
                    Los datos en la tabla &apos;profiles&apos; permanecen intactos.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deletingByDate}
                      className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={deleteSessionsByDateRange}
                      disabled={deletingByDate}
                      className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingByDate ? 'Eliminando...' : 'Sí, Eliminar'}
                    </button>
                  </div>
                </div>
              )}

              {dateRangeCounts.total === 0 && (
                <p className="text-sm text-gray-600 text-center">
                  No se encontraron sesiones Paid o Used en este rango de fechas
                </p>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-3">
            <p className="font-medium mb-1">ℹ️ Información:</p>
            <p>• Solo se eliminarán sesiones con status <strong>paid</strong> o <strong>used</strong></p>
            <p>• Las sesiones <strong>pending</strong> y <strong>expired</strong> NO se eliminarán</p>
            <p>• Esta operación NO afecta los perfiles de usuarios ni sus suscripciones activas</p>
          </div>
        </div>
      </div>
    </div>
  );
}