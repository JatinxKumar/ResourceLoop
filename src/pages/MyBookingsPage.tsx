import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { fetchUserBookings, cancelBooking } from '@/hooks/useBookings'
import { useAuth } from '@/contexts/AuthContext'
import { BookingCard } from '@/components/bookings/BookingCard'
import { QrCheckinModal } from '@/components/resources/QrCheckinModal'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import type { Booking } from '@/types/domain'

export const MyBookingsPage: React.FC = () => {
  const { user } = useAuth()
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'pending' | 'returned'>('all')
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<Booking | null>(null)
  const [bookingsList, setBookingsList] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBookings = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchUserBookings(user.id)
      setBookingsList(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query bookings.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const filteredBookings = bookingsList.filter((b) => {
    if (filterTab === 'active') return b.status === 'approved' || b.status === 'checked_in'
    if (filterTab === 'pending') return b.status === 'pending'
    if (filterTab === 'returned') return b.status === 'returned'
    return true
  })

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this pending reservation request?')) {
      return
    }

    try {
      await cancelBooking(bookingId)
      await loadBookings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel reservation.'
      setError(msg)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">My Equipment Reservations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track authorization status, launch custody verification QR tokens, and review session history in Supabase.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => loadBookings()}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh Bookings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/resources"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Reservation</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterTab === 'all'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Requests ({bookingsList.length})
        </button>
        <button
          onClick={() => setFilterTab('active')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterTab === 'active'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Approved & Active
        </button>
        <button
          onClick={() => setFilterTab('pending')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterTab === 'pending'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Pending Review
        </button>
        <button
          onClick={() => setFilterTab('returned')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterTab === 'returned'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Completed Archive
        </button>
      </div>

      {/* Bookings Content */}
      {loading ? (
        <LoadingSpinner label="Fetching your reservations from Supabase database..." />
      ) : filteredBookings.length > 0 ? (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onViewPass={(b) => setSelectedBookingForPass(b)}
              onCancel={handleCancel}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No reservations found in this view"
          description="You do not currently have any reservations matching this status filter."
          actionLabel="Browse Catalog"
          onAction={() => setFilterTab('all')}
        />
      )}

      {/* QR Custody Modal */}
      {selectedBookingForPass && (
        <QrCheckinModal
          isOpen={!!selectedBookingForPass}
          onClose={() => setSelectedBookingForPass(null)}
          booking={selectedBookingForPass}
        />
      )}
    </div>
  )
}
