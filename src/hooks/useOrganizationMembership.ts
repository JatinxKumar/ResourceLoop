/**
 * useOrganizationMembership — hook for managing the organization membership request flow.
 *
 * Seeker side:
 *   - fetchMyRequests()  — load user's own requests (pending/approved/rejected)
 *
 * Admin side:
 *   - fetchAllRequests() — load all requests across all users
 *   - approveRequest(id) / rejectRequest(id) — make decisions
 */

import { useState, useCallback } from 'react';
import {
  fetchMyMembershipRequests,
  fetchAllMembershipRequests,
  requestOrganizationMembership,
  updateMembershipRequest,
} from '@/services/organizations';
import type { OrganizationMembershipRequest } from '@/types/domain';

// ---------------------------------------------------------------------------
// Seeker hook: my requests
// ---------------------------------------------------------------------------
export function useMyMembershipRequests() {
  const [requests, setRequests] = useState<OrganizationMembershipRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyMembershipRequests();
      setRequests(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load membership requests';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitRequest = useCallback(async (orgId: string): Promise<void> => {
    await requestOrganizationMembership(orgId);
    // Refresh requests list after submitting
    await fetchMyRequests();
  }, [fetchMyRequests]);

  return { requests, loading, error, fetchMyRequests, submitRequest };
}

// ---------------------------------------------------------------------------
// Admin hook: all requests
// ---------------------------------------------------------------------------
export function useAdminMembershipRequests() {
  const [requests, setRequests] = useState<OrganizationMembershipRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllMembershipRequests();
      setRequests(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load membership requests';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const approveRequest = useCallback(async (requestId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await updateMembershipRequest(requestId, 'approved');
      setSuccessMsg('Membership request approved. User has been affiliated with the organization.');
      await fetchAllRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve request';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }, [fetchAllRequests]);

  const rejectRequest = useCallback(async (requestId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await updateMembershipRequest(requestId, 'rejected');
      setSuccessMsg('Membership request rejected.');
      await fetchAllRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject request';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }, [fetchAllRequests]);

  return {
    requests,
    loading,
    actionLoading,
    error,
    successMsg,
    setSuccessMsg,
    setError,
    fetchAllRequests,
    approveRequest,
    rejectRequest,
  };
}

