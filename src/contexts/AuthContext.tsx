import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentProfile } from '@/services/profiles'
import type { Profile, UserRole } from '@/types/domain'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  role: UserRole
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ error: Error | null; profile?: Profile | null }>
  signup: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; user?: User | null }>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  // Fetch full profile delegating to the backend profile service, with resilient RPC role resolution
  const fetchProfile = useCallback(async (): Promise<Profile | null> => {
    let resolvedUser = user
    if (!resolvedUser) {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      resolvedUser = sessionUser
    }

    if (!resolvedUser) {
      setProfile(null)
      return null
    }

    try {
      const data = await getCurrentProfile()
      if (data && data.role) {
        setProfile(data)
        setError(null)
        return data
      }
    } catch (err: unknown) {
      console.warn('[AuthContext] Backend getCurrentProfile failed, querying database role via RPC:', err)
    }

    // Direct database role resolution using security definer RPC (bypasses RLS recursion on profiles)
    try {
      const { data: rpcRole, error: rpcError } = await supabase.rpc('get_user_role')
      if (rpcError) {
        console.error('[AuthContext] RPC get_user_role failed:', rpcError.message)
        setError(`Failed to retrieve profile role: ${rpcError.message}`)
        setProfile(null)
        return null
      }

      if (rpcRole && (rpcRole === 'owner' || rpcRole === 'admin' || rpcRole === 'seeker')) {
        const resolvedRole = rpcRole as UserRole
        const resolvedProfile: Profile = {
          id: resolvedUser.id,
          full_name: resolvedUser.user_metadata?.full_name || resolvedUser.email?.split('@')[0] || 'Institutional User',
          email: resolvedUser.email || '',
          role: resolvedRole,
          organization_id: resolvedUser.user_metadata?.organization_id || undefined,
          avatar_url: resolvedUser.user_metadata?.avatar_url || null,
          created_at: resolvedUser.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setProfile(resolvedProfile)
        setError(null)
        return resolvedProfile
      } else {
        setError(`Unrecognized role "${rpcRole}" returned from database.`)
        setProfile(null)
        return null
      }
    } catch (fallbackErr: unknown) {
      console.error('[AuthContext] Profile resolution failed:', fallbackErr)
      setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to resolve database profile')
      setProfile(null)
      return null
    }
  }, [user])

  // Initialize auth session on mount
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      setLoading(true)
      try {
        if (!isSupabaseConfigured()) {
          setLoading(false)
          return
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Error retrieving session:', sessionError.message)
        }

        if (session?.user && mounted) {
          setUser(session.user)
          await fetchProfile()
        }
      } catch (err: unknown) {
        console.error('Auth initialization error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initializeAuth()

    // Listen to real-time auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile()
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Real Supabase login
  const login = async (email: string, password: string) => {
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return { error: signInError }
      }

      if (data.user) {
        setUser(data.user)
        const loadedProfile = await fetchProfile()
        setLoading(false)
        return { error: null, profile: loadedProfile }
      }

      setLoading(false)
      return { error: new Error('Authentication succeeded but no user returned.') }
    } catch (err: unknown) {
      const authErr = err instanceof Error ? err : new Error('An unexpected error occurred during login.')
      setError(authErr.message)
      setLoading(false)
      return { error: authErr }
    }
  }

  // Real Supabase signup (strictly creates a seeker account)
  const signup = async (email: string, password: string, fullName: string) => {
    setError(null)
    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'seeker' // Strictly seeker for public registration
          }
        }
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return { error: signUpError }
      }

      if (data.user) {
        setUser(data.user)
        await fetchProfile()
      }

      setLoading(false)
      return { error: null, user: data.user }
    } catch (err: unknown) {
      const authErr = err instanceof Error ? err : new Error('An unexpected error occurred during registration.')
      setError(authErr.message)
      setLoading(false)
      return { error: authErr }
    }
  }

  // Real Supabase logout
  const logout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    } finally {
      setUser(null)
      setProfile(null)
      setError(null)
      setLoading(false)
    }
  }

  // Refresh current session
  const refreshSession = async () => {
    try {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
      if (session?.user) {
        setUser(session.user)
        await fetchProfile()
      }
    } catch (err: unknown) {
      console.error('Failed to refresh session:', err)
    }
  }

  const role: UserRole = profile?.role ?? 'seeker'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshSession,
        refreshProfile: fetchProfile,
        clearError
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
