import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Header } from '@/components/dashboard/Header'

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex bg-slate-50 text-navy-900 font-sans">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
