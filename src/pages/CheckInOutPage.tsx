import React, { useState } from 'react'
import { QrCode, ShieldCheck, AlertCircle, ArrowRight, ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ConditionReportForm } from '@/components/bookings/ConditionReportForm'
import type { Booking, CreateConditionReportDTO } from '@/types/domain'

type CheckInStep = 'scan' | 'condition-report' | 'confirmed'

/**
 * CheckInOutPage handles the physical custody workflow:
 * 1. Seeker displays QR token (via MyBookingsPage custody pass).
 * 2. Authenticated owner/custodian navigates here to process handover.
 * 3. Custodian verifies QR, fills pre-use condition report, confirms check-in.
 * 4. On return: post-return condition report, then check-out confirmation.
 *
 * NOTE: QR scanning reads opaque backend-generated tokens.
 * The actual scan → verify → transition flow requires backend RPC integration.
 * This page is presentational scaffolding — onSubmit callbacks are not wired yet.
 */
export const CheckInOutPage: React.FC = () => {
  const { profile } = useAuth()
  const [step, setStep] = useState<CheckInStep>('scan')
  const [mode, setMode] = useState<'checkin' | 'checkout'>('checkin')
  const [scannedBooking, setScannedBooking] = useState<Booking | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  const handleTokenLookup = async () => {
    setError(null)
    if (!manualToken.trim()) {
      setError('Enter a custody token or scan a QR code.')
      return
    }
    // Backend RPC call will resolve the opaque token to a booking.
    // For now, surface the pending integration state.
    setError('Token verification requires backend RPC integration. This feature is in progress.')
  }

  const handleConditionSubmit = async (_dto: CreateConditionReportDTO) => {
    // Will be wired to backend RPC once API_CONTRACT.md is approved
    throw new Error('Condition report submission requires backend integration.')
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
          <QrCode className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
            Custody Verification
          </h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">
            As a seeker, present your Custody Pass QR code to the resource custodian.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Go to My Reservations and tap "Custody Pass" on an approved booking.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
            Custody Verification
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verify seeker QR tokens, inspect equipment, and confirm custody transfer.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => { setMode('checkin'); setStep('scan'); setScannedBooking(null) }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'checkin'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Check-In
          </button>
          <button
            onClick={() => { setMode('checkout'); setStep('scan'); setScannedBooking(null) }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'checkout'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Check-Out
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Step: Scan / Manual Token Entry */}
      {step === 'scan' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-brand-600" />
            <h2 className="text-sm font-semibold text-navy-950">
              {mode === 'checkin' ? 'Verify Seeker Check-In Token' : 'Verify Seeker Return Token'}
            </h2>
          </div>

          <p className="text-xs text-slate-500 mb-5">
            Ask the seeker to display their Custody Pass QR code, or manually enter the custody token below.
          </p>

          {/* Camera scanner placeholder */}
          <div className="flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 mb-5">
            <QrCode className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-xs text-slate-400 text-center">
              Camera QR scanning requires backend token verification integration.
            </p>
          </div>

          {/* Manual entry */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="custody-token">
                Manual Token Entry
              </label>
              <input
                id="custody-token"
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Enter custody token..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
              />
            </div>
            <button
              onClick={handleTokenLookup}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Verify</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Condition Report */}
      {step === 'condition-report' && scannedBooking && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <ConditionReportForm
            bookingId={scannedBooking.id}
            reportType={mode === 'checkin' ? 'before' : 'after'}
            onSubmit={handleConditionSubmit}
            onCancel={() => setStep('scan')}
          />
        </div>
      )}

      {/* Step: Confirmed */}
      {step === 'confirmed' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-navy-950 mb-1">
            {mode === 'checkin' ? 'Check-In Confirmed' : 'Return Confirmed'}
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Custody transfer has been recorded in the audit log.
          </p>
          <button
            onClick={() => { setStep('scan'); setScannedBooking(null); setManualToken('') }}
            className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
          >
            Process Another
          </button>
        </div>
      )}
    </div>
  )
}
