import React, { createContext, useContext, useState, useEffect } from 'react'

export type UserRole = 'seeker' | 'owner' | 'admin'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  trustScore: number
  avatarUrl: string
}

interface AuthContextType {
  user: UserProfile | null
  role: UserRole
  setRole: (role: UserRole) => void
  login: (email: string, role?: UserRole) => void
  logout: () => void
  isAuthenticated: boolean
}

const DEFAULT_USERS: Record<UserRole, UserProfile> = {
  seeker: {
    id: 'usr-seeker-1',
    name: 'Jatin Kumar',
    email: 'jatin.k@inst.edu',
    role: 'seeker',
    department: 'Materials Science & AI Research',
    trustScore: 98,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  },
  owner: {
    id: 'usr-owner-1',
    name: 'Dr. Aris Thorne',
    email: 'a.thorne@inst.edu',
    role: 'owner',
    department: 'Advanced Instrumentation Facility',
    trustScore: 100,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
  },
  admin: {
    id: 'usr-admin-1',
    name: 'Dean Eleanor Vance',
    email: 'dean.vance@inst.edu',
    role: 'admin',
    department: 'Office of Campus Research & Operations',
    trustScore: 100,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80'
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('seeker')
  const [user, setUser] = useState<UserProfile | null>(DEFAULT_USERS.seeker)

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    setUser(DEFAULT_USERS[newRole])
    localStorage.setItem('resourceloop_demo_role', newRole)
  }

  useEffect(() => {
    const savedRole = localStorage.getItem('resourceloop_demo_role') as UserRole
    if (savedRole && DEFAULT_USERS[savedRole]) {
      setRoleState(savedRole)
      setUser(DEFAULT_USERS[savedRole])
    }
  }, [])

  const login = (email: string, designatedRole: UserRole = 'seeker') => {
    const matched = {
      ...DEFAULT_USERS[designatedRole],
      email: email || DEFAULT_USERS[designatedRole].email
    }
    setUser(matched)
    setRoleState(designatedRole)
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        setRole,
        login,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
