import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, ShieldCheck, Key, AlertCircle, Copy, Check } from 'lucide-react'

interface QrCheckinModalProps {
  isOpen: boolean
  onClose: () => void
  resourceTitle: string
  bookingCode: string
  tokenData: string
  startDate: string
  endDate: string
}

export const QrCheckinModal: React.FC<QrCheckinModalProps> = ({
  isOpen,
  onClose,
  resourceTitle,
  bookingCode,
  tokenData,
  startDate,
  endDate
}) => {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <p className="text-xs text-slate-500">Present to lab custodian at handover</p>
          </div>
        </div>

        {/* Resource info card */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-5">
          <div className="text-xs font-semibold text-slate-700 truncate">{resourceTitle}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Period: {startDate} → {endDate}</span>
            <span className="font-mono text-navy-800 font-bold">{bookingCode}</span>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200/80 rounded-xl mb-4">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
            <QRCodeSVG
              value={tokenData || bookingCode}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-navy-900 bg-white px-3 py-1 rounded border border-slate-200">
              {bookingCode}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-500 hover:text-navy-900 hover:bg-white transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Safety Note */}
        <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
          <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
          <p>
            Scanning confirms equipment condition inspection and signs the digital custody transfer in the audit log.
          </p>
        </div>

        {/* Close Button */}
        <div className="mt-5">
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
