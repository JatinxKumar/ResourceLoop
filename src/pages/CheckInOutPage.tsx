import React, { useState, useEffect, useRef, useCallback } from 'react'
import { QrCode, ShieldCheck, AlertCircle, ArrowRight, ClipboardCheck, Camera, XCircle, RefreshCw } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '@/contexts/AuthContext'
import { verifyCheckIn, verifyCheckOut } from '@/hooks/useBookings'
import type { ConditionStatus } from '@/types/domain'

type CheckInStep = 'scan' | 'condition-report' | 'processing' | 'confirmed' | 'error'
type CheckInMode = 'checkin' | 'checkout'

const CONDITION_OPTIONS: { value: ConditionStatus; label: string }[] = [
  { value: 'excellent', label: 'Excellent — no visible wear' },
  { value: 'good', label: 'Good — minor cosmetic wear' },
  { value: 'fair', label: 'Fair — functional but shows wear' },
  { value: 'damaged', label: 'Damaged — physical defect present' },
  { value: 'faulty', label: 'Faulty — operational issue detected' },
]

/**
 * CheckInOutPage handles the physical custody workflow:
 * 1. Authorized owner/custodian navigates here.
 * 2. Scans the seeker's opaque QR custody token (camera or manual fallback).
 * 3. Fills the condition report (atomic with check-in/out RPC).
 * 4. Calls verify_check_in or verify_check_out with the token and condition data.
 *
 * QR tokens are opaque backend-generated strings. This page never constructs
 * tokens from booking IDs or resource IDs.
 */
