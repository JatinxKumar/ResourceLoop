import React, { useState, useEffect } from 'react'
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
  Building,
  FileText,
  AlertCircle,
  Tag
} from 'lucide-react'
import { getResourceById } from '@/hooks/useResources'
import { requestBooking } from '@/hooks/useBookings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import type { Resource } from '@/types/domain'

const DEFAULT_RESOURCE_IMAGE = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80'

export const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Booking Form State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [supervisorConfirmed, setSupervisorConfirmed] = useState(true)
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Load resource details from Supabase with fallback
  useEffect(() => {
    if (!id) return

    setLoading(true)
    setFetchError(null)

    getResourceById(id)
      .then((data) => {
        setResource(data)
      })
      .catch(async (err: unknown) => {
        console.warn('Backend getResourceById failed, querying database directly:', err)
        try {
          const { data, error } = await supabase
            .from('resources')
            .select('*, organization:organizations(*)')
            .eq('id', id)
            .maybeSingle()
          if (!error && data) {
            setResource(data as Resource)
            return
          }
          // If join query hit 42P17, fallback to plain resource row
          const { data: plainData, error: plainError } = await supabase
            .from('resources')
            .select('*')
            .eq('id', id)
            .maybeSingle()
          if (plainError) throw plainError
          setResource(plainData as Resource)
        } catch (fallbackErr: unknown) {
          const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to load resource.'
          setFetchError(msg)
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <LoadingSpinner fullPage label="Retrieving equipment specifications from Supabase..." />
  }

  if (fetchError || !resource) {
    return (
      <div className="py-12">
        <EmptyState
          title="Equipment Not Found"
          description={fetchError || 'The requested institutional resource ID could not be located in the database.'}
          actionLabel="Back to Catalog"
          onAction={() => navigate('/resources')}
        />
      </div>
    )
  }

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBookingError(null)

    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: { pathname: `/resources/${resource.id}` } } })
      return
    }

    if (!startDate || !endDate) {
      setBookingError('Please specify valid start and end reservation timestamps.')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end <= start) {
      setBookingError('Reservation end time must be after start time.')
      return
    }

    if (!purpose.trim()) {
      setBookingError('Please describe the research purpose and project identifier.')
      return
    }

    setSubmittingBooking(true)

    try {
      await requestBooking({
        resource_id: resource.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        purpose: purpose.trim()
      })
      setBookingSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reservation request.'
      setBookingError(msg)
    } finally {
      setSubmittingBooking(false)
    }
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
        <span className="text-slate-400 capitalize">{resource.category}</span>
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
                src={resource.image_url || DEFAULT_RESOURCE_IMAGE}
                alt={resource.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_RESOURCE_IMAGE
                }}
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 rounded-md bg-white/95 backdrop-blur-md text-xs font-bold text-navy-900 shadow-sm flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span>{resource.category}</span>
                </span>
                <StatusBadge status={resource.status} />
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              <div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-1">
                  <span className="font-semibold capitalize text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                    {resource.resource_type}
                  </span>
                  <span>•</span>
                  <span>{resource.organization?.name || 'Institutional Network'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
                  {resource.title}
                </h1>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                {resource.description || 'No detailed description provided by the facility custodian.'}
              </p>

              {/* Custody location and metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>{resource.location}</span>
                </div>
                {resource.owner?.full_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    <span>Custodian: {resource.owner.full_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>Org: {resource.organization?.name || 'Verified Lab'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational & Eligibility Specifications */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Operational & Eligibility Specifications</span>
            </h2>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Resource Classification</span>
                <span className="col-span-2 text-navy-950 font-medium capitalize">{resource.resource_type}</span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Operator Training Required</span>
                <span className="col-span-2 text-navy-950 font-medium">
                  {resource.training_required ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      Yes — Certified Operator Level required
                    </span>
                  ) : (
                    'Standard Laboratory Induction'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Eligibility Conditions</span>
                <span className="col-span-2 text-navy-950 font-medium">
                  {resource.eligibility_requirements || 'Open to all verified institutional researchers with faculty approval.'}
                </span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Simultaneous Booking Limit</span>
                <span className="col-span-2 text-navy-950 font-medium">
                  {resource.usage_limit_per_user} concurrent active session(s) per user
                </span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-white">
                <span className="font-semibold text-slate-600">Standard Access Schedule</span>
                <span className="col-span-2 text-navy-950 font-medium">
                  {resource.availability_info?.days?.join(', ') || 'Monday - Friday'} ({resource.availability_info?.hours || '09:00 - 18:00'})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reservation Booking Box */}
        <div id="book" className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card sticky top-20">
            <h3 className="text-base font-bold text-navy-950 mb-1">
              Request Instrument Access
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Submit a formal reservation request. It will be recorded in the Supabase ledger and routed to the custodian.
            </p>

            {bookingSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-3 animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950">Reservation Submitted</h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Your reservation request has been created in Supabase with status <strong>pending</strong>.
                </p>
                <div className="pt-2">
                  <Link
                    to="/bookings"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
                  >
                    <span>View in My Bookings</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {bookingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p>{bookingError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={submittingBooking || resource.status !== 'available'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={submittingBooking || resource.status !== 'available'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Research Purpose & Grant ID
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Describe the research experimental protocol or thesis objective..."
                    disabled={submittingBooking || resource.status !== 'available'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={supervisorConfirmed}
                      onChange={(e) => setSupervisorConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="text-[11px] text-slate-600 leading-snug">
                      I confirm compliance with prerequisite lab training and equipment safety rules.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingBooking || resource.status !== 'available'}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
                    resource.status !== 'available'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-brand-600 hover:bg-brand-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-500'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    {submittingBooking
                      ? 'Recording in Supabase...'
                      : resource.status !== 'available'
                      ? `Unavailable (${resource.status})`
                      : 'Submit Reservation Request'}
                  </span>
                </button>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Governed by PostgreSQL Row Level Security & Audit Log.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
