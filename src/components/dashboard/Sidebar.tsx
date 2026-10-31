import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  Repeat,
  LayoutDashboard,
  Search,
  CalendarCheck,
  Building2,
  ShieldCheck,
  BarChart3,
  LogOut,
  ExternalLink,
  Lock,
  Gift,
  History
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export const Sidebar: React.FC = () => {
  const { role, profile, logout } = useAuth()

  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const isAdmin = role === 'admin'
  const isOwner = role === 'owner'

  const overviewName = isOwner ? 'Custodian Overview' : isAdmin ? 'Campus Governance' : 'Seeker Overview'
  const overviewHref = isOwner ? '/owner' : isAdmin ? '/admin' : '/dashboard'

  const mainNav = [
    { name: overviewName, href: overviewHref, icon: LayoutDashboard },
    { name: 'Browse Catalog', href: '/resources', icon: Search },
    { name: 'My Bookings', href: '/bookings', icon: CalendarCheck },
    { name: 'Custodian Pass Scanner', href: '/checkin', icon: ShieldCheck },
    { name: 'Impact & CapEx', href: '/impact', icon: BarChart3 },
    { name: 'Donations', href: '/donations', icon: Gift },
    { name: 'My History', href: '/history', icon: History },
  ]

  return (
    <aside className="w-64 bg-navy-950 text-slate-300 flex flex-col flex-shrink-0 h-screen sticky top-0 border-r border-navy-900 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-navy-900/80">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm group-hover:bg-brand-500 transition-colors">
            <Repeat className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">
              Resource<span className="text-brand-400">Loop</span>
            </span>
            <span className="block text-[9px] text-slate-400 font-mono uppercase tracking-wider">
              Institutional Core
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Main Workspace
          </p>
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-brand-600/20 text-brand-300 font-semibold border-l-2 border-brand-500 rounded-l-none'
                        : 'text-slate-400 hover:text-white hover:bg-navy-900/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Management Consoles (Role-Gated) */}
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Management Consoles
          </p>
          <nav className="space-y-1">
            {isOwnerOrAdmin ? (
              <NavLink
                to="/owner"
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-300 font-semibold border-l-2 border-brand-500 rounded-l-none'
                      : 'text-slate-400 hover:text-white hover:bg-navy-900/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span>Custodian Console</span>
                </div>
                <span className="text-[10px] font-mono bg-navy-900 text-brand-400 px-1.5 py-0.5 rounded border border-navy-800">
                  Owner
                </span>
              </NavLink>
            ) : null}

            {isAdmin ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-300 font-semibold border-l-2 border-brand-500 rounded-l-none'
                      : 'text-slate-400 hover:text-white hover:bg-navy-900/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>Campus Governance</span>
                </div>
                <span className="text-[10px] font-mono bg-navy-900 text-slate-400 px-1.5 py-0.5 rounded border border-navy-800">
                  Admin
                </span>
              </NavLink>
            ) : null}

            {!isOwnerOrAdmin && (
              <div className="px-3 py-2 rounded-lg text-xs text-slate-400 flex items-center justify-between bg-navy-900/30 border border-navy-900/40">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Custodian Console</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider">Owner Only</span>
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Trust & Institution Footer */}
      <div className="p-3 border-t border-navy-900/80 space-y-2">
        <div className="bg-navy-900/90 rounded-xl p-3 border border-navy-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Database Connected</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed truncate">
            {profile?.organization?.name || 'Academic Network Member'}
          </p>
        </div>

        <div className="flex items-center justify-between px-2 pt-1 text-xs text-slate-400">
          <Link to="/" className="hover:text-slate-200 flex items-center gap-1">
            <span>Public Site</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            onClick={() => logout()}
            className="hover:text-rose-400 flex items-center gap-1 text-slate-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
