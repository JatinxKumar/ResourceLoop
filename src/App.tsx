import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'

// Public Pages
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

// Protected Application Pages
import { DashboardPage } from '@/pages/DashboardPage'
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

          {/* Institutional Portal Routes Protected by Supabase Auth & Role-Gated */}
          <Route element={<DashboardLayout />}>
            {/* Unified Role-Aware Dashboard Router */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['seeker', 'owner', 'admin']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            {/* Direct Seeker Console View */}
            <Route
              path="/seeker"
              element={
                <ProtectedRoute allowedRoles={['seeker', 'owner', 'admin']}>
                  <SeekerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources"
              element={
                <ProtectedRoute allowedRoles={['seeker', 'owner', 'admin']}>
                  <ResourceDiscoveryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources/:id"
              element={
                <ProtectedRoute allowedRoles={['seeker', 'owner', 'admin']}>
                  <ResourceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute allowedRoles={['seeker', 'owner', 'admin']}>
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/impact"
              element={
                <ProtectedRoute allowedRoles={['seeker', 'owner', 'admin']}>
                  <ImpactDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Owner-Only Console (Owner & Admin) */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin']}>
                  <OwnerDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Admin-Only Console */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
