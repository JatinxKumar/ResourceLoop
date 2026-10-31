import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'

// Public Pages
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

// Protected / App Pages
import { SeekerDashboardPage } from '@/pages/SeekerDashboardPage'
import { ResourceDiscoveryPage } from '@/pages/ResourceDiscoveryPage'
import { ResourceDetailPage } from '@/pages/ResourceDetailPage'
import { MyBookingsPage } from '@/pages/MyBookingsPage'
import { OwnerDashboardPage } from '@/pages/OwnerDashboardPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { ImpactDashboardPage } from '@/pages/ImpactDashboardPage'

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Website Routes with Navbar & Footer */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          {/* Institutional Portal Routes with Sidebar & Header */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<SeekerDashboardPage />} />
            <Route path="/resources" element={<ResourceDiscoveryPage />} />
            <Route path="/resources/:id" element={<ResourceDetailPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
            <Route path="/owner" element={<OwnerDashboardPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/impact" element={<ImpactDashboardPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
