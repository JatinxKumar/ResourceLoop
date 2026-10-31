import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Repeat, ShieldCheck, ArrowRight, Building, Mail, Lock, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export const SignupPage: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('Materials Science & NanoTech')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    login(email || 'new.user@inst.edu', 'seeker')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white shadow-sm mb-1">
            <Repeat className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Join ResourceLoop Network</h1>
          <p className="text-xs text-slate-500">
            Activate institutional access to verified laboratories, compute clusters, and fabrication apparatus.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name & Title</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jordan Blake / Maya Chen (PhD Cand.)"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Verified Institutional Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan.blake@university.edu"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Department</label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="Materials Science & NanoTech">Materials Science & NanoTech</option>
                <option value="Computer Science & AI Research">Computer Science & AI Research</option>
                <option value="Mechanical & Robotics Foundry">Mechanical & Robotics Foundry</option>
                <option value="Biomedical & Life Sciences">Biomedical & Life Sciences</option>
                <option value="Earth & Spatial Mapping">Earth & Spatial Mapping</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Create Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-navy-900">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>Campus Reciprocity Charter</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              By joining, you agree to adhere to laboratory safety certifications, QR chain-of-custody protocols, and departmental liability policies.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>Complete Registration & Open Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

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
