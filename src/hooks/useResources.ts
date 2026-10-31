import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  Resource,
  ResourceType,
  ResourceStatus,
  CreateResourceDTO,
  UpdateResourceDTO,
  Organization
} from '@/types/domain'

export interface ResourceFilters {
  search?: string
  category?: string
  resourceType?: ResourceType | 'all'
  status?: ResourceStatus | 'all'
  organizationId?: string
}

/**
 * Upload an image for a resource to the 'resource-images' Supabase Storage bucket.
 * Contract: uploadResourceImage(file, organizationId) -> Promise<string>
 */
export async function uploadResourceImage(file: File, organizationId: string): Promise<string> {
  if (!file) throw new Error('No file provided for upload.')

  // 1. File type validation
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file format. Please upload a JPEG, PNG, or WebP image.')
  }

  // 2. File size validation (5MB max)
  const MAX_SIZE_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Image file is too large. Maximum allowed size is 5MB.')
  }

  const fileExt = file.name.split('.').pop()
  const cleanOrgId = organizationId || 'general'
  const filePath = `${cleanOrgId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('resource-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (uploadError) {
    console.error('Storage upload failed:', uploadError.message)
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('resource-images')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

/**
 * Fetch all available resources (operational status != unavailable).
 */
export async function getAvailableResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .neq('status', 'unavailable')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching available resources:', error.message)
    throw error
  }

  return (data || []) as Resource[]
}

/**
 * Query resources with comprehensive search and filtering.
 */
export async function listResources(filters?: ResourceFilters): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category)
  }

  if (filters?.resourceType && filters.resourceType !== 'all') {
    query = query.eq('resource_type', filters.resourceType)
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.organizationId && filters.organizationId !== 'all') {
    query = query.eq('organization_id', filters.organizationId)
  }

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`
    query = query.or(`title.ilike.${term},description.ilike.${term},location.ilike.${term}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error querying resources:', error.message)
    throw error
  }

  return (data || []) as Resource[]
}

/**
 * Fetch a single resource by its unique UUID.
 */
export async function getResourceById(id: string): Promise<Resource | null> {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(`Error fetching resource ${id}:`, error.message)
    throw error
  }

  return data as Resource | null
}

/**
 * Fetch all resources owned or managed by a specific user.
 */
export async function getOwnerResources(ownerId: string): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`Error fetching owner resources for ${ownerId}:`, error.message)
    throw error
  }

  return (data || []) as Resource[]
}

/**
 * Create a new resource under an owner's organization.
 */
export async function createResource(
  dto: CreateResourceDTO & { owner_id: string }
): Promise<Resource> {
  const payload = {
    owner_id: dto.owner_id,
    organization_id: dto.organization_id,
    title: dto.title.trim(),
    description: dto.description?.trim() || null,
    category: dto.category.trim(),
    resource_type: dto.resource_type,
    location: dto.location.trim(),
    image_url: dto.image_url || null,
    availability_info: dto.availability_info || {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hours: '09:00 - 18:00'
    },
    eligibility_requirements: dto.eligibility_requirements?.trim() || null,
    training_required: Boolean(dto.training_required),
    usage_limit_per_user: dto.usage_limit_per_user || 1,
    status: dto.status || 'available'
  }

  const { data, error } = await supabase
    .from('resources')
    .insert(payload)
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error('Error creating resource:', error.message)
    throw error
  }

  return data as Resource
}

/**
 * Update an existing resource.
 */
export async function updateResource(
  id: string,
  dto: UpdateResourceDTO
): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .update(dto)
    .eq('id', id)
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    console.error(`Error updating resource ${id}:`, error.message)
    throw error
  }

  return data as Resource
}

/**
 * Delete a resource from the database.
 */
export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(`Error deleting resource ${id}:`, error.message)
    throw error
  }
}

/**
 * Fetch all verified organizations for the create/edit forms.
 */
export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error listing organizations:', error.message)
    return []
  }

  return (data || []) as Organization[]
}

/**
 * React hook for managing resource discovery with state, loading, and error handling.
 */
export function useResourceDiscovery(initialFilters?: ResourceFilters) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ResourceFilters>(initialFilters || {})

  const fetchResources = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured()) {
        setError('Supabase connection parameters are not configured in .env.local.')
        setResources([])
        setLoading(false)
        return
      }

      const results = await listResources(filters)
      setResources(results)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve resources.'
      setError(msg)
      setResources([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  return {
    resources,
    loading,
    error,
    filters,
    setFilters,
    refetch: fetchResources
  }
}
