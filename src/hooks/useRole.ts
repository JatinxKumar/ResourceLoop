import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/domain'

export interface RolePermissions {
  canBrowse: boolean
  canRequest: boolean
  canApprove: boolean
  canManageAssets: boolean
  canAuditCampus: boolean
}

export const useRole = () => {
  const { role, profile, user, isAuthenticated, loading } = useAuth()

  const permissions: RolePermissions = {
    canBrowse: true,
    canRequest: role === 'seeker' || role === 'owner' || role === 'admin',
    canApprove: role === 'owner' || role === 'admin',
    canManageAssets: role === 'owner' || role === 'admin',
    canAuditCampus: role === 'admin'
  }

  return {
    role,
    profile,
    user,
    isAuthenticated,
    loading,
    permissions,
    isSeeker: role === 'seeker',
    isOwner: role === 'owner',
    isAdmin: role === 'admin'
  }
}
