import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Coins,
  ArrowRight,
  Search,
  Sparkles,
  Clock,
  Layers
} from 'lucide-react'
import { fetchUserBookings } from '@/hooks/useBookings'
import { getAvailableResources } from '@/hooks/useResources'
import { useAuth } from '@/contexts/AuthContext'
import { StatCard } from '@/components/dashboard/StatCard'
import { BookingCard } from '@/components/bookings/BookingCard'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { QrCheckinModal } from '@/components/resources/QrCheckinModal'
import { OrganizationRequestModal } from '@/components/organizations/OrganizationRequestModal'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { Booking, Resource } from '@/types/domain'

export const SeekerDashboardPage: React.FC = () => {
  const { user, profile, role } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [recommendations, setRecommendations] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<Booking | null>(null)
  const [showMembershipModal, setShowMembershipModal] = useState(false)

  useEffect(() => {
    if (!user) return

    setLoading(true)
    Promise.all([
      fetchUserBookings(user.id).catch(() => []),
      getAvailableResources().catch(() => [])
    ])
      .then(([bks, resList]) => {
        setBookings(bks)
        setRecommendations(resList.slice(0, 2))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user])

  const activeReservations = bookings.filter((b) => b.status === 'approved' || b.status === 'checked_in')
  const pendingReservations = bookings.filter((b) => b.status === 'pending')
  const completedReturns = bookings.filter((b) => b.status === 'returned')

  if (loading) {
    return <LoadingSpinner fullPage label="Loading your personalized dashboard from Supabase..." />
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Welcome back, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
              {role} Account
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {profile?.organization?.name
              ? <>{profile.organization.name} &bull; Database Synchronized</>
              : <>
                <button
                  onClick={() => setShowMembershipModal(true)}
                  className="text-amber-600 hover:text-amber-700 font-semibold underline"
                >
                  No organization — request membership
                </button>
              </>
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/resources"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search Equipment</span>
          </Link>
          <Link
            to="/bookings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>My Bookings ({bookings.length})</span>
          </Link>
        </div>
      </div>

      {/* Live Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Reservations"
          value={activeReservations.length}
          change={activeReservations.length > 0 ? 'In-Use / Ready' : 'None scheduled'}
          changeType="positive"
          icon={Calendar}
        />
        <StatCard
          label="Pending Approvals"
          value={pendingReservations.length}
          change={pendingReservations.length > 0 ? 'Awaiting Custodian' : 'Queue Clear'}
          changeType="neutral"
          icon={Clock}
        />
        <StatCard
          label="Verified Returns"
          value={completedReturns.length}
          change="Inspection passed"
          changeType="positive"
          icon={CheckCircle2}
        />
        <StatCard
          label="Total Requests"
          value={bookings.length}
          change="All time"
          changeType="neutral"
          icon={Layers}
        />
      </div>

      {/* Main Content: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Active Reservations */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Active Reservations & Check-outs</h2>
              <p className="text-xs text-slate-500">Live reservations retrieved from Supabase</p>
            </div>
            <Link
              to="/bookings"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <span>All Requests ({bookings.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeReservations.length > 0 ? (
            <div className="space-y-4">
              {activeReservations.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onViewPass={(b) => setSelectedBookingForPass(b)}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center space-y-3">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">You have no active or checked-in reservations right now.</p>
              <Link
                to="/resources"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-navy-900 text-white rounded-lg text-xs font-semibold"
              >
                <span>Browse Resource Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Catalog Recommendations */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <span>Available Institutional Apparatus</span>
                </h3>
                <p className="text-xs text-slate-500">Ready for instant campus reservation in the database</p>
              </div>
              <Link to="/resources" className="text-xs font-medium text-slate-500 hover:text-navy-900">
                View all →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recommendations.map((res) => (
                <ResourceCard key={res.id} resource={res} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Custody Pass & Safety Protocols */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-navy-950 rounded-2xl p-5 text-white border border-navy-900 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                Custody Protocol
              </span>
              <ShieldCheck className="w-5 h-5 text-brand-400" />
            </div>
            <h4 className="text-base font-bold">Physical Handoff Verification</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              When arriving at the laboratory, present your verified custody QR pass to the custodian to record condition inspection before check-in.
            </p>
            {activeReservations.length > 0 ? (
              <button
                onClick={() => setSelectedBookingForPass(activeReservations[0])}
                className="w-full py-2.5 px-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Open Active Custody Pass
              </button>
            ) : (
              <Link
                to="/resources"
                className="block text-center py-2.5 px-3 bg-navy-900 hover:bg-navy-800 border border-navy-800 text-slate-200 rounded-lg text-xs font-bold transition-colors"
              >
                Reserve Equipment
              </Link>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-navy-950">Institutional Governance</h4>
            <div className="space-y-2 text-slate-600">
              <p>• All equipment loans are logged in PostgreSQL audit trails.</p>
              <p>• Departmental cross-liability agreements are active.</p>
              <p>• Ensure inspection condition reports are completed upon return.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Custody Modal */}
      {selectedBookingForPass && (
        <QrCheckinModal
          isOpen={!!selectedBookingForPass}
          onClose={() => setSelectedBookingForPass(null)}
          booking={selectedBookingForPass}
        />
      )}

      {showMembershipModal && (
        <OrganizationRequestModal onClose={() => setShowMembershipModal(false)} />
      )}
    </div>
  )
}
