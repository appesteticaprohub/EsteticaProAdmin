export default function DashboardStats() {
  const stats = [
    {
      title: 'Total Usuarios',
      value: '2,847',
      change: '+12%',
      changeType: 'positive',
      icon: '👥'
    },
    {
      title: 'Posts Publicados',
      value: '1,234',
      change: '+8%',
      changeType: 'positive',
      icon: '📝'
    },
    {
      title: 'Comentarios',
      value: '5,678',
      change: '+15%',
      changeType: 'positive',
      icon: '💬'
    },
    {
      title: 'Suscripciones Activas',
      value: '1,892',
      change: '+3%',
      changeType: 'positive',
      icon: '⭐'
    }
  ]

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
                <p className={`text-sm mt-2 ${
                  stat.changeType === 'positive' 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {stat.change} vs mes anterior
                </p>
              </div>
              <div className="text-3xl">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm">👤</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Nuevo usuario registrado</p>
                <p className="text-xs text-gray-500">Hace 2 minutos</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">📝</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Nuevo post publicado</p>
                <p className="text-xs text-gray-500">Hace 5 minutos</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 text-sm">💰</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Nueva suscripción activada</p>
                <p className="text-xs text-gray-500">Hace 10 minutos</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Sistema</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Estado del servidor</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Activo
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Base de datos</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Conectada
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Último backup</span>
              <span className="text-sm text-gray-900">Hace 1 hora</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Versión</span>
              <span className="text-sm text-gray-900">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}