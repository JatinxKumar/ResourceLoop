import { useAuth, UserRole } from '@/contexts/AuthContext'

export interface RolePermissions {
  canBrowse: boolean
  canRequest: boolean
  canApprove: boolean
  canManageAssets: boolean
  canAuditCampus: boolean
}

export const useRole = () => {
  const { role, user, setRole } = useAuth()

  const permissions: RolePermissions = {
    canBrowse: true,
    canRequest: role === 'seeker' || role === 'owner',
    canApprove: role === 'owner' || role === 'admin',
    canManageAssets: role === 'owner' || role === 'admin',
    canAuditCampus: role === 'admin'
  }

  return {
    role,
    user,
    setRole,
    permissions,
    isSeeker: role === 'seeker',
    isOwner: role === 'owner',
    isAdmin: role === 'admin'
  }
}
