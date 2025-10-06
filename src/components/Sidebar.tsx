'use client'

import { useState } from 'react'

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
}

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['notifications'])
  
  const toggleSubmenu = (itemId: string) => {
    setExpandedMenus(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }
  const menuItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: '📊'
    },
    {
      id: 'users',
      name: 'Gestión de Usuarios',
      icon: '👥'
    },
    {
      id: 'staff-users',
      name: 'Usuarios Staff',
      icon: '⭐'
    },
    {
      id: 'payments',
      name: 'Gestión Pasarela Pagos',
      icon: '💳'
    },
    {
      id: 'prices',
      name: 'Gestión Precios',
      icon: '💰'
    },
    {
      id: 'images',
      name: 'Gestión de Imágenes',
      icon: '🖼️'
    },
    {
      id: 'moderation',
      name: 'Moderación',
      icon: '⚖️',
      hasSubmenu: true,
      submenu: [
        { id: 'moderation-posts', name: 'Posts', icon: '📝' },
        { id: 'moderation-banned', name: 'Usuarios Banneados', icon: '🚫' },
        { id: 'moderation-cleanup', name: 'Limpieza de Posts', icon: '🗑️' }
      ]
    },
    {
      id: 'notifications',
      name: 'Notificaciones',
      icon: '🔔',
      hasSubmenu: true,
      submenu: [
        { id: 'notifications-broadcast', name: 'Broadcast Masivo', icon: '📢' },
        { id: 'notifications-newsletter', name: 'Newsletter', icon: '📰' },
        { id: 'notifications-templates', name: 'Templates', icon: '📄' },
        { id: 'notifications-logs', name: 'Logs', icon: '📋' },
        { id: 'notifications-cleanup', name: 'Limpieza', icon: '🗑️' }
      ]
    }
  ]

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Navegación</h2>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.hasSubmenu) {
                    toggleSubmenu(item.id)
                  } else {
                    onPageChange(item.id)
                  }
                }}
                className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  currentPage === item.id || (item.hasSubmenu && item.submenu?.some(sub => currentPage === sub.id))
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.hasSubmenu && (
                  <span className={`transform transition-transform ${
                    expandedMenus.includes(item.id) ? 'rotate-90' : ''
                  }`}>
                    ▶
                  </span>
                )}
              </button>
              
              {item.hasSubmenu && item.submenu && expandedMenus.includes(item.id) && (
                <div className="ml-4 mt-2 space-y-1">
                  {item.submenu.map((subItem) => (
                    <button
                      key={subItem.id}
                      onClick={() => onPageChange(subItem.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-left transition-colors text-sm ${
                        currentPage === subItem.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{subItem.icon}</span>
                      <span className="font-medium">{subItem.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}