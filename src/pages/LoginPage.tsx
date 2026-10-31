import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Repeat, ShieldCheck, ArrowRight, Lock, Mail, Sparkles } from 'lucide-react'
import { useAuth, UserRole } from '@/contexts/AuthContext'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('seeker')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login(email || 'demo.user@inst.edu', selectedRole)
    if (selectedRole === 'owner') navigate('/owner')
    else if (selectedRole === 'admin') navigate('/admin')
    else navigate('/dashboard')
  }

  const handleQuickDemo = (role: UserRole) => {
    login(`${role}@inst.edu`, role)
    if (role === 'owner') navigate('/owner')
    else if (role === 'admin') navigate('/admin')
    else navigate('/dashboard')
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
            Sign in with your campus identity or select a demo role below.
          </p>
        </div>

        {/* 1-Click Quick Demo Switcher */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Instant Demo Sign-In</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('seeker')}
              className="py-1.5 px-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-navy-900"
            >
              Researcher
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('owner')}
              className="py-1.5 px-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-navy-900"
            >
              Lab Custodian
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="py-1.5 px-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 transition-colors shadow-2xs text-navy-900"
            >
              Campus Admin
            </button>
          </div>
        </div>

        {/* Regular Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Email (.edu)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Access Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="seeker">Researcher / Seeker</option>
              <option value="owner">Lab Custodian / Owner</option>
              <option value="admin">Campus Administrator</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>Sign In to ResourceLoop</span>
            <ArrowRight className="w-4 h-4 text-brand-400" />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500">
          New to the campus network?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Register institution
          </Link>
        </div>
      </div>
    </div>
  )
}
