import React, { useState } from 'react'
import { ClipboardCheck, Camera, AlertCircle } from 'lucide-react'
import type {
  ConditionReportType,
  ConditionStatus,
  CreateConditionReportDTO,
} from '@/types/domain'

const CONDITION_OPTIONS: { value: ConditionStatus; label: string }[] = [
  { value: 'excellent', label: 'Excellent — no visible wear' },
  { value: 'good', label: 'Good — minor cosmetic wear' },
  { value: 'fair', label: 'Fair — functional but shows wear' },
  { value: 'damaged', label: 'Damaged — physical defect present' },
  { value: 'faulty', label: 'Faulty — operational issue detected' },
]

interface ConditionReportFormProps {
  bookingId: string
  reportType: ConditionReportType
  /** Called with validated DTO — parent wires to backend RPC */
  onSubmit: (dto: CreateConditionReportDTO) => Promise<void>
  onCancel?: () => void
}

export const ConditionReportForm: React.FC<ConditionReportFormProps> = ({
  bookingId,
  reportType,
  onSubmit,
  onCancel,
}) => {
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = reportType === 'before' ? 'Pre-Use Inspection' : 'Post-Return Inspection'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!conditionStatus) {
      setError('Select a condition status before submitting.')
      return
    }

    const dto: CreateConditionReportDTO = {
      booking_id: bookingId,
      report_type: reportType,
      condition_status: conditionStatus,
      notes: notes.trim() || undefined,
    }

    setSubmitting(true)
    try {
      await onSubmit(dto)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit condition report.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-navy-950">{title}</h3>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Condition status selector */}
      <fieldset>
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
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="condition-notes">
          Notes (optional)
        </label>
        <textarea
          id="condition-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={submitting}
          placeholder="Describe any observations about the equipment condition..."
          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
        />
      </div>

      {/* Image placeholder — backend token integration pending */}
      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3">
        <Camera className="w-4 h-4" />
        <span>Photo upload will be available after backend storage integration.</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !conditionStatus}
          className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
        </button>
      </div>
    </form>
  )
}
