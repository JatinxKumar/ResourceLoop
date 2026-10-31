import React from 'react'
import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import type { UserRole } from '@/types/domain'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
  const { user, profile, role, loading, error, isAuthenticated, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner fullPage label="Verifying institutional credentials..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (error && !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-navy-950">Authorization Verification Failed</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || 'Could not verify your role in the institutional database.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => refreshProfile()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Retry Role Verification</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const returnPath = role === 'owner' ? '/owner' : role === 'admin' ? '/admin' : '/dashboard'
    const returnLabel = role === 'owner' ? 'Custodian Console' : role === 'admin' ? 'Campus Governance' : 'Seeker Dashboard'

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 p-8 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-navy-950">Access Restricted</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your authenticated institutional profile currently holds the{' '}
            <span className="font-semibold text-navy-900 bg-slate-100 px-1.5 py-0.5 rounded uppercase font-mono text-[11px]">
              {role}
            </span>{' '}
            role. Access to this console requires{' '}
            <span className="font-semibold text-navy-900">
              {allowedRoles.join(' or ')}
            </span>{' '}
            privileges.
          </p>
          <div className="pt-2">
            <Link
              to={returnPath}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to {returnLabel}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
