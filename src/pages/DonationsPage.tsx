import React, { useState, useEffect } from 'react'
import {
  Heart,
  Plus,
  RefreshCw,
  Search,
  Building,
  CheckCircle2,
  AlertCircle,
  Tag,
  Gift,
  ArrowRight,
  ShieldCheck,
  Send,
  X
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import type { Resource, ConditionStatus } from '@/types/domain'
import {
  listDonationListings,
  createDonationListing,
  requestDonation,
  acceptDonation,
  rejectDonation,
} from '@/services/donations'
import { getOrganizations } from '@/services/organizations'
import type { Organization } from '@/types/domain'

export const DonationsPage: React.FC = () => {
  const { user, profile, role } = useAuth()
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  const [donations, setDonations] = useState<Resource[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Create Donation Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Laboratory Surplus')
  const [location, setLocation] = useState('')
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>('good')
  const [estimatedValue, setEstimatedValue] = useState<number>(0)
  const [transferTerms, setTransferTerms] = useState('Permanent academic donation as-is')
  const [imageUrl, setImageUrl] = useState('')

  // Request Claim Modal state
  const [selectedDonation, setSelectedDonation] = useState<Resource | null>(null)
  const [claimPurpose, setClaimPurpose] = useState('')
  const [intendedUse, setIntendedUse] = useState('')
  const [claiming, setClaiming] = useState(false)

  const loadDonations = async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, orgs] = await Promise.all([
        listDonationListings({ search: search.trim() || undefined }),
        getOrganizations(),
      ])
      setDonations(list)
      setOrganizations(orgs)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load donations'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDonations()
  }, [])

  const handleCreateDonation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.organization_id) {
      setError('You must have an affiliated institution to list surplus donations.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await createDonationListing({
        organization_id: profile.organization_id,
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        location: location.trim(),
        condition_status: conditionStatus,
        estimated_value: estimatedValue,
        transfer_terms: transferTerms.trim(),
        image_url: imageUrl.trim() || undefined,
      })
      setSuccessMsg(`Surplus equipment "${title}" has been listed for institutional donation!`)
      setIsCreateOpen(false)
      setTitle('')
      setDescription('')
      setLocation('')
      setEstimatedValue(0)
      await loadDonations()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create donation listing'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClaimDonation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDonation) return

    setClaiming(true)
    setError(null)
    try {
      await requestDonation({
        resource_id: selectedDonation.id,
        purpose: claimPurpose.trim(),
        intended_use: intendedUse.trim() || undefined,
      })
      setSuccessMsg(`Donation claim submitted for "${selectedDonation.title}". The custodian will review your transfer request.`)
      setSelectedDonation(null)
      setClaimPurpose('')
      setIntendedUse('')
      await loadDonations()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit donation claim'
      setError(msg)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Institutional Donations & Surplus Exchange</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-50 text-brand-800 border border-brand-200 flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" />
              <span>Surplus Asset Network</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reallocate decommissioned equipment, surplus instrumentation, and grant-funded assets to high-impact research labs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadDonations}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh Listings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>List Surplus Donation</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p>{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p>{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadDonations()}
          placeholder="Search surplus donations by title, category, or lab location..."
          className="w-full text-xs bg-transparent focus:outline-none text-navy-900 placeholder:text-slate-400"
        />
        <button
          onClick={loadDonations}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
        >
          Search
        </button>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <LoadingSpinner label="Fetching available surplus donation listings from Supabase..." />
      ) : donations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {donations.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 bg-slate-100">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold text-navy-900 shadow-sm flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-500" />
                      <span>{item.category}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-sm">
                      Surplus Transfer
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.organization?.name || 'Partner University'}</span>
                  </div>

                  <h3 className="text-base font-bold text-navy-950 line-clamp-1">{item.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{item.description}</p>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div>
                      <span className="block font-semibold text-slate-700">Condition</span>
                      <span className="capitalize">{item.availability_info?.condition_status || 'Good'}</span>
                    </div>
                    <div>
                      <span className="block font-semibold text-slate-700">Estimated Value</span>
                      <span>${Number(item.availability_info?.estimated_value || 0).toLocaleString()} USD</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => setSelectedDonation(item)}
                  className="w-full py-2 px-3 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Request Surplus Transfer</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No surplus equipment currently listed"
          description="There are currently no surplus assets matching your search criteria. Check back soon or list surplus from your lab."
          actionLabel="Clear Search"
          onAction={() => { setSearch(''); loadDonations(); }}
        />
      )}

      {/* Modal: Create Donation Listing */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-brand-600" />
                <h3 className="text-base font-bold text-navy-950">List Surplus Equipment for Donation</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDonation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Equipment Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Decommissioned Gas Chromatograph MS"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Chromatography, Optics"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Condition</label>
                  <select
                    value={conditionStatus}
                    onChange={(e) => setConditionStatus(e.target.value as ConditionStatus)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="excellent">Excellent — Like new</option>
                    <option value="good">Good — Operational</option>
                    <option value="fair">Fair — Needs maintenance</option>
                    <option value="faulty">Faulty — For parts / repair</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Value ($ USD)</label>
                  <input
                    type="number"
                    min="0"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Science Quad B14"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description &amp; Specifications</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details regarding operating condition, accessories included, and maintenance history..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Terms</label>
                <input
                  type="text"
                  value={transferTerms}
                  onChange={(e) => setTransferTerms(e.target.value)}
                  placeholder="e.g. Recipient institution covers de-installation and transport"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {submitting ? 'Publishing...' : 'Publish Surplus Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Surplus Transfer */}
      {selectedDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy-950">Claim Surplus Asset</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedDonation.title}</p>
              </div>
              <button onClick={() => setSelectedDonation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleClaimDonation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Research Justification &amp; Purpose
                </label>
                <textarea
                  rows={3}
                  required
                  value={claimPurpose}
                  onChange={(e) => setClaimPurpose(e.target.value)}
                  placeholder="Explain how this equipment will support your department's research or educational initiatives..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intended Placement / Lab Facility
                </label>
                <input
                  type="text"
                  value={intendedUse}
                  onChange={(e) => setIntendedUse(e.target.value)}
                  placeholder="e.g. Advanced Photonics Center, Clean Room B10"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                By submitting, your institution commits to standard academic transfer terms and will coordinate physical pickup with the donating custodian.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDonation(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={claiming}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {claiming ? 'Submitting Claim...' : 'Confirm Transfer Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

