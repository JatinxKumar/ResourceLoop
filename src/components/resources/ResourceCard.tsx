import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, User, ArrowRight, ShieldCheck, Building, Tag } from 'lucide-react'
import type { Resource } from '@/types/domain'
import { StatusBadge } from '@/components/common/StatusBadge'

interface ResourceCardProps {
  resource: Resource
  onQuickBook?: (resource: Resource) => void
}

const DEFAULT_RESOURCE_IMAGE = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onQuickBook }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-card hover:shadow-card-hover transition-all flex flex-col group">
      {/* Media & Badges */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={resource.image_url || DEFAULT_RESOURCE_IMAGE}
          alt={resource.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            // Fallback if image URL fails to load
            const target = e.currentTarget
            target.src = DEFAULT_RESOURCE_IMAGE
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white/90 backdrop-blur-md text-navy-900 shadow-sm flex items-center gap-1">
            <Tag className="w-3 h-3 text-slate-500" />
            <span>{resource.category}</span>
          </span>
          <StatusBadge status={resource.status} />
        </div>

        {/* Bottom image overlay metadata */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-white">
          <span className="capitalize text-[11px] bg-black/50 backdrop-blur-md px-2 py-0.5 rounded font-medium">
            {resource.resource_type}
          </span>
          {resource.organization?.name && (
            <span className="truncate max-w-[180px] text-[11px] bg-black/50 backdrop-blur-md px-2 py-0.5 rounded">
              {resource.organization.name}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="font-bold text-navy-950 text-base line-clamp-1 group-hover:text-brand-600 transition-colors">
            <Link to={`/resources/${resource.id}`}>{resource.title}</Link>
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {resource.description || 'No description provided by custodian.'}
          </p>
        </div>

        {/* Meta details */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{resource.location}</span>
          </div>
          {resource.owner?.full_name && (
            <div className="flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">Custodian: {resource.owner.full_name}</span>
            </div>
          )}
          {resource.training_required && (
            <div className="flex items-center gap-1.5 text-amber-700">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>Prerequisite Operator Certification Required</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <Link
            to={`/resources/${resource.id}`}
            className="text-xs font-semibold text-slate-600 hover:text-navy-950 flex items-center gap-1 transition-colors"
          >
            <span>View Specifications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {resource.status === 'available' ? (
            <Link
              to={`/resources/${resource.id}#book`}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            >
              Request Access
            </Link>
          ) : (
            <Link
              to={`/resources/${resource.id}`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              Check Availability
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
