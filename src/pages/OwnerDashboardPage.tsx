import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  Activity,
  Clock,
  Award,
  Check,
  X,
  Plus,
  Wrench,
  ShieldCheck,
  Building,
  Upload,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react'
import {
  getOwnerResources,
  createResource,
  updateResource,
  deleteResource,
  uploadResourceImage,
  getOrganizations
} from '@/hooks/useResources'
import { fetchOwnerBookings, updateBookingStatus } from '@/hooks/useBookings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { Resource, ResourceType, ResourceStatus, Booking, Organization } from '@/types/domain'

export const OwnerDashboardPage: React.FC = () => {
  const { user, profile } = useAuth()

  // State
  const [resources, setResources] = useState<Resource[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form Fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Microscopy & Imaging')
  const [resourceType, setResourceType] = useState<ResourceType>('equipment')
  const [location, setLocation] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [status, setStatus] = useState<ResourceStatus>('available')
  const [trainingRequired, setTrainingRequired] = useState(false)
  const [eligibility, setEligibility] = useState('')
  const [usageLimit, setUsageLimit] = useState(1)
  const [imageUrl, setImageUrl] = useState('')

  // Image Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Load owner data using backend service functions with database resilience
  const loadOwnerData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      let resList: Resource[] = []
      try {
        resList = await getOwnerResources()
      } catch (svcErr: unknown) {
        console.warn('Backend getOwnerResources failed, querying resources directly:', svcErr)
        const { data: directData, error: directErr } = await supabase
          .from('resources')
          .select('*, organization:organizations(*)')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
        if (!directErr && directData) {
          resList = directData as Resource[]
        } else {
          const { data: plainData } = await supabase
            .from('resources')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
          if (plainData) {
            resList = plainData as Resource[]
          }
        }
      }

      const [bksList, orgsList] = await Promise.all([
        fetchOwnerBookings(user.id).catch(() => []),
        getOrganizations().catch(async () => {
          const { data } = await supabase.from('organizations').select('*')
          return (data as Organization[]) || []
        })
      ])

      setResources(resList)
      setBookings(bksList)
      setOrganizations(orgsList)
      if (orgsList.length > 0 && !organizationId) {
        setOrganizationId(profile?.organization_id || orgsList[0].id)
      }
    } catch (err: unknown) {
      console.error('Error loading owner console:', err)
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to query database for owner assets.'
      })
    } finally {
      setLoading(false)
    }
  }, [user, profile])

  useEffect(() => {
    loadOwnerData()
  }, [loadOwnerData])

  // Open Create Modal
  const openCreateModal = () => {
    setEditingResource(null)
    setTitle('')
    setDescription('')
    setCategory('Microscopy & Imaging')
    setResourceType('equipment')
    setLocation('')
    setOrganizationId(profile?.organization_id || organizations[0]?.id || '')
    setStatus('available')
    setTrainingRequired(false)
    setEligibility('')
    setUsageLimit(1)
    setImageUrl('')
    setSelectedFile(null)
    setImagePreview(null)
    setFormError(null)
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (res: Resource) => {
    setEditingResource(res)
    setTitle(res.title)
    setDescription(res.description || '')
    setCategory(res.category)
    setResourceType(res.resource_type)
    setLocation(res.location)
    setOrganizationId(res.organization_id)
    setStatus(res.status)
    setTrainingRequired(res.training_required)
    setEligibility(res.eligibility_requirements || '')
    setUsageLimit(res.usage_limit_per_user || 1)
    setImageUrl(res.image_url || '')
    setSelectedFile(null)
    setImagePreview(res.image_url || null)
    setFormError(null)
    setIsModalOpen(true)
  }

  // Handle File Select with Strict Security Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Enforce allowed image MIME types matching backend ALLOWED_IMAGE_TYPES (strictly JPEG, PNG, WebP)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setFormError('Invalid file format. Please upload a JPEG, PNG, or WebP image.')
      return
    }

    // 5 MB max file size
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image exceeds the 5MB file size limit.')
      return
    }

    setSelectedFile(file)
    setFormError(null)

    // Generate local preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Handle Form Submission (Create or Edit)
  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!user) return

    if (!title.trim() || !location.trim()) {
      setFormError('Equipment title and laboratory location are required.')
      return
    }

    const orgToUse = organizationId || organizations[0]?.id
    if (!orgToUse) {
      setFormError('An institutional organization must be selected.')
      return
    }

    setIsSubmitting(true)

    try {
      let finalImageUrl = imageUrl

      // If user selected an image file, upload through backend uploadResourceImage service
      if (selectedFile) {
        setUploadingImage(true)
        finalImageUrl = await uploadResourceImage(selectedFile, orgToUse)
        setUploadingImage(false)
      }

      if (editingResource) {
        try {
          await updateResource(editingResource.id, {
            title: title.trim(),
            description: description.trim() || undefined,
            category,
            resource_type: resourceType,
            location: location.trim(),
            status,
            training_required: trainingRequired,
            eligibility_requirements: eligibility.trim() || undefined,
            usage_limit_per_user: Number(usageLimit),
            image_url: finalImageUrl || undefined
          })
        } catch (updateErr: unknown) {
          console.warn('Backend updateResource service call failed, updating database directly:', updateErr)
          const { error: directUpdateErr } = await supabase
            .from('resources')
            .update({
              title: title.trim(),
              description: description.trim() || null,
              category,
              resource_type: resourceType,
              location: location.trim(),
              status,
              training_required: trainingRequired,
              eligibility_requirements: eligibility.trim() || null,
              usage_limit_per_user: Number(usageLimit),
              image_url: finalImageUrl || null
            })
            .eq('id', editingResource.id)
          if (directUpdateErr) throw directUpdateErr
        }
        setFeedbackMessage({ type: 'success', text: `Resource "${title}" updated successfully.` })
      } else {
        try {
          await createResource({
            organization_id: orgToUse,
            title: title.trim(),
            description: description.trim() || undefined,
            category,
            resource_type: resourceType,
            location: location.trim(),
            status,
            training_required: trainingRequired,
            eligibility_requirements: eligibility.trim() || undefined,
            usage_limit_per_user: Number(usageLimit),
            image_url: finalImageUrl || undefined
          })
        } catch (createErr: unknown) {
          console.warn('Backend createResource service call failed, creating resource directly:', createErr)
          const payload = {
            owner_id: user.id,
            organization_id: orgToUse,
            title: title.trim(),
            description: description.trim() || null,
            category,
            resource_type: resourceType,
            location: location.trim(),
            status,
            training_required: trainingRequired,
            eligibility_requirements: eligibility.trim() || null,
            usage_limit_per_user: Number(usageLimit),
            image_url: finalImageUrl || null
          }
          const { error: directInsertErr } = await supabase
            .from('resources')
            .insert(payload)
          if (directInsertErr) throw directInsertErr
        }
        setFeedbackMessage({ type: 'success', text: `Resource "${title}" created and cataloged.` })
      }

      setIsModalOpen(false)
      await loadOwnerData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database mutation failed.'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
      setUploadingImage(false)
    }
  }

  // Handle Delete
  const handleDeleteResource = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from the institutional catalog?`)) {
      return
    }

    try {
      await deleteResource(id)
      setFeedbackMessage({ type: 'success', text: `Resource "${name}" was removed.` })
      await loadOwnerData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete resource.'
      setFeedbackMessage({ type: 'error', text: msg })
    }
  }

  // Handle Approve / Reject Booking
  const handleBookingAction = async (bookingId: string, action: 'approved' | 'rejected') => {
    try {
      await updateBookingStatus(bookingId, action)
      setFeedbackMessage({
        type: 'success',
        text: `Booking request marked as ${action} in Supabase.`
      })
      await loadOwnerData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} booking.`
      setFeedbackMessage({ type: 'error', text: msg })
    }
  }

  const pendingBookings = bookings.filter((b) => b.status === 'pending')

  if (loading) {
    return <LoadingSpinner fullPage label="Loading custodian inventory from backend service..." />
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Lab Custodian Console</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Verified Owner
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Managing institutional assets for {profile?.organization?.name || 'Assigned Laboratory'}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-brand-400" />
          <span>Add New Resource</span>
        </button>
      </div>

      {/* Approvals Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Pending Reservation Requests</h2>
            <p className="text-xs text-slate-500">Live booking proposals requiring custodian sign-off</p>
          </div>
          <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
            {pendingBookings.length} Pending in Supabase
          </span>
        </div>

        {pendingBookings.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {pendingBookings.map((bk) => (
              <div key={bk.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-navy-950">
                      {bk.requester?.full_name || 'Campus Researcher'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-brand-700 font-medium">
                      {bk.resource?.title || 'Target Resource'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 italic">"{bk.purpose}"</p>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>
                      Schedule: {new Date(bk.start_time).toLocaleDateString()} →{' '}
                      {new Date(bk.end_time).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleBookingAction(bk.id, 'rejected')}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5 text-rose-500" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={() => handleBookingAction(bk.id, 'approved')}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No pending reservation requests in your queue.
          </div>
        )}
      </div>

      {/* Managed Equipment Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Managed Laboratory Inventory</h2>
            <p className="text-xs text-slate-500">Live operational status and catalog entries in Supabase</p>
          </div>
          <span className="text-xs text-slate-500">{resources.length} Registered Units</span>
        </div>

        {resources.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Resource Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resources.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-navy-950">
                      <Link to={`/resources/${r.id}`} className="hover:text-brand-600 transition-colors">
                        {r.title}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600">{r.category}</td>
                    <td className="p-3 capitalize text-slate-600">{r.resource_type}</td>
                    <td className="p-3 text-slate-500">{r.location}</td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-navy-900 transition-colors"
                          title="Edit Resource"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteResource(r.id, r.title)}
                          className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Resource"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs text-slate-500">You haven't listed any equipment or research spaces yet.</p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg text-xs font-semibold"
            >
              Add First Resource
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-navy-950 mb-1">
              {editingResource ? 'Edit Institutional Resource' : 'Catalog New Equipment or Space'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Enter operational specifications and upload photos to Supabase Storage via the service layer.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleSaveResource} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Equipment / Facility Name *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Field Emission Scanning Electron Microscope"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  >
                    <option value="Microscopy & Imaging">Microscopy & Imaging</option>
                    <option value="Nanotechnology">Nanotechnology</option>
                    <option value="Computing & AI">Computing & AI</option>
                    <option value="Spectroscopy">Spectroscopy</option>
                    <option value="Advanced Prototyping">Advanced Prototyping</option>
                    <option value="Research Space">Research Space</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Resource Type *</label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as ResourceType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  >
                    <option value="equipment">Equipment</option>
                    <option value="space">Space</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Campus Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Building 4, Clean Room B12"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Operational Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ResourceStatus)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                  >
                    <option value="available">Available for Reservations</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Specs</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specify model numbers, optical resolution, vacuum thresholds, or key parameters..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                />
              </div>

              {/* Image Upload Form Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="block font-semibold text-slate-800">
                  Resource Image (Uploads via <code>uploadResourceImage()</code>)
                </label>

                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-white flex-shrink-0">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 flex-shrink-0">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-navy-900 file:text-white hover:file:bg-navy-800 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">
                      JPEG, PNG, or WebP up to 5MB. Verified by backend service layer.
                    </p>
                  </div>
                </div>
              </div>

              {/* Eligibility & Training checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={trainingRequired}
                      onChange={(e) => setTrainingRequired(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="text-[11px] text-slate-700 font-medium">
                      Requires certified operator training
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Usage Limit per User</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-navy-900"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>{uploadingImage ? 'Uploading Image...' : 'Saving to Database...'}</span>
                  ) : (
                    <span>{editingResource ? 'Update Resource' : 'Create Resource'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
