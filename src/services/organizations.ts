/**
 * ResourceLoop - Organization Service
 * Handles queries for institutional partners, laboratories, and universities.
 * Also manages the organization membership request flow.
 */

import { supabase } from '../lib/supabase';
import type { Organization, OrganizationMembershipRequest } from '../types/domain';

/**
 * Retrieves all verified participating organizations, ordered alphabetically by name.
 */
export async function getOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getOrganizations] Error fetching organizations:', error.message);
    throw new Error(`Failed to retrieve organizations: ${error.message}`);
  }

  return (data as Organization[]) || [];
}

/**
 * Retrieves an organization by its unique ID.
 * Returns null if the organization is not found.
 */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (!id) {
    throw new Error('Organization ID is required');
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`[getOrganizationById] Error fetching organization ${id}:`, error.message);
    throw new Error(`Failed to retrieve organization: ${error.message}`);
  }

  return (data as Organization) || null;
}

// ---------------------------------------------------------------------------
// Organization Membership Request Flow
// ---------------------------------------------------------------------------

/**
 * Request membership in an organization.
 * Calls the backend RPC `request_organization_membership` which validates the caller
 * and inserts a pending request row in `organization_membership_requests`.
 *
 * BACKEND DEPENDENCY: Requires migration 005 and RPC `request_organization_membership`.
 */
export async function requestOrganizationMembership(orgId: string): Promise<void> {
  if (!orgId) throw new Error('Organization ID is required');

  const { error } = await supabase.rpc('request_organization_membership', { p_org_id: orgId });

  if (error) {
    console.error('[requestOrganizationMembership] RPC failed:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Fetch the current user's own membership requests (any status).
 * Seekers can use this to see their pending/approved/rejected requests.
 *
 * BACKEND DEPENDENCY: Requires migration 005 table + RLS policy allowing users
 * to SELECT their own rows.
 */
export async function fetchMyMembershipRequests(): Promise<OrganizationMembershipRequest[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('organization_membership_requests')
    .select('*, organization:organizations(id, name, organization_type)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchMyMembershipRequests] Query error:', error.message);
    throw new Error(error.message);
  }

  return (data as OrganizationMembershipRequest[]) || [];
}

/**
 * Fetch all membership requests (admin-only).
 * Returns rows joined with user and organization info.
 *
 * BACKEND DEPENDENCY: Requires migration 005 table + admin RLS policy.
 */
export async function fetchAllMembershipRequests(): Promise<OrganizationMembershipRequest[]> {
  const { data, error } = await supabase
    .from('organization_membership_requests')
    .select('*, user:profiles(id, full_name, email), organization:organizations(id, name, organization_type)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchAllMembershipRequests] Query error:', error.message);
    throw new Error(error.message);
  }

  return (data as OrganizationMembershipRequest[]) || [];
}

/**
 * Approve or reject a membership request (admin-only).
 * Calls the RPC `approve_organization_membership` which updates the request status
 * and, on approval, assigns the user's profile `organization_id`.
 *
 * BACKEND DEPENDENCY: Requires migration 005 RPC `approve_organization_membership`.
 */
export async function updateMembershipRequest(
  requestId: string,
  newStatus: 'approved' | 'rejected'
): Promise<void> {
  if (!requestId) throw new Error('Request ID is required');

  const { error } = await supabase.rpc('approve_organization_membership', {
    p_request_id: requestId,
    p_status: newStatus,
  });

  if (error) {
    console.error('[updateMembershipRequest] RPC failed:', error.message);
    throw new Error(error.message);
  }
}
