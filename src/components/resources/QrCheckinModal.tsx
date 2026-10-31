import React, { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, ShieldCheck, Key, AlertCircle, Copy, Check, RefreshCw, Clock, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { generateBookingPass, type PassTokenType } from '@/hooks/useBookings'
import type { Booking } from '@/types/domain'

interface QrCheckinModalProps {
  isOpen: boolean
  onClose: () => void
  booking: Booking | null
  resourceTitle?: string
  startDate?: string
  endDate?: string
}

export const QrCheckinModal: React.FC<QrCheckinModalProps> = ({
  isOpen,
  onClose,
  booking,
  resourceTitle,
  startDate,
  endDate
}) => {
  const initialTokenType: PassTokenType =
    booking?.status === 'checked_in' ? 'check_out' : 'check_in'

  const [tokenType, setTokenType] = useState<PassTokenType>(initialTokenType)
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const title = booking?.resource?.title || resourceTitle || 'Institutional Resource'
  const displayStart = booking
    ? new Date(booking.start_time).toLocaleDateString()
    : startDate || ''
  const displayEnd = booking
    ? new Date(booking.end_time).toLocaleDateString()
    : endDate || ''

  // Sync default token type when booking changes
  useEffect(() => {
    if (booking) {
      setTokenType(booking.status === 'checked_in' ? 'check_out' : 'check_in')
    }
  }, [booking])

  const fetchPass = useCallback(async (typeToFetch: PassTokenType) => {
    if (!booking) return
    setLoading(true)
    setError(null)
    try {
      const result = await generateBookingPass(booking.id, typeToFetch)
      setToken(result.token)
      setExpiresAt(result.expires_at || null)
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Failed to generate booking pass.'
      if (
        msg.includes('42883') ||
        msg.includes('does not exist') ||
        msg.includes('generate_booking_pass')
      ) {
        msg =
          'Database Migration 004 is required for single-use QR passes: public.generate_booking_pass RPC is not deployed in Supabase.'
      }
      setError(msg)
      setToken(null)
    } finally {
      setLoading(false)
    }
  }, [booking])

  useEffect(() => {
    if (isOpen && booking) {
      fetchPass(tokenType)
    } else {
      setToken(null)
      setError(null)
      setExpiresAt(null)
      setCopied(false)
    }
  }, [isOpen, booking, tokenType, fetchPass])

  if (!isOpen || !booking) return null

  const handleCopy = () => {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTokenTypeChange = (newType: PassTokenType) => {
    if (newType !== tokenType) {
      setTokenType(newType)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-navy-950">Custody Verification Pass</h3>
            <p className="text-xs text-slate-500">Present to equipment custodian at handover</p>
          </div>
        </div>

        {/* Pass Type Selector (Check-In vs Return) */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleTokenTypeChange('check_in')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
              tokenType === 'check_in'
                ? 'bg-white text-navy-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-brand-600" />
            <span>Check-In Pass</span>
          </button>
          <button
            type="button"
            onClick={() => handleTokenTypeChange('check_out')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors ${
              tokenType === 'check_out'
                ? 'bg-white text-navy-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5 text-brand-600" />
            <span>Return Pass</span>
          </button>
        </div>

        {/* Resource info card */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-4">
          <div className="text-xs font-semibold text-slate-700 truncate">{title}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between items-center">
            <span>Period: {displayStart} → {displayEnd}</span>
            <span className="font-mono text-navy-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
              RL-{booking.id.substring(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Pass Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200/80 rounded-xl mb-4">
            <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-700">
              Generating {tokenType === 'check_in' ? 'Check-In' : 'Return'} Pass...
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Calling backend RPC `generate_booking_pass`
            </p>
          </div>
        )}

        {/* Pass Error State */}
        {error && !loading && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Pass Generation Failed</p>
                <p className="mt-1 text-rose-700">{error}</p>
                <p className="mt-2 text-[11px] text-rose-600">
                  Passes require an authorized backend token. Untrusted local tokens are prohibited.
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchPass(tokenType)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Generation</span>
            </button>
          </div>
        )}

        {/* QR Code Container (Only when token is received) */}
        {token && !loading && !error && (
          <>
            <div className="flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-200/80 rounded-xl mb-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                <QRCodeSVG
                  value={token}
                  size={175}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 max-w-full">
                <span className="font-mono text-xs font-bold text-navy-900 bg-white px-3 py-1 rounded border border-slate-200 truncate max-w-[240px]">
                  {token}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md text-slate-500 hover:text-navy-900 hover:bg-white transition-colors border border-transparent hover:border-slate-200"
                  title="Copy token string for manual verification"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Opaque single-use token signed by backend verification service
              </p>
            </div>

            {expiresAt && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-1.5 px-3 mb-3">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Expires: {new Date(expiresAt).toLocaleTimeString()}</span>
              </div>
            )}
          </>
        )}

        {/* Safety Note */}
        <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
          <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
          <p>
            The custodian will scan this code to complete equipment condition verification and sign the custody transfer.
          </p>
        </div>

        {/* Close Button */}
        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
