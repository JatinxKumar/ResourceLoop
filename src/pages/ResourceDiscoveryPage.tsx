import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Building, Layers, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { useResourceDiscovery, getOrganizations } from '@/hooks/useResources'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { ResourceType, ResourceStatus, Organization } from '@/types/domain'

export const ResourceDiscoveryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<ResourceType | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<ResourceStatus | 'all'>('all')
  const [selectedOrg, setSelectedOrg] = useState<string>('all')
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const { resources, loading, error, setFilters, refetch } = useResourceDiscovery({
    query: initialSearch || undefined,
    category: undefined,
    resource_type: undefined,
    status: undefined,
    organization_id: undefined
  })

  // Load organizations for filter dropdown using backend service
  useEffect(() => {
    getOrganizations().then(setOrganizations).catch(() => setOrganizations([]))
  }, [])

  // Sync state changes with the hook filters
  const applyFilters = (
    term: string,
    cat: string,
    type: ResourceType | 'all',
    stat: ResourceStatus | 'all',
    org: string
  ) => {
    setFilters({
      query: term.trim() || undefined,
      category: cat !== 'all' ? cat : undefined,
      resource_type: type !== 'all' ? type : undefined,
      status: stat !== 'all' ? stat : undefined,
      organization_id: org !== 'all' ? org : undefined
    })

    if (term.trim()) {
      setSearchParams({ search: term.trim() })
    } else {
      setSearchParams({})
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    applyFilters(val, selectedCategory, selectedType, selectedStatus, selectedOrg)
  }

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    applyFilters(searchTerm, cat, selectedType, selectedStatus, selectedOrg)
  }

  const handleTypeChange = (type: ResourceType | 'all') => {
    setSelectedType(type)
    applyFilters(searchTerm, selectedCategory, type, selectedStatus, selectedOrg)
  }

  const handleStatusChange = (stat: ResourceStatus | 'all') => {
    setSelectedStatus(stat)
    applyFilters(searchTerm, selectedCategory, selectedType, stat, selectedOrg)
  }

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org)
    applyFilters(searchTerm, selectedCategory, selectedType, selectedStatus, org)
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedType('all')
    setSelectedStatus('all')
    setSelectedOrg('all')
    setSearchParams({})
    setFilters({})
  }

  const categories = [
    'all',
    'Microscopy & Imaging',
    'Nanotechnology',
    'Computing & AI',
    'Spectroscopy',
    'Advanced Prototyping',
    'Research Space'
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Institutional Catalog Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and reserve verified equipment and dedicated research spaces across participating institutions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{resources.length} Verified Database Assets</span>
          </div>
        </div>
      </div>

      {/* Database Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Catalog Service Error</span>
            <p className="text-[11px] text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main search field */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by equipment title, specs, or location..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-navy-900"
            />
          </div>

          {/* Organization filter */}
          <div className="md:col-span-3 relative">
            <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedOrg}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white text-navy-900"
            >
              <option value="all">All Institutions</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter (Equipment / Space) */}
          <div className="md:col-span-2">
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value as ResourceType | 'all')}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white text-navy-900"
            >
              <option value="all">All Types</option>
              <option value="equipment">Equipment Only</option>
              <option value="space">Spaces Only</option>
            </select>
          </div>

          {/* Availability Status filter */}
          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value as ResourceStatus | 'all')}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white text-navy-900"
            >
              <option value="all">All Operational Statuses</option>
              <option value="available">Available for Booking</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Category:</span>
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize ${
                selectedCategory === cat
                  ? 'bg-navy-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid or Empty/Loading State */}
      {loading ? (
        <LoadingSpinner label="Querying Supabase resource catalogue via service layer..." />
      ) : resources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((res) => (
            <ResourceCard key={res.id} resource={res} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No resources match your filter criteria"
          description="Try broadening your search term or selecting another institution or category to discover equipment."
          actionLabel="Reset All Filters"
          onAction={handleResetFilters}
        />
      )}
    </div>
  )
}
