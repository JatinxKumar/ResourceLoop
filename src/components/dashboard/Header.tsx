import React, { useState } from 'react'
import { Bell, Search, ShieldCheck, ChevronDown, Check, LogOut, User, Sparkles } from 'lucide-react'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  onToggleSidebar?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, role, setRole, logout } = useAuth()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()

  const rolesList: { id: UserRole; label: string; desc: string; path: string }[] = [
    { id: 'seeker', label: 'Researcher / Seeker', desc: 'Browse and borrow campus equipment', path: '/dashboard' },
    { id: 'owner', label: 'Lab Custodian / Owner', desc: 'Manage laboratory assets & approvals', path: '/owner' },
    { id: 'admin', label: 'Campus Administrator', desc: 'Institutional oversight & safety audit', path: '/admin' },
  ]

  const handleRoleChange = (newRole: UserRole, targetPath: string) => {
    setRole(newRole)
    setShowRoleMenu(false)
    navigate(targetPath)
  }

  const notifications = [
    { id: 1, title: 'Booking Approved', message: 'Benchtop SEM reservation approved by Dr. Thorne.', time: '10m ago', unread: true },
    { id: 2, title: 'Maintenance Window', message: 'ECE Oscilloscope scheduled for calibration tomorrow.', time: '2h ago', unread: false },
    { id: 3, title: 'Trust Score Update', message: 'You achieved Tier 1 Verified Researcher status.', time: '1d ago', unread: false }
  ]

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search equipment, labs, model codes (e.g. LAB-MAT-884)..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-navy-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Persona Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-navy-900 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="hidden sm:inline text-slate-500 font-normal">Active View:</span>
            <span className="font-semibold capitalize text-brand-700">{role}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Persona
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Test role-based views for hackathon demo
                </p>
              </div>

              <div className="p-1 space-y-1">
                {rolesList.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleRoleChange(item.id, item.path)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-start justify-between transition-colors ${
                      role === item.id ? 'bg-brand-50 text-brand-900' : 'hover:bg-slate-50 text-navy-900'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{item.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    {role === item.id && <Check className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-navy-900">Institutional Activity</span>
                <span className="text-[11px] font-medium text-brand-600 hover:underline cursor-pointer">
                  Mark all read
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy-900">{n.title}</span>
                      <span className="text-[10px] text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Pill / Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <img
            src={user?.avatarUrl}
            alt={user?.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-200"
          />
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-navy-900 leading-tight">{user?.name}</div>
            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{user?.department}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
