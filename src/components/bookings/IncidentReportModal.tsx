import React, { useState } from 'react'
import { X, AlertTriangle, ShieldAlert, Send, CheckCircle2 } from 'lucide-react'
import type { IncidentType, CreateIncidentDTO } from '@/types/domain'
import { reportIncident } from '@/services/incidents'

const INCIDENT_TYPES: { value: IncidentType; label: string; description: string }[] = [
  { value: 'damage', label: 'Damage', description: 'Physical damage to equipment or facility' },
  { value: 'loss', label: 'Loss', description: 'Missing equipment, peripherals or components' },
  { value: 'late_return', label: 'Late Return', description: 'Equipment not returned on schedule' },
  { value: 'misuse', label: 'Misuse', description: 'Equipment operated outside certified protocols' },
  { value: 'safety_hazard', label: 'Safety Hazard', description: 'Potential safety risk identified' },
  { value: 'other', label: 'Other', description: 'Other operational issue' },
]

interface IncidentReportModalProps {
  isOpen: boolean
  bookingId?: string
  resourceTitle?: string
  onSubmitted?: () => void
  onClose: () => void
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  bookingId,
  resourceTitle,
  onSubmitted,
  onClose,
}) => {
  const [incidentType, setIncidentType] = useState<IncidentType>('damage')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || description.trim().length < 10) {
      setError('Please provide a detailed description (at least 10 characters).')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await reportIncident({
        booking_id: bookingId,
        incident_type: incidentType,
        description: description.trim(),
      })
      setSuccess(true)
      setTimeout(() => {
        if (onSubmitted) onSubmitted()
        onClose()
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit incident report.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

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
              <h3 className="text-base font-bold text-navy-950">File Incident Report</h3>
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

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="text-sm font-bold text-navy-950">Incident Filed Successfully</h4>
            <p className="text-xs text-slate-500">
              The report has been registered for custodian and administrative review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Incident Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INCIDENT_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIncidentType(opt.value)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      incidentType === opt.value
                        ? 'border-brand-500 bg-brand-50/50 text-navy-950 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className="block font-medium">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 block">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Factual Incident Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the damage, missing components, observed malfunctions, or deviation from laboratory safety protocol..."
                rows={4}
                required
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {bookingId && (
              <p className="text-[11px] font-mono text-slate-400">
                Linked Reservation: #{bookingId.substring(0, 8)}
              </p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Submitted directly to campus governance registry.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
