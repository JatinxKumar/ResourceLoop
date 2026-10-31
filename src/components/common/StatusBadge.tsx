import React from 'react'

export type BadgeVariant = 
  | 'available' 
  | 'reserved' 
  | 'in-use' 
  | 'maintenance' 
  | 'approved' 
  | 'pending' 
  | 'returned' 
  | 'overdue' 
  | 'rejected'

interface StatusBadgeProps {
  status: BadgeVariant | string
  className?: string
  showDot?: boolean
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  available: {
    label: 'Available Now',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200'
  },
  'in-use': {
    label: 'In Use',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    border: 'border-sky-200'
  },
  reserved: {
    label: 'Reserved',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    border: 'border-amber-200'
  },
  maintenance: {
    label: 'Maintenance',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    border: 'border-rose-200'
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200'
  },
  pending: {
    label: 'Pending Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-200'
  },
  returned: {
    label: 'Returned & Verified',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    border: 'border-slate-200'
  },
  overdue: {
    label: 'Overdue Alert',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    border: 'border-red-200'
  },
  rejected: {
    label: 'Declined',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-400',
    border: 'border-rose-200'
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  className = '', 
  showDot = true 
}) => {
  const normalizedKey = status.toLowerCase()
  const config = statusConfig[normalizedKey] || {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    border: 'border-slate-200'
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      )}
      <span>{config.label}</span>
    </span>
  )
}
