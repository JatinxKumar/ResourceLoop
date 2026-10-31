import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Search, ShieldCheck, LogOut, CheckCircle2, Check, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { Notification } from '@/types/domain'
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications'

interface HeaderProps {
  onToggleSidebar?: () => void
}

export const Header: React.FC<HeaderProps> = () => {
  const { user, profile, role, logout } = useAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const navigate = useNavigate()

  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = async () => {
    if (!user) return
    setLoadingNotifications(true)
    try {
      const [data, count] = await Promise.all([
        getUserNotifications(user.id),
        getUnreadNotificationCount(user.id),
      ])
      setNotifications(data)
      setUnreadCount(count)
    } finally {
      setLoadingNotifications(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [user])

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(user?.id)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/resources?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const roleBadgeStyle = {
    admin: 'bg-navy-900 text-white border-navy-950',
    owner: 'bg-brand-50 text-brand-800 border-brand-200',
    seeker: 'bg-slate-100 text-slate-800 border-slate-200',
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

        {/* Notifications Icon with Badge */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (!showNotifications) loadNotifications()
            }}
            className="p-2 rounded-lg text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors focus:outline-none relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-600 ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between px-4 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-950">Campus Activity Alerts</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-brand-50 text-brand-700 font-semibold px-1.5 py-0.2 rounded-full border border-brand-200">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-brand-600 hover:text-brand-800 font-semibold"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="font-semibold text-navy-900">All caught up</p>
                    <p className="text-[11px] text-slate-400">No notifications on your account.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors flex items-start gap-2.5 ${
                        n.is_read ? 'bg-white opacity-80' : 'bg-brand-50/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={`font-semibold text-navy-950 truncate ${!n.is_read ? 'text-brand-900' : ''}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                        {n.link_url && (
                          <Link
                            to={n.link_url}
                            onClick={() => setShowNotifications(false)}
                            className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 inline-block mt-1"
                          >
                            View details →
                          </Link>
                        )}
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-navy-900 transition-colors flex-shrink-0"
                          title="Mark read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
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
