/**
 * ResourceLoop - Resource UI Hooks & Service Delegation
 * Delegated to the official backend service layer in src/services/resources.ts and src/services/organizations.ts.
 * Responsible for UI state, loading states, error handling, and reactive refresh triggers.
 */

import { useState, useEffect, useCallback } from 'react'
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
      const msg = err instanceof Error ? err.message : 'Failed to retrieve resources from service.'
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
