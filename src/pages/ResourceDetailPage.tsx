import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  User,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Star,
  FileText
} from 'lucide-react'
import { DEMO_RESOURCES } from '@/utils/ui-fixtures'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'

export const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const resource = DEMO_RESOURCES.find((r) => r.id === id)

  const [startDate, setStartDate] = useState('2026-11-05')
  const [endDate, setEndDate] = useState('2026-11-07')
  const [purpose, setPurpose] = useState('')
  const [supervisorSigned, setSupervisorSigned] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  if (!resource) {
    return (
      <div className="py-12">
        <EmptyState
          title="Equipment Not Found"
          description="The requested institutional resource code does not exist in the active catalog."
          actionLabel="Back to Catalog"
          onAction={() => navigate('/resources')}
        />
      </div>
    )
  }

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="space-y-6">
      {/* Back button and breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/resources" className="inline-flex items-center gap-1 hover:text-navy-900 transition-colors font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Catalog</span>
        </Link>
        <span>/</span>
        <span className="text-slate-400">{resource.category}</span>
        <span>/</span>
        <span className="font-semibold text-navy-950 truncate max-w-xs">{resource.title}</span>
      </div>

      {/* Main 2-column detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Media & Specifications */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="relative h-72 sm:h-96 w-full bg-slate-100">
              <img
                src={resource.imageUrl}
                alt={resource.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 rounded-md bg-white/95 backdrop-blur-md text-xs font-bold text-navy-900 shadow-sm">
                  {resource.category}
                </span>
                <StatusBadge status={resource.status} />
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-1">
                  <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {resource.code}
                  </span>
                  <span>•</span>
                  <span>{resource.department}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
                  {resource.title}
                </h1>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                {resource.description}
              </p>

              {/* Custody location and ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>{resource.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>{resource.custodian}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                  <span>{resource.rating.toFixed(1)} Institutional Score ({resource.reviewsCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Specifications Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Technical & Operational Specifications</span>
            </h2>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {Object.entries(resource.specifications).map(([key, val]) => (
                <div key={key} className="grid grid-cols-3 p-3 bg-white hover:bg-slate-50 transition-colors">
                  <span className="font-semibold text-slate-600">{key}</span>
                  <span className="col-span-2 text-navy-950 font-medium">{val}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Maximum Reservation Duration</span>
                <span className="col-span-2 text-navy-950 font-medium">{resource.maxDurationDays} consecutive days</span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Institutional Escrow Policy</span>
                <span className="col-span-2 text-navy-950 font-medium">
                  {resource.depositRequired ? `$${resource.depositAmount} campus liability hold` : 'Standard department cross-guarantee'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reservation Booking Box */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card sticky top-20">
            <h3 className="text-base font-bold text-navy-950 mb-1">
              Request Instrument Access
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Submit reservation for automated supervisor routing and custodian authorization.
            </p>

            {submitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950">Access Request Queued</h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Your request has been routed to <strong>{resource.custodian}</strong>. You can view its progress on your bookings page.
                </p>
                <div className="pt-2">
                  <Link
                    to="/bookings"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
                  >
                    <span>Go to My Bookings</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBooking} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Research Purpose & Project ID
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Briefly describe the experiment or thesis study utilizing this apparatus..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={supervisorSigned}
                      onChange={(e) => setSupervisorSigned(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="text-[11px] text-slate-600 leading-snug">
                      I confirm I hold prerequisite training certifications and faculty sponsorship.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={resource.status === 'maintenance'}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
                    resource.status === 'maintenance'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-brand-600 hover:bg-brand-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-500'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    {resource.status === 'maintenance' ? 'Unavailable (Under Maintenance)' : 'Submit Access Request'}
                  </span>
                </button>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Campus QR Custody Protocol guarantees liability coverage.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
