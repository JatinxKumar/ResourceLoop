import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Repeat, ShieldCheck, ArrowRight, Mail, Lock, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const { signup, error: authError, clearError } = useAuth()
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    if (!fullName.trim()) {
      setFormError('Please enter your full name and institutional title.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setFormError('Please provide a valid institutional email address.')
      return
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter identical passwords.')
      return
    }

    setIsSubmitting(true)
    const result = await signup(email, password, fullName)
    setIsSubmitting(false)

    if (result.error) {
      setFormError(result.error.message)
      return
    }

    if (result.user) {
      setSignupSuccess(true)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white shadow-sm mb-1">
            <Repeat className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Create Seeker Account</h1>
          <p className="text-xs text-slate-500">
            Join ResourceLoop to browse, reserve, and borrow verified campus apparatus.
          </p>
        </div>

        {!isSupabaseConfigured() && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Supabase environment variables are missing. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
            </p>
          </div>
        )}

        {(formError || authError) && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Registration Notice:</span>{' '}
              {formError || authError}
            </div>
          </div>
        )}

        {signupSuccess ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-emerald-950">Registration Confirmed</h3>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Your institutional seeker account for <strong>{email}</strong> has been registered in the database.
            </p>
            <div className="pt-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors"
              >
                Proceed to Seeker Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name & Institutional Title
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maya Lin (Graduate Researcher)"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 placeholder:text-slate-400 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Institutional Email Address (.edu / .test)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 placeholder:text-slate-400 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Create Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 placeholder:text-slate-400 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 placeholder:text-slate-400 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-navy-900">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <span>Account Role: Seeker</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Public registration provisions verified Seeker permissions. Facility owners and institutional administrators are designated by campus IT.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {isSubmitting ? (
                <span>Registering Account in Supabase...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-2 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-navy-900 hover:underline">
            Sign In with SSO
          </Link>
        </div>
      </div>
    </div>
  )
}
