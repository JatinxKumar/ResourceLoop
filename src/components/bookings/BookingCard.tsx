import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, QrCode, CheckCircle, Clock, ExternalLink, XCircle } from 'lucide-react'
import type { Booking } from '@/types/domain'
import { StatusBadge } from '@/components/common/StatusBadge'

interface BookingCardProps {
  booking: Booking
  onViewPass?: (booking: Booking) => void
  onCancel?: (id: string) => void
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onViewPass,
  onCancel
}) => {
  const resourceTitle = booking.resource?.title || 'Institutional Resource'
  const resourceCategory = booking.resource?.category || 'Equipment'
  const formattedStart = new Date(booking.start_time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const formattedEnd = new Date(booking.end_time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const isApproved = booking.status === 'approved' || booking.status === 'checked_in'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-500">
              ID: {booking.id.substring(0, 8)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-brand-700 font-medium bg-brand-50 px-2 py-0.5 rounded">
              {resourceCategory}
            </span>
          </div>
          <h3 className="text-base font-bold text-navy-950 mt-1">
            <Link to={`/resources/${booking.resource_id}`} className="hover:text-brand-600 transition-colors">
              {resourceTitle}
            </Link>
          </h3>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <StatusBadge status={booking.status} />
        </div>
      </div>

      {/* Booking Details */}
      <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>
            <strong>Schedule:</strong> {formattedStart} → {formattedEnd}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {booking.status === 'approved' || booking.status === 'checked_in' ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Custodian Authorization Granted
            </span>
          ) : booking.status === 'rejected' ? (
            <span className="inline-flex items-center gap-1.5 text-rose-700 font-medium">
              <XCircle className="w-4 h-4 text-rose-600" />
              Request Declined {booking.rejection_reason ? `(${booking.rejection_reason})` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Custodian Authorization
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed mb-4">
        <strong className="text-slate-700">Research Purpose:</strong> {booking.purpose}
      </p>

      {/* Footer Actions */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
        <Link
          to={`/resources/${booking.resource_id}`}
          className="text-xs font-medium text-slate-600 hover:text-navy-900 inline-flex items-center gap-1"
        >
          <span>Resource Specifications</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center gap-2">
          {isApproved && onViewPass && (
            <button
              onClick={() => onViewPass(booking)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-brand-400" />
              <span>Custody Pass</span>
            </button>
          )}

          {booking.status === 'pending' && onCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel Request
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
