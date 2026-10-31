import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { SeekerDashboardPage } from '@/pages/SeekerDashboardPage'
import { OwnerDashboardPage } from '@/pages/OwnerDashboardPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AlertCircle, RotateCcw } from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const { role, loading, error, profile, refreshProfile } = useAuth()

  if (loading) {
    return <LoadingSpinner fullPage label="Resolving institutional workspace and role permissions..." />
  }

  if (error && !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-navy-950">Profile Authorization Error</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || 'Unable to authenticate institutional profile from the database.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => refreshProfile()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Profile Authorization</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Role-directed dashboard views:
  // - Owner gets Lab Custodian Console
  // - Admin gets Campus Governance Console
  // - Seeker gets Seeker Overview
  if (role === 'owner') {
    return <OwnerDashboardPage />
  }

  if (role === 'admin') {
    return <AdminDashboardPage />
  }

  return <SeekerDashboardPage />
}

export default DashboardPage
