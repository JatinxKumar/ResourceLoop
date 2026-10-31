import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Coins,
  ArrowRight,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Info
} from 'lucide-react'
import {
  DEMO_SEEKER_STATS,
  DEMO_BOOKINGS,
  DEMO_RESOURCES,
  DEMO_RECENT_ACTIVITIES,
  UIBooking
} from '@/utils/ui-fixtures'
import { StatCard } from '@/components/dashboard/StatCard'
import { BookingCard } from '@/components/bookings/BookingCard'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { QrCheckinModal } from '@/components/resources/QrCheckinModal'
import { useAuth } from '@/contexts/AuthContext'

export const SeekerDashboardPage: React.FC = () => {
  const { user } = useAuth()
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<UIBooking | null>(null)

  // Map icons dynamically
  const statIcons = [Calendar, CheckCircle2, ShieldCheck, Coins]

  const activeBookings = DEMO_BOOKINGS.filter(b => b.status === 'approved' || b.status === 'in-use')
  const availableRecommendations = DEMO_RESOURCES.filter(r => r.status === 'available').slice(0, 2)

  return (
    <div className="space-y-8">
      {/* Demo fixture disclaimer banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Visual Prototype Notice:</strong> Displaying frontend demo fixtures for UI layout validation. These metrics are simulated for hackathon presentation and do not alter production database state.
        </p>
      </div>

      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Welcome back, {user?.name.split(' ')[0]}
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Verified Seeker
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Department: {user?.department} • Institutional Trust Rating: {user?.trustScore}%
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
            <span>My Bookings</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEMO_SEEKER_STATS.map((stat, idx) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            changeType={stat.changeType}
            icon={statIcons[idx]}
          />
        ))}
      </div>

      {/* Main Content: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Active Reservations */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Active Reservations & Check-outs</h2>
              <p className="text-xs text-slate-500">Scheduled access windows requiring custody verification</p>
            </div>
            <Link
              to="/bookings"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <span>All Bookings ({DEMO_BOOKINGS.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {activeBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onViewPass={(b) => setSelectedBookingForPass(b)}
              />
            ))}
          </div>

          {/* Recommended Available Resources */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <span>Available in Your Research Domain</span>
                </h3>
                <p className="text-xs text-slate-500">Ready for instant campus reservation</p>
              </div>
              <Link to="/resources" className="text-xs font-medium text-slate-500 hover:text-navy-900">
                View catalog →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableRecommendations.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Custody Activity & Fast Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Custody Pass Card */}
          <div className="bg-navy-950 rounded-2xl p-5 text-white border border-navy-900 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                Instant Handoff
              </span>
              <QrCode className="w-5 h-5 text-brand-400" />
            </div>
            <h4 className="text-base font-bold">Pick Up or Return Apparatus</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Show your cryptographic QR token to the lab custodian to record physical condition and execute custody transfer.
            </p>
            <button
              onClick={() => setSelectedBookingForPass(activeBookings[0] || null)}
              className="w-full py-2.5 px-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Open Primary Pass</span>
            </button>
          </div>

          {/* Campus Audit Stream */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-navy-950">Campus Sharing Log</h4>
              <span className="text-[10px] text-slate-400">Real-time</span>
            </div>

            <div className="space-y-3.5">
              {DEMO_RECENT_ACTIVITIES.map((act) => (
                <div key={act.id} className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy-900">{act.user}</span>
                    <span className="text-[10px] text-slate-400">{act.time}</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    {act.action} <span className="text-navy-900 font-medium">{act.target}</span>
                  </p>
                  <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                    {act.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Custody Modal */}
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
