import React from 'react'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  description?: string
  icon: LucideIcon
  badge?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeType = 'positive',
  description,
  icon: Icon,
  badge
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
            {value}
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-navy-800">
          <Icon className="w-5 h-5 text-brand-600" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {change && (
          <div className="flex items-center gap-1.5 font-medium">
            {changeType === 'positive' && (
              <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                {change}
              </span>
            )}
            {changeType === 'negative' && (
              <span className="inline-flex items-center gap-0.5 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-semibold">
                <TrendingDown className="w-3.5 h-3.5" />
                {change}
              </span>
            )}
            {changeType === 'neutral' && (
              <span className="inline-flex items-center gap-0.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                <Minus className="w-3.5 h-3.5" />
                {change}
              </span>
            )}
          </div>
        )}
        {description && (
          <span className="text-slate-600 truncate max-w-[150px]">{description}</span>
        )}
        {badge && (
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}
