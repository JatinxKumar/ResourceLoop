import React, { useState } from 'react';
import { z } from 'zod';
import { Calendar, AlertCircle } from 'lucide-react';
import type { Resource, CreateBookingDTO } from '@/types/domain';

// Simplified Zod schema for the booking form (matches approved contract fields)
const bookingSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  purpose: z.string().min(10, { message: 'Purpose must be at least 10 characters' }),
  complianceConfirmed: z.literal(true),
});

type BookingFormProps = {
  resource: Resource;
  /** Called with a validated DTO when the user submits the form */
  onSubmit: (dto: CreateBookingDTO) => Promise<void>;
  /** Optional callback after successful submission */
  onSuccess?: () => void;
};

export const BookingForm: React.FC<BookingFormProps> = ({ resource, onSubmit, onSuccess }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [purpose, setPurpose] = useState('');
  const [compliance, setCompliance] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setGlobalError(null);

    const result = bookingSchema.safeParse({
      start_time: start,
      end_time: end,
      purpose,
      complianceConfirmed: compliance,
    });

    if (!result.success) {
      setErrors(result.error.issues.map((issue) => issue.message));
      return;
    }

    // Additional date validation
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || startDate <= new Date()) {
      setErrors(['Start time must be a future date']);
      return;
    }
    if (isNaN(endDate.getTime()) || endDate <= startDate) {
      setErrors(['End time must be after start time']);
      return;
    }

    const dto: CreateBookingDTO = {
      resource_id: resource.id,
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      purpose: purpose.trim(),
    };

    setSubmitting(true);
    try {
      await onSubmit(dto);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking request failed';
      setGlobalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {globalError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p>{globalError}</p>
        </div>
      )}
      {errors.length > 0 && (
        <ul className="list-disc list-inside text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="start">
          Start Date &amp; Time
        </label>
        <input
          id="start"
          type="datetime-local"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={submitting || resource.status !== 'available'}
          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="end">
          End Date &amp; Time
        </label>
        <input
          id="end"
          type="datetime-local"
          required
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={submitting || resource.status !== 'available'}
          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="purpose">
          Research Purpose
        </label>
        <textarea
          id="purpose"
          rows={3}
          required
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          disabled={submitting || resource.status !== 'available'}
          placeholder="Describe the research protocol..."
          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900 disabled:bg-slate-100"
        />
      </div>
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
        <label className="flex items-start gap-2 cursor-pointer select-none" htmlFor="compliance">
          <input
            id="compliance"
            type="checkbox"
            checked={compliance}
            onChange={(e) => setCompliance(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
          />
          <span className="text-[11px] text-slate-600 leading-snug">
            I confirm compliance with prerequisite lab training and equipment safety rules.
          </span>
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting || resource.status !== 'available'}
        className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
          resource.status !== 'available'
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-brand-600 hover:bg-brand-700 text-white focus:outline-none focus:ring-2 focus:ring-brand-500'
        }`}
      >
        <Calendar className="w-4 h-4" />
        <span>{submitting ? 'Submitting...' : 'Request Instrument Access'}</span>
      </button>
    </form>
  );
};
