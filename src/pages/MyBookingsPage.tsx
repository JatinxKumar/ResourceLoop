import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, QrCode, Plus, Filter, Search } from 'lucide-react'
import { DEMO_BOOKINGS, UIBooking } from '@/utils/ui-fixtures'
import { BookingCard } from '@/components/bookings/BookingCard'
import { QrCheckinModal } from '@/components/resources/QrCheckinModal'
import { EmptyState } from '@/components/common/EmptyState'

export const MyBookingsPage: React.FC = () => {
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'pending' | 'returned'>('all')
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<UIBooking | null>(null)
  const [bookingsList, setBookingsList] = useState<UIBooking[]>(DEMO_BOOKINGS)

  const filteredBookings = bookingsList.filter((b) => {
    if (filterTab === 'active') return b.status === 'approved' || b.status === 'in-use'
    if (filterTab === 'pending') return b.status === 'pending'
    if (filterTab === 'returned') return b.status === 'returned'
    return true
  })

  const handleCancelBooking = (bookingId: string) => {
    setBookingsList(bookingsList.filter(b => b.id !== bookingId))
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">My Equipment Reservations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track approvals, launch custody QR tokens, and review historical usage receipts.
          </p>
        </div>
        <Link
          to="/resources"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Reservation</span>
        </Link>
      </div>

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
          Active & In-Use
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

      {/* Bookings List */}
      {filteredBookings.length > 0 ? (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onViewPass={(b) => setSelectedBookingForPass(b)}
              onCancel={handleCancelBooking}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No reservations found in this view"
          description="You do not have any bookings matching this status filter. Browse the campus catalog to reserve equipment."
          actionLabel="Browse Catalog"
          onAction={() => setFilterTab('all')}
        />
      )}

      {/* QR Custody Modal */}
      {selectedBookingForPass && (
        <QrCheckinModal
          isOpen={!!selectedBookingForPass}
          onClose={() => setSelectedBookingForPass(null)}
          resourceTitle={selectedBookingForPass.resourceTitle}
          bookingCode={selectedBookingForPass.checkInCode}
          tokenData={selectedBookingForPass.qrData}
          startDate={selectedBookingForPass.startDate}
          endDate={selectedBookingForPass.endDate}
        />
      )}
    </div>
  )
}
