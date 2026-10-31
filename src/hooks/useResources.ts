/**
 * ResourceLoop - Resource UI Hooks & Service Delegation
 * Delegated to the official backend service layer in src/services/resources.ts and src/services/organizations.ts.
 * Responsible for UI state, loading states, error handling, and reactive refresh triggers.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  listResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  getOwnerResources,
  getAvailableResources,
  uploadResourceImage,
  getResourceAvailability,
  checkResourceEligibility
} from '@/services/resources'
import { getOrganizations, getOrganizationById } from '@/services/organizations'
import type {
  Resource,
  ResourceFilters,
  CreateResourceDTO,
  UpdateResourceDTO,
  Organization
} from '@/types/domain'

// Re-export backend service methods for clean, centralized access
export {
  listResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  getOwnerResources,
  getAvailableResources,
  uploadResourceImage,
  getResourceAvailability,
  checkResourceEligibility,
  getOrganizations,
  getOrganizationById
}

/**
 * React hook for managing resource discovery with state, loading, and error handling.
 * Delegates data querying to the backend service function `listResources(filters)`.
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
      const results = await listResources(filters)
      setResources(results)
    } catch (err: unknown) {
      console.warn('[useResourceDiscovery] Backend listResources failed, querying resources directly:', err)
      try {
        let query = supabase
          .from('resources')
          .select('*, organization:organizations(*)')

        const searchString = (filters.query || filters.search || '').trim()
        if (searchString.length > 0) {
          query = query.or(`title.ilike.%${searchString}%,description.ilike.%${searchString}%,category.ilike.%${searchString}%,location.ilike.%${searchString}%`)
        }
        if (filters.category && filters.category !== 'all') {
          query = query.eq('category', filters.category)
        }
        const rType = filters.resource_type || (filters.resourceType !== 'all' ? filters.resourceType : undefined)
        if (rType) {
          query = query.eq('resource_type', rType)
        }
        const orgId = filters.organization_id || (filters.organizationId !== 'all' ? filters.organizationId : undefined)
        if (orgId) {
          query = query.eq('organization_id', orgId)
        }

        const { data, error: qErr } = await query
        if (qErr) {
          console.warn('[useResourceDiscovery] Join query failed, querying plain resources:', qErr.message)
          const { data: plainData, error: plainErr } = await supabase.from('resources').select('*')
          if (plainErr) throw plainErr
          setResources((plainData as Resource[]) || [])
        } else {
          setResources((data as Resource[]) || [])
        }
      } catch (fallbackErr: unknown) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to retrieve resources from service.'
        setError(msg)
        setResources([])
      }
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
