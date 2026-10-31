import React, { useState, useMemo } from 'react'
import { Search, Filter, SlidersHorizontal, Sparkles, Building, Layers, CheckCircle2 } from 'lucide-react'
import { DEMO_RESOURCES, UIResource } from '@/utils/ui-fixtures'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { EmptyState } from '@/components/common/EmptyState'

export const ResourceDiscoveryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false)
  const [selectedDept, setSelectedDept] = useState<string>('All')

  const categories = ['All', 'Laboratory', 'Fabrication', 'Computing', 'Media & AV', 'Field Research']
  const departments = [
    'All',
    'Materials Science & NanoTech',
    'Mechanical Engineering Hub',
    'School of Computer Science & AI',
    'Film, Media & Communications',
    'Earth & Environmental Sciences',
    'Electrical & Computer Engineering'
  ]

  const filteredResources = useMemo(() => {
    return DEMO_RESOURCES.filter((res) => {
      const matchesSearch =
        res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.department.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategory = selectedCategory === 'All' || res.category === selectedCategory
      const matchesDept = selectedDept === 'All' || res.department === selectedDept
      const matchesAvailable = !onlyAvailable || res.status === 'available'

      return matchesSearch && matchesCategory && matchesDept && matchesAvailable
    })
  }, [searchTerm, selectedCategory, selectedDept, onlyAvailable])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Institutional Catalog Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and reserve certified equipment across 18 campus research laboratories.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Showing {filteredResources.length} of {DEMO_RESOURCES.length} verified assets</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main search field */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by equipment name, department, or asset code..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-navy-900"
            />
          </div>

          {/* Department Filter */}
          <div className="md:col-span-4 relative">
            <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white text-navy-900"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Departments' : d}
                </option>
              ))}
            </select>
          </div>

          {/* Only Available Toggle */}
          <div className="md:col-span-2 flex items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span>Available Now</span>
            </label>
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
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-navy-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredResources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((res) => (
            <ResourceCard key={res.id} resource={res} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No resources match your filter criteria"
          description="Try clearing your search query or switching category filters to view other institutional apparatus."
          actionLabel="Reset All Filters"
          onAction={() => {
            setSearchTerm('')
            setSelectedCategory('All')
            setSelectedDept('All')
            setOnlyAvailable(false)
          }}
        />
      )}
    </div>
  )
}
