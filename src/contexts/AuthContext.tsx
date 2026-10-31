import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
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
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  // Fetch full profile from public.profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching user profile:', profileError.message)
        return null
      }

      if (data) {
        const fullProfile = data as Profile
        setProfile(fullProfile)
        return fullProfile
      }

      return null
    } catch (err: unknown) {
      console.error('Unexpected error fetching profile:', err)
      return null
    }
  }, [])

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
          await fetchProfile(session.user.id)
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
        // Fetch or refresh the database profile
        await fetchProfile(session.user.id)
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
        const loadedProfile = await fetchProfile(data.user.id)
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
        // Profile will be auto-provisioned by the PostgreSQL handle_new_user trigger
        await fetchProfile(data.user.id)
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
        await fetchProfile(session.user.id)
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
