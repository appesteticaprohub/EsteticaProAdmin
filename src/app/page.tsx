'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import DashboardStats from '@/components/DashboardStats'
import UserManagement from '@/components/UserManagement'
import PaymentGatewayManagement from '@/components/PaymentGatewayManagement'
import PriceManagement from '@/components/PriceManagement'
import BroadcastComposer from '@/components/BroadcastComposer'
import NewsletterPanel from '@/components/NewsletterPanel'
import TemplateManager from '@/components/TemplateManager'
import NotificationLogs from '@/components/NotificationLogs'
import NotificationCleanup from '@/components/NotificationCleanup'
import ImageSettingsPanel from '@/components/ImageSettingsPanel'
import StorageStatsPanel from '@/components/StorageStatsPanel'
import BannedUsersPanel from '@/components/BannedUsersPanel'
import ContentModerationPanel from '@/components/ContentModerationPanel'

export default function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardStats />
      case 'users':
        return <UserManagement />
      case 'payments':
        return <PaymentGatewayManagement />
      case 'prices':
        return <PriceManagement />
      case 'notifications-broadcast':
        return <BroadcastComposer />
      case 'notifications-newsletter':
        return <NewsletterPanel />
      case 'notifications-templates':
        return <TemplateManager />
      case 'notifications-logs':
        return <NotificationLogs />
      case 'notifications-cleanup':
        return <NotificationCleanup />
        case 'images':
        return (
          <div className="space-y-6">
            <ImageSettingsPanel />
            <StorageStatsPanel />
          </div>
        )
        case 'moderation-posts':
        return <ContentModerationPanel />
        case 'moderation-banned':
        return <BannedUsersPanel />
      default:
        return <DashboardStats />
    }
  }

  return (
    <div className="flex">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}