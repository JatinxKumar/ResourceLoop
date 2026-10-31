import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, User, Star, ArrowRight, ShieldCheck } from 'lucide-react'
import { UIResource } from '@/utils/ui-fixtures'
import { StatusBadge } from '@/components/common/StatusBadge'

interface ResourceCardProps {
  resource: UIResource
  onQuickBook?: (resource: UIResource) => void
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onQuickBook }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-card hover:shadow-card-hover transition-all flex flex-col group">
      {/* Media & Badges */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={resource.imageUrl}
          alt={resource.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white/90 backdrop-blur-md text-navy-900 shadow-sm">
            {resource.category}
          </span>
          <StatusBadge status={resource.status} />
        </div>

        {/* Bottom image overlay metadata */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-white">
          <span className="font-mono text-[11px] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded">
            {resource.code}
          </span>
          <span className="inline-flex items-center gap-1 font-medium bg-black/40 backdrop-blur-md px-2 py-0.5 rounded">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            {resource.rating.toFixed(1)} ({resource.reviewsCount})
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="font-bold text-navy-950 text-base line-clamp-1 group-hover:text-brand-600 transition-colors">
            <Link to={`/resources/${resource.id}`}>{resource.title}</Link>
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {resource.description}
          </p>
        </div>

        {/* Meta details */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{resource.location}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">Custodian: {resource.custodian}</span>
          </div>
          {resource.depositRequired && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
              <span>Campus Escrow Required (${resource.depositAmount})</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <Link
            to={`/resources/${resource.id}`}
            className="text-xs font-semibold text-slate-600 hover:text-navy-950 flex items-center gap-1 transition-colors"
          >
            <span>Specifications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {resource.status === 'available' ? (
            <button
              onClick={() => onQuickBook ? onQuickBook(resource) : null}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            >
              Request Access
            </button>
          ) : (
            <Link
              to={`/resources/${resource.id}`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              View Schedule
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
