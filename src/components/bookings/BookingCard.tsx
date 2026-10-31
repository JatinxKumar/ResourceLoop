import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, QrCode, ShieldAlert, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { UIBooking } from '@/utils/ui-fixtures'
import { StatusBadge } from '@/components/common/StatusBadge'

interface BookingCardProps {
  booking: UIBooking
  onViewPass?: (booking: UIBooking) => void
  onCancel?: (id: string) => void
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onViewPass,
  onCancel
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-500">{booking.checkInCode}</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-brand-700 font-medium bg-brand-50 px-2 py-0.5 rounded">
              {booking.resourceCategory}
            </span>
          </div>
          <h3 className="text-base font-bold text-navy-950 mt-1">
            <Link to={`/resources/${booking.resourceId}`} className="hover:text-brand-600 transition-colors">
              {booking.resourceTitle}
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
            <strong>Reservation:</strong> {booking.startDate} → {booking.endDate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {booking.supervisorApproval ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Supervisor Pre-Approval Granted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
              <Clock className="w-4 h-4 text-amber-500" />
              Department Approval Pending
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
          to={`/resources/${booking.resourceId}`}
          className="text-xs font-medium text-slate-600 hover:text-navy-900 inline-flex items-center gap-1"
        >
          <span>Resource Specs</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center gap-2">
          {onViewPass && (
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
