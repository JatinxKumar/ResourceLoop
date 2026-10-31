import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  label?: string
  fullPage?: boolean
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading institutional resources...',
  fullPage = false,
  className = ''
}) => {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 p-8 ${className}`}>
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-brand-600 animate-spin" />
        <Loader2 className="w-5 h-5 text-brand-600 absolute inset-0 m-auto animate-pulse" />
      </div>
      {label && <p className="text-xs font-medium text-slate-500 tracking-wide">{label}</p>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center w-full">
        {content}
      </div>
    )
  }

  return content
}

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle animate-pulse space-y-4">
      <div className="h-44 bg-slate-100 rounded-lg w-full" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="pt-2 flex justify-between items-center border-t border-slate-100">
        <div className="h-3 bg-slate-100 rounded w-1/4" />
        <div className="h-8 bg-slate-200 rounded-lg w-24" />
      </div>
    </div>
  )
}