export const CheckInOutPage: React.FC = () => {
  const { profile } = useAuth()
  const [step, setStep] = useState<CheckInStep>('scan')
  const [mode, setMode] = useState<CheckInMode>('checkin')
  const [scannedToken, setScannedToken] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'expired' | 'replay' | 'unauthorized' | 'invalid' | 'general'>('general')
  const [resultBookingId, setResultBookingId] = useState<string | null>(null)

  // Condition report state (atomic with check-in/out)
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus | ''>('')
  const [conditionNotes, setConditionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null)

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  const stopCamera = useCallback(async () => {
    if (scannerInstanceRef.current) {
      try {
        if (scannerInstanceRef.current.isScanning) {
          await scannerInstanceRef.current.stop()
        }
        scannerInstanceRef.current.clear()
      } catch (err) {
        console.warn('Error stopping scanner:', err)
      } finally {
        scannerInstanceRef.current = null
      }
    }
    setCameraActive(false)
  }, [])

  // Cleanup camera on unmount or mode switch
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const handleTokenScanned = useCallback(async (token: string) => {
    await stopCamera()
    setScannedToken(token)
    setManualToken(token)
    setStep('condition-report')
  }, [stopCamera])

  const startCamera = async () => {
    setCameraError(null)
    setCameraActive(true)

    // Wait for the DOM element to mount
    setTimeout(async () => {
      try {
        const container = document.getElementById('qr-scanner-region')
        if (!container) {
          throw new Error('Scanner container element not found.')
        }

        const scanner = new Html5Qrcode('qr-scanner-region')
        scannerInstanceRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (decodedText) {
              handleTokenScanned(decodedText.trim())
            }
          },
          () => {
            // Frame parse error - ignore standard noise frames
          }
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to initialize camera scanner.'
        setCameraError(msg)
        setCameraActive(false)
        if (scannerInstanceRef.current) {
          try {
            scannerInstanceRef.current.clear()
          } catch {
            // ignore cleanup error
          }
          scannerInstanceRef.current = null
        }
      }
    }, 100)
  }

  const handleManualSubmit = () => {
    setError(null)
    const token = manualToken.trim()
    if (!token) {
      setError('Enter a custody token or scan a QR code.')
      return
    }
    if (token.length < 8) {
      setError('Token appears too short. Verify the full token from the seeker\'s custody pass.')
      return
    }
    setScannedToken(token)
    setStep('condition-report')
  }

  const handleVerify = async () => {
    if (!conditionStatus) {
      setError('Select an equipment condition before proceeding.')
      return
    }

    setSubmitting(true)
    setError(null)
    setStep('processing')

    try {
      const rpc = mode === 'checkin' ? verifyCheckIn : verifyCheckOut
      const result = await rpc(
        scannedToken,
        conditionStatus || undefined,
        conditionNotes.trim() || undefined
      )
      setResultBookingId(result.id)
      setStep('confirmed')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.'

      // Classify error for specific contract states: expired, replay, unauthorized, invalid
      let displayError = msg
      let kind: 'expired' | 'replay' | 'unauthorized' | 'invalid' | 'general' = 'general'

      if (msg.includes('expired') || msg.includes('Expired')) {
        kind = 'expired'
        displayError = 'This custody pass token has expired. Ask the seeker to generate a fresh pass from their My Reservations page.'
      } else if (msg.includes('already') || msg.includes('replay') || msg.includes('used')) {
        kind = 'replay'
        displayError = 'This pass token has already been used. Each custody verification pass is strictly single-use to prevent replay.'
      } else if (msg.includes('unauthorized') || msg.includes('Unauthorized') || msg.includes('permission') || msg.includes('forbidden')) {
        kind = 'unauthorized'
        displayError = 'You are not authorized to verify this booking. Only the resource owner or designated lab custodian may scan passes.'
      } else if (msg.includes('not found') || msg.includes('invalid') || msg.includes('Invalid')) {
        kind = 'invalid'
        displayError = 'Invalid or unrecognized pass token. Ensure the complete token was scanned or entered.'
      }

      setErrorKind(kind)
      setError(displayError)
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  const resetFlow = () => {
    setStep('scan')
    setScannedToken('')
    setManualToken('')
    setConditionStatus('')
    setConditionNotes('')
    setError(null)
    setErrorKind('general')
    setResultBookingId(null)
    stopCamera()
  }

  // Seeker view: they don't scan, they display their pass
  if (!isOwnerOrAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
          <QrCode className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
            Custody Verification
          </h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-card">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">
            As a seeker, present your Custody Pass QR code to the resource custodian.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Go to My Reservations and tap "Custody Pass" on an approved booking to view your pass.
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
            Verify seeker QR tokens, inspect equipment condition, and confirm custody transfer.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => { resetFlow(); setMode('checkin') }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'checkin'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Check-In
          </button>
          <button
            onClick={() => { resetFlow(); setMode('checkout') }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'checkout'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Check-Out (Return)
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && step !== 'error' && (
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
            Ask the seeker to display their Custody Pass QR code, then scan it with your camera or enter the token manually.
          </p>

          {/* Camera scanner */}
          <div className="mb-5">
            {!cameraActive ? (
              <div className="flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8">
                {cameraError ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-xs text-amber-700 text-center mb-3 max-w-sm">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="px-3.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-colors"
                    >
                      Retry Camera
                    </button>
                  </>
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-slate-300 mb-3" />
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Open Camera Scanner
                    </button>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Requires camera permission. Point at the seeker's QR code.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="relative bg-black rounded-xl overflow-hidden max-w-md mx-auto border border-slate-200">
                <div id="qr-scanner-region" className="w-full min-h-[280px]" />
                <div className="absolute top-2 right-2 z-20">
                  <button
                    onClick={stopCamera}
                    className="p-1.5 rounded-lg bg-white/90 text-slate-600 hover:text-rose-600 border border-slate-200 shadow-sm transition-colors"
                    title="Stop camera"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manual entry */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Manual Token Fallback:</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="sr-only" htmlFor="custody-token">
                  Custody Token
                </label>
                <input
                  id="custody-token"
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
                  placeholder="Paste or type opaque custody token..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 font-mono"
                />
              </div>
              <button
                onClick={handleManualSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>Verify Token</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              If camera scanning is unavailable, enter the token string directly from the seeker's pass.
            </p>
          </div>
        </div>
      )}

      {/* Step: Condition Report (atomic with check-in/out) */}
      {step === 'condition-report' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-navy-950">
              {mode === 'checkin' ? 'Pre-Use Equipment Inspection' : 'Post-Return Equipment Inspection'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Complete the condition assessment. This is recorded atomically with the custody transfer.
          </p>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono truncate">
            Token: {scannedToken}
          </div>

          {/* Condition status selector */}
          <fieldset className="mb-4">
            <legend className="block text-xs font-semibold text-slate-700 mb-2">
              Equipment Condition
            </legend>
            <div className="space-y-1.5">
              {CONDITION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    conditionStatus === opt.value
                      ? 'border-brand-300 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="conditionStatus"
                    value={opt.value}
                    checked={conditionStatus === opt.value}
                    onChange={() => setConditionStatus(opt.value)}
                    className="accent-brand-600"
                  />
                  <span className="text-xs font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="condition-notes">
              Inspection Notes (optional)
            </label>
            <textarea
              id="condition-notes"
              rows={3}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="Record any physical or functional observations..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={resetFlow}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              disabled={!conditionStatus || submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? 'Verifying...'
                  : mode === 'checkin'
                  ? 'Confirm Check-In'
                  : 'Confirm Return'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-700">
            {mode === 'checkin' ? 'Verifying check-in token...' : 'Verifying return token...'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Calling backend verification RPC and committing atomic condition assessment.
          </p>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              errorKind === 'expired'
                ? 'bg-amber-50 border border-amber-200'
                : errorKind === 'unauthorized'
                ? 'bg-purple-50 border border-purple-200'
                : 'bg-rose-50 border border-rose-200'
            }`}>
              <XCircle className={`w-5 h-5 ${
                errorKind === 'expired'
                  ? 'text-amber-600'
                  : errorKind === 'unauthorized'
                  ? 'text-purple-600'
                  : 'text-rose-600'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-navy-950">
                  {errorKind === 'expired' && 'Pass Token Expired'}
                  {errorKind === 'replay' && 'Single-Use Replay Detected'}
                  {errorKind === 'unauthorized' && 'Authorization Denied'}
                  {errorKind === 'invalid' && 'Invalid Pass Token'}
                  {errorKind === 'general' && 'Verification Failed'}
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                  errorKind === 'expired'
                    ? 'bg-amber-100 text-amber-800'
                    : errorKind === 'unauthorized'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {errorKind}
                </span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={resetFlow}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Start Over</span>
            </button>
            <button
              onClick={() => { setError(null); setStep('scan') }}
              className="px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
            >
              Try Different Pass Token
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirmed */}
      {step === 'confirmed' && (
        <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-navy-950 mb-1">
            {mode === 'checkin' ? 'Check-In Confirmed' : 'Return Confirmed'}
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            Custody transfer and condition assessment have been signed and recorded in PostgreSQL.
          </p>
          {resultBookingId && (
            <p className="text-[10px] font-mono text-slate-400 mb-5">
              Booking ID: {resultBookingId}
            </p>
          )}
          <button
            onClick={resetFlow}
            className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
          >
            Process Another Verification
          </button>
        </div>
      )}
    </div>
  )
}
