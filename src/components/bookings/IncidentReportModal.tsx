import React, { useState } from 'react'
import { X, AlertTriangle, AlertCircle } from 'lucide-react'
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
  onSubmit: (dto: CreateIncidentDTO) => Promise<void>
  onClose: () => void
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  bookingId,
  resourceTitle,
  onSubmit,
  onClose,
}) => {
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!incidentType) {
      setError('Select an incident type.')
      return
    }
    if (description.trim().length < 20) {
      setError('Description must be at least 20 characters.')
      return
    }

    const dto: CreateIncidentDTO = {
      booking_id: bookingId,
      incident_type: incidentType,
      description: description.trim(),
    }

    setSubmitting(true)
    try {
      await onSubmit(dto)
      // Reset and close on success
      setIncidentType('')
      setDescription('')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to file incident report.'
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
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Incident type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Incident Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {INCIDENT_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIncidentType(opt.value)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    incidentType === opt.value
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-semibold">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5 leading-tight">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="incident-desc">
              Description
            </label>
            <textarea
              id="incident-desc"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="Describe what happened, when it was noticed, and any relevant details..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 text-navy-900 disabled:bg-slate-100"
            />
            <p className="text-[10px] text-slate-400 mt-1">Minimum 20 characters required.</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !incidentType || description.trim().length < 20}
              className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{submitting ? 'Filing...' : 'File Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
