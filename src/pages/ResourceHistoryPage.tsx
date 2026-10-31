import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  AlertTriangle,
  MapPin,
  Tag,
  BarChart3,
  FileText,
  Clock,
  User,
} from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getResourceHistory } from '@/services/audit'
import type { ResourceHistory } from '@/types/domain'

export const ResourceHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [history, setHistory] = useState<ResourceHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getResourceHistory(id)
        setHistory(data)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load resource history.'
        console.error('[ResourceHistoryPage]', msg)
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  if (loading) {
    return <LoadingSpinner fullPage label="Loading resource operational history..." />
  }

  if (error || !history) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-navy-950">Unable to load history</p>
          <p className="text-xs text-slate-500">{error || 'Resource not found.'}</p>
          <Link
            to={`/resources/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to resource
          </Link>
        </div>
      </div>
    )
  }

  const { resource, total_bookings, completed_bookings, incidents_count, bookings, condition_reports, incidents } = history

  const statusColor = (status: string) => {
    switch (status) {
      case 'returned':
      case 'checked_in':
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      case 'pending':
      case 'waitlisted':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'rejected':
      case 'cancelled':
      case 'overdue':
        return 'bg-rose-50 text-rose-700 border border-rose-200'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const conditionColor = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      case 'fair':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'damaged':
      case 'faulty':
        return 'bg-rose-50 text-rose-700 border border-rose-200'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const incidentStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-rose-50 text-rose-700 border border-rose-200'
      case 'investigating':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'resolved':
      case 'closed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link
            to={`/resources/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to resource
          </Link>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">{resource.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Tag className="w-3 h-3" />
              {resource.category}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              {resource.location}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy-950">{total_bookings}</p>
              <p className="text-xs text-slate-500">Total Bookings</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy-950">{completed_bookings}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy-950">{incidents_count}</p>
              <p className="text-xs text-slate-500">Incidents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Booking History</h2>
            <p className="text-xs text-slate-500">All reservation records for this resource</p>
          </div>
          <span className="text-xs text-slate-500">{bookings.length} Records</span>
        </div>

        {bookings.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-1">
            <Calendar className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-navy-950">No Bookings Yet</p>
            <p className="text-slate-400">This resource has not been reserved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Requester</th>
                  <th className="p-3">Start</th>
                  <th className="p-3">End</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-navy-950 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {b.requester?.full_name || b.requester?.email || 'Unknown'}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(b.start_time).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(b.end_time).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusColor(b.status)}`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 max-w-xs">
                      <p className="line-clamp-2 leading-relaxed">{b.purpose}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Condition Reports */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Condition Reports</h2>
            <p className="text-xs text-slate-500">Pre-usage and post-return inspection records</p>
          </div>
          <span className="text-xs text-slate-500">{condition_reports.length} Reports</span>
        </div>

        {condition_reports.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-1">
            <ClipboardList className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-navy-950">No Condition Reports</p>
            <p className="text-slate-400">No inspections have been logged for this resource.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {condition_reports.map((cr) => (
                  <tr key={cr.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-navy-950 capitalize">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {cr.report_type} inspection
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${conditionColor(cr.condition_status)}`}
                      >
                        {cr.condition_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 max-w-sm">
                      <p className="line-clamp-2 leading-relaxed">{cr.notes || 'No additional notes'}</p>
                    </td>
                    <td className="p-3 text-right font-mono text-[10px] text-slate-400">
                      {new Date(cr.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incidents */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Incident Reports</h2>
            <p className="text-xs text-slate-500">Logged incidents associated with this resource</p>
          </div>
          <span className="text-xs text-slate-500">{incidents.length} Incidents</span>
        </div>

        {incidents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-1">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-navy-950">No Incidents</p>
            <p className="text-slate-400">No incidents have been reported for this resource.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 capitalize font-bold text-navy-950">
                      <span className="inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                        {inc.incident_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${incidentStatusColor(inc.status)}`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 max-w-sm">
                      <p className="line-clamp-2 leading-relaxed">{inc.description}</p>
                      {inc.resolution_notes && (
                        <p className="text-[10px] text-emerald-700 bg-emerald-50 p-1.5 rounded mt-1">
                          Resolution: {inc.resolution_notes}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-[10px] text-slate-400">
                      {new Date(inc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
