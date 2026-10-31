import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Clock,
  Calendar,
  User,
  Building,
  AlertTriangle,
  ExternalLink,
  Ban,
} from 'lucide-react'
import { fetchOwnerBookings, approveBooking, rejectBooking } from '@/hooks/useBookings'
import { useAuth } from '@/contexts/AuthContext'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { EligibilityPanel } from '@/components/bookings/EligibilityPanel'
import { IncidentReportModal } from '@/components/bookings/IncidentReportModal'
import type { Booking } from '@/types/domain'

type OwnerFilterTab = 'all' | 'pending' | 'approved' | 'active' | 'completed'

export const OwnerBookingsPage: React.FC = () => {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<OwnerFilterTab>('pending')
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [incidentBooking, setIncidentBooking] = useState<Booking | null>(null)

  const loadBookings = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOwnerBookings(user.id)
      setBookings(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load booking requests.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (!actionFeedback) return
    const timer = setTimeout(() => setActionFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [actionFeedback])

  const filteredBookings = bookings.filter((b) => {
    switch (filterTab) {
      case 'pending': return b.status === 'pending' || b.status === 'waitlisted'
      case 'approved': return b.status === 'approved'
      case 'active': return b.status === 'checked_in'
      case 'completed': return b.status === 'returned' || b.status === 'cancelled' || b.status === 'rejected'
      default: return true
    }
  })

  const pendingCount = bookings.filter((b) => b.status === 'pending').length
  const activeCount = bookings.filter((b) => b.status === 'checked_in' || b.status === 'approved').length

  const handleApprove = async (bookingId: string) => {
    setProcessingId(bookingId)
    setActionFeedback(null)
    try {
      await approveBooking(bookingId)
      setActionFeedback({ type: 'success', text: 'Booking approved.' })
      await loadBookings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve booking.'
      setActionFeedback({ type: 'error', text: msg })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (bookingId: string) => {
    if (!rejectionReason.trim()) {
      setActionFeedback({ type: 'error', text: 'Provide a rejection reason.' })
      return
    }
    setProcessingId(bookingId)
    setActionFeedback(null)
    try {
      await rejectBooking(bookingId, rejectionReason.trim())
      setActionFeedback({ type: 'success', text: 'Booking declined.' })
      setRejectingId(null)
      setRejectionReason('')
      await loadBookings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to decline booking.'
      setActionFeedback({ type: 'error', text: msg })
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const TABS: { key: OwnerFilterTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending Review', count: pendingCount },
    { key: 'approved', label: 'Approved' },
    { key: 'active', label: 'Active Sessions', count: activeCount },
    { key: 'completed', label: 'History' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Booking Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review, approve, and manage incoming reservation requests for your resources.
          </p>
        </div>
        <button
          onClick={() => loadBookings()}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <p>{actionFeedback.text}</p>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              filterTab === tab.key
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-brand-100 text-brand-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner label="Loading booking requests..." />
      ) : filteredBookings.length > 0 ? (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-all"
            >
              {/* Card header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      #{booking.id.substring(0, 8)}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-brand-700 font-medium bg-brand-50 px-2 py-0.5 rounded">
                      {booking.resource?.category || 'Equipment'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-navy-950 mt-1">
                    <Link
                      to={`/resources/${booking.resource_id}`}
                      className="hover:text-brand-600 transition-colors"
                    >
                      {booking.resource?.title || 'Resource'}
                    </Link>
                  </h3>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              {/* Details grid */}
              <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>
                    <strong>Schedule:</strong> {formatDate(booking.start_time)} → {formatDate(booking.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>
                    <strong>Requester:</strong>{' '}
                    {booking.requester?.full_name || booking.requester_id.substring(0, 8)}
                  </span>
                </div>
                {booking.requester?.organization && (
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span>{booking.requester.organization.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Submitted {formatDate(booking.created_at)}</span>
                </div>
              </div>

              {/* Purpose */}
              <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed mb-4">
                <strong className="text-slate-700">Purpose:</strong> {booking.purpose}
              </p>

              {/* Eligibility info */}
              {booking.resource?.eligibility_requirements && (
                <div className="mb-4">
                  <EligibilityPanel requirements={booking.resource.eligibility_requirements} />
                </div>
              )}

              {/* Rejection reason display */}
              {booking.status === 'rejected' && booking.rejection_reason && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2.5 mb-4">
                  <strong>Decline reason:</strong> {booking.rejection_reason}
                </div>
              )}

              {/* Incident report button */}
              {(booking.status === 'checked_in' || booking.status === 'approved' || booking.status === 'overdue') && (
                <div className="flex items-center justify-between gap-2 text-xs bg-amber-50/50 border border-amber-200/60 rounded-lg p-2.5 mb-4">
                  <span className="text-amber-800">Observed equipment malfunction, damage, or protocol breach?</span>
                  <button
                    onClick={() => setIncidentBooking(booking)}
                    className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                  >
                    File Incident
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <Link
                  to={`/resources/${booking.resource_id}`}
                  className="text-xs font-medium text-slate-600 hover:text-navy-900 inline-flex items-center gap-1"
                >
                  Resource Details
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Pending actions: approve / reject */}
                  {booking.status === 'pending' && (
                    <>
                      {rejectingId === booking.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for declining..."
                            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-400 w-48"
                          />
                          <button
                            onClick={() => handleReject(booking.id)}
                            disabled={processingId === booking.id}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Decline
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectionReason('') }}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(booking.id)}
                            disabled={processingId === booking.id}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {processingId === booking.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => setRejectingId(booking.id)}
                            disabled={processingId === booking.id}
                            className="px-3 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Decline
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No bookings in this view"
          description="There are no booking requests matching this filter."
          actionLabel="View All"
          onAction={() => setFilterTab('all')}
        />
      )}
      {/* Incident Report Modal */}
      {incidentBooking && (
        <IncidentReportModal
          isOpen={!!incidentBooking}
          bookingId={incidentBooking.id}
          resourceTitle={incidentBooking.resource?.title}
          onSubmitted={() => loadBookings()}
          onClose={() => setIncidentBooking(null)}
        />
      )}
    </div>
  )
}
