import React from 'react'
import { X, AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import type { IncidentType, CreateIncidentDTO } from '@/types/domain'

const INCIDENT_TYPES: { value: IncidentType; label: string; description: string }[] = [
  { value: 'damage', label: 'Damage', description: 'Physical damage to equipment or facility' },
  { value: 'loss', label: 'Loss', description: 'Missing equipment or components' },
  { value: 'late_return', label: 'Late Return', description: 'Equipment not returned on schedule' },
  { value: 'misuse', label: 'Misuse', description: 'Equipment used outside approved protocols' },
  { value: 'safety_hazard', label: 'Safety Hazard', description: 'Potential safety risk identified' },
  { value: 'other', label: 'Other', description: 'Other type of incident' },
]

interface IncidentReportModalProps {
  isOpen: boolean
  bookingId: string
  resourceTitle?: string
  onSubmit?: (dto: CreateIncidentDTO) => Promise<void>
  onClose: () => void
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  bookingId,
  resourceTitle,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-950">Incident Reporting</h3>
              {resourceTitle && (
                <p className="text-xs text-slate-500 mt-0.5">{resourceTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unavailable Notice */}
        <div className="p-5 space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">Backend Incident Operation Pending</p>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  Per the institutional API contract, incident submissions must be processed via an approved backend RPC to enforce authorization rules and immutable audit trails. Direct database writes have been intentionally disabled.
                </p>
                <p className="mt-2 text-[11px] text-amber-700 font-mono bg-amber-100/60 p-2 rounded">
                  Reference: Booking #{bookingId.substring(0, 8)} • Awaiting RPC release
                </p>
              </div>
            </div>
          </div>

          {/* Form preview (disabled) */}
          <div className="opacity-60 pointer-events-none space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Incident Category Preview
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INCIDENT_TYPES.slice(0, 4).map((opt) => (
                  <div
                    key={opt.value}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs"
                  >
                    <span className="font-semibold block">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 block">{opt.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              For urgent matters, contact institution safety directly.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                disabled
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-400 rounded-lg cursor-not-allowed opacity-75"
              >
                Filing Unavailable
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
