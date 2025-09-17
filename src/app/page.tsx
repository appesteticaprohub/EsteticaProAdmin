'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import DashboardStats from '@/components/DashboardStats'
import UserManagement from '@/components/UserManagement'

export default function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardStats />
      case 'users':
        return <UserManagement />
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