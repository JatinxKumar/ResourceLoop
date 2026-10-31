import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Clock,
  Tag,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  History,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getUserHistory } from '@/services/audit'
import type { UserHistory } from '@/types/domain'

export const UserHistoryPage: React.FC = () => {
  const { user, profile } = useAuth()
  const [history, setHistory] = useState<UserHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      setLoading(true)
      try {
        const data = await getUserHistory(user.id)
        setHistory(data)
      } catch (err) {
        console.error(err)
        setError((err as Error).message || 'Failed to load user operational record')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner label="Loading user activity and audit trail..." />
        <p className="text-xs text-slate-500 font-medium">Loading user activity and audit trail...</p>
      </div>
    )
  }

  if (error || !history) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs">
          <p className="font-bold text-sm mb-1">Failed to Load User History</p>
          <p>{error || 'Operational data could not be retrieved.'}</p>
        </div>
      </div>
    )
  }

  const { total_reservations, completed_reservations, incidents_logged, bookings, notifications } = history

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'checked_in':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'returned':
        return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'rejected':
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header Profile Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
              <History className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-brand-600 font-mono">
              Institutional Member Record
            </span>
          </div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
            {profile?.full_name || 'Researcher Record'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {profile?.email} • Affiliation:{' '}
            <span className="font-semibold text-navy-900">
              {profile?.organization?.name || 'Verified Academic Network'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3.5 h-3.5" />
            Active Good Standing
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Reservations</span>
            <Calendar className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-2xl font-extrabold text-navy-950">{total_reservations}</p>
          <p className="text-[11px] text-slate-400 mt-1">Lifecycle bookings initiated</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Completed Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600">{completed_reservations}</p>
          <p className="text-[11px] text-slate-400 mt-1">Returned with verified condition</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Reported Incidents</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-navy-950">{incidents_logged}</p>
          <p className="text-[11px] text-slate-400 mt-1">Logged by or involving member</p>
        </div>
      </div>

      {/* Booking History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-navy-950">Reservation & Borrowing History</h2>
          </div>
          <span className="text-xs text-slate-400">{bookings.length} reservations</span>
        </div>

        {bookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No booking reservations recorded for this account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-5">Resource / Asset</th>
                  <th className="p-3">Reservation Window</th>
                  <th className="p-3">Purpose / Notes</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 pl-5 font-semibold text-navy-950">
                      <div>
                        <span>{b.resource?.title || 'Shared Equipment'}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {b.resource?.category || 'Instrument'}
                          </span>
                          {b.resource?.location && (
                            <span className="text-[10px] text-slate-400">• {b.resource.location}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div>{new Date(b.start_time).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs">
                      <p className="line-clamp-2 leading-relaxed">{b.purpose}</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${statusColor(b.status)}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 pr-5 text-right">
                      {b.resource?.id && (
                        <Link
                          to={`/resources/${b.resource.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                        >
                          View
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notifications History */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-navy-950">Activity Logs & Dispatches</h2>
          </div>
          <span className="text-xs text-slate-400">{notifications.length} alerts</span>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No historical dispatches or alerts recorded.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 text-xs flex items-start gap-3 transition-colors ${
                  n.is_read ? 'bg-white' : 'bg-brand-50/20'
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-100 text-slate-500 flex-shrink-0">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="font-semibold text-navy-950">{n.title}</p>
                    <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                  {n.link_url && (
                    <Link
                      to={n.link_url}
                      className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 inline-block mt-1"
                    >
                      Follow link →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
