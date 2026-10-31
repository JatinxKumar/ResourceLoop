/**
 * ResourceLoop - Campus Governance & Platform Administration Service
 * Provides organizational compliance, user role governance, penalty human review,
 * and central telemetry oversight for platform administrators.
 */

import { supabase } from '../lib/supabase';
import type {
  Organization,
  Profile,
  UserRole,
  OrganizationVerificationStatus,
  AuditLog,
} from '../types/domain';
import { getCurrentProfile } from './profiles';

export interface PlatformTelemetry {
  totalResources: number;
  totalUsers: number;
  totalBookings: number;
  totalIncidents: number;
  totalAuditLogs: number;
  organizations: Organization[];
  totalOrganizations: number;
  verifiedOrganizations: number;
  openIncidents: number;
}

/**
 * Retrieves aggregate platform telemetry for the administrative console.
 * Canonical method providing comprehensive platform numbers directly from live Supabase tables.
 */
export async function getAdminPlatformTelemetry(): Promise<PlatformTelemetry> {
  const [
    orgsRes,
    resCountRes,
    usersCountRes,
    bookingsCountRes,
    incidentsCountRes,
    auditCountRes,
    openIncidentsCountRes,
  ] = await Promise.all([
    supabase.from('organizations').select('*').order('name', { ascending: true }),
    supabase.from('resources').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('incidents').select('*', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  const organizations = (orgsRes.data as Organization[]) || [];
  const verifiedCount = organizations.filter((o) => o.verification_status === 'verified').length;

  return {
    organizations,
    totalResources: resCountRes.count || 0,
    totalUsers: usersCountRes.count || 0,
    totalBookings: bookingsCountRes.count || 0,
    totalIncidents: incidentsCountRes.count || 0,
    totalAuditLogs: auditCountRes.count || 0,
    totalOrganizations: organizations.length,
    verifiedOrganizations: verifiedCount,
    openIncidents: openIncidentsCountRes.count || 0,
  };
}

/**
 * Canonical alias for getAdminPlatformTelemetry across existing and legacy callers.
 */
export const getPlatformOverview = getAdminPlatformTelemetry;

/**
 * Fetch recent immutable audit logs for administrative compliance review.
 */
export async function fetchAdminAuditLogs(limit: number = 25): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      actor:profiles!audit_logs_actor_id_fkey(id, full_name, email, role)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchAdminAuditLogs] Error:', error.message);
    return [];
  }

  return (data as AuditLog[]) || [];
}

/**
 * Fetch all platform users/profiles for governance oversight.
 * Canonical method name per API_CONTRACT.md.
 */
export async function fetchAdminUsers(role?: UserRole): Promise<Profile[]> {
  let query = supabase
    .from('profiles')
    .select(`
      *,
      organization:organizations(*)
    `)
    .order('created_at', { ascending: false });

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[fetchAdminUsers] Error fetching user directory:', error.message);
    throw new Error(`Failed to retrieve users: ${error.message}`);
  }

  return (data as Profile[]) || [];
}

/**
 * Alias for fetchAdminUsers to satisfy legacy listAllUsers imports.
 */
export const listAllUsers = fetchAdminUsers;

/**
 * Lists all registered institutions and research labs with optional status filter.
 */
export async function listAllOrganizations(status?: OrganizationVerificationStatus): Promise<Organization[]> {
  let query = supabase
    .from('organizations')
    .select('*')
    .order('name', { ascending: true });

  if (status) {
    query = query.eq('verification_status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[listAllOrganizations] Error:', error.message);
    throw new Error(`Failed to list organizations: ${error.message}`);
  }

  return (data as Organization[]) || [];
}

/**
 * Update an organization verification status (Admin action).
 * Canonical name across frontend and backend layers.
 */
export async function updateOrganizationVerification(
  orgId: string,
  status: 'verified' | 'rejected' | 'pending'
): Promise<Organization> {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Unauthorized: Only administrators can update organization verification status');
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({
      verification_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)
    .select('*')
    .single();

  if (error) {
    console.error(`[updateOrganizationVerification] Failed to update ${orgId}:`, error.message);
    throw new Error(`Failed to update organization status: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: `ORGANIZATION_${status.toUpperCase()}`,
    entity_type: 'organization',
    entity_id: orgId,
    details: {
      status,
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
    },
  });

  return data as Organization;
}

/**
 * Canonical alias for updateOrganizationVerification for backward compatibility.
 */
export const verifyOrganization = updateOrganizationVerification;

/**
 * Updates a user's platform access role ('seeker', 'owner', 'admin').
 * Strictly restricted to platform administrators.
 * Underlying database trigger (trg_profiles_role_guard) aborts transaction if non-admin attempts update.
 */
export async function updateUserRole(userId: string, newRole: UserRole): Promise<Profile> {
  if (!userId) throw new Error('User ID is required');

  const admin = await getCurrentProfile();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Unauthorized: Only platform administrators can change user roles');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    console.error(`[updateUserRole] Failed to promote/demote ${userId}:`, error.message);
    throw new Error(`Failed to update user role: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'USER_ROLE_UPDATED',
    entity_type: 'profile',
    entity_id: userId,
    details: {
      new_role: newRole,
      updated_by: admin.id,
    },
  });

  return data as Profile;
}
