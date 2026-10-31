import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Repeat, ArrowRight, Lock, Mail, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, error: authError, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Track return location after login if redirected from a protected route
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    if (!email.trim() || !password) {
      setFormError('Please enter both your email address and password.')
      return
    }

    setIsSubmitting(true)

    const result = await login(email, password)
    setIsSubmitting(false)

    if (result.error) {
      setFormError(result.error.message)
      return
    }

    // Role-aware redirect on successful database login
    if (result.profile?.role === 'owner') {
      navigate('/owner', { replace: true })
    } else if (result.profile?.role === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate(from === '/login' ? '/dashboard' : from, { replace: true })
    }
  }

  // Quick helper to fill seeded demo credentials for testing
  const fillCredentials = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('DemoPass123!')
    setFormError(null)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-900 text-white shadow-sm mb-1">
            <Repeat className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Institutional Single Sign-On</h1>
          <p className="text-xs text-slate-500">
            Sign in with your verified university or laboratory credentials.
          </p>
        </div>

        {/* Database configuration notice if unconfigured */}
        {!isSupabaseConfigured() && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Supabase environment variables are missing. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
            </p>
          </div>
        )}

        {/* Error notification */}
        {(formError || authError) && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Authentication Failed:</span>{' '}
              {formError || authError}
            </div>
          </div>
        )}

        {/* Seeded Credentials Quick-Fill helper */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Test Accounts (Database Seeded)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('m.lin@resourceloop.institution.test')}
              className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-navy-900 truncate"
              title="Seeker: Maya Lin"
            >
              Seeker (Lin)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('h.vance@resourceloop.institution.test')}
              className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-navy-900 truncate"
              title="Owner: Prof. Vance"
            >
              Owner (Vance)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('admin@resourceloop.institution.test')}
              className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-navy-900 truncate"
              title="Admin: Dr. Thorne"
            >
              Admin (Thorne)
            </button>
          </div>
        </div>

        {/* Real Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@university.edu"
                disabled={isSubmitting}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 placeholder:text-slate-400 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isSubmitting}
                className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 placeholder:text-slate-400 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 disabled:bg-slate-400 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to ResourceLoop</span>
                <ArrowRight className="w-4 h-4 text-brand-400" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500">
          New to the institutional network?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Register as a Seeker
          </Link>
        </div>
      </div>
    </div>
  )
}
