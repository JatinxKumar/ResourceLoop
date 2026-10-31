import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Search, ShieldCheck, LogOut, User, Building, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  onToggleSidebar?: () => void
}

export const Header: React.FC<HeaderProps> = () => {
  const { user, profile, role, logout } = useAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/resources?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const roleBadgeStyle = {
    admin: 'bg-navy-900 text-white border-navy-950',
    owner: 'bg-brand-50 text-brand-800 border-brand-200',
    seeker: 'bg-slate-100 text-slate-800 border-slate-200'
  }[role] || 'bg-slate-100 text-slate-700'

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campus instruments, spaces, or labs..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-navy-900 placeholder:text-slate-400"
          />
        </div>
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Verified Role Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${roleBadgeStyle}`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
            <span className="capitalize">{role} Account</span>
          </span>
        </div>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-3 px-4 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-navy-950">Activity Alerts</span>
                <span className="text-[10px] text-slate-400">Database connected</span>
              </div>
              <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-semibold text-navy-900">All caught up</p>
                <p className="text-[11px] text-slate-400">No unread notifications on your account.</p>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-navy-900 font-bold text-xs overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span>{profile?.full_name ? profile.full_name[0] : (user?.email?.[0]?.toUpperCase() || 'U')}</span>
            )}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-navy-900 leading-tight">
              {profile?.full_name || user?.email || 'Authenticated User'}
            </div>
            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
              {profile?.organization?.name || user?.email || 'Institutional Member'}
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
