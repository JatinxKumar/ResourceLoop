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
} from '../types/domain';
import { getCurrentProfile } from './profiles';

/**
 * Lists all registered institutions and research labs with their verification status.
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
 * Verifies or rejects an institution's enrollment application.
 * Restricted to platform administrators.
 */
export async function verifyOrganization(
  organizationId: string,
  status: 'verified' | 'rejected'
): Promise<Organization> {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Forbidden: Only platform administrators can verify organizations');
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({
      verification_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select('*')
    .single();

  if (error) {
    console.error(`[verifyOrganization] Failed to update ${organizationId}:`, error.message);
    throw new Error(`Failed to update organization status: ${error.message}`);
  }

  // Audit trail
  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: `ORGANIZATION_${status.toUpperCase()}`,
    entity_type: 'organization',
    entity_id: organizationId,
    details: {
      status,
      verified_by: admin.id,
    },
  });

  return data as Organization;
}

/**
 * Lists all registered user profiles with institutional affiliations for administrative review.
 */
export async function listAllUsers(role?: UserRole): Promise<Profile[]> {
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
    console.error('[listAllUsers] Error fetching user directory:', error.message);
    throw new Error(`Failed to retrieve users: ${error.message}`);
  }

  return (data as Profile[]) || [];
}

/**
 * Updates a user's platform access role ('seeker', 'owner', 'admin').
 * Strictly restricted to platform administrators.
 * Protected by database trigger `prevent_profile_role_escalation`.
 */
export async function updateUserRole(userId: string, newRole: UserRole): Promise<Profile> {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Forbidden: Only platform administrators can modify user access roles');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(`
      *,
      organization:organizations(*)
    `)
    .single();

  if (error) {
    console.error(`[updateUserRole] Failed to assign role ${newRole} to ${userId}:`, error.message);
    throw new Error(`Failed to update user role: ${error.message}`);
  }

  // Audit trail
  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'USER_ROLE_ASSIGNED',
    entity_type: 'profile',
    entity_id: userId,
    details: {
      assigned_role: newRole,
      assigned_by: admin.id,
    },
  });

  return data as Profile;
}

/**
 * Platform Governance Overview:
 * Returns central platform telemetry and entity counts directly from live Supabase tables.
 */
export async function getPlatformOverview(): Promise<{
  totalOrganizations: number;
  verifiedOrganizations: number;
  totalUsers: number;
  totalResources: number;
  totalBookings: number;
  openIncidents: number;
}> {
  const [
    orgsTotal,
    orgsVerified,
    usersCount,
    resourcesCount,
    bookingsCount,
    incidentsCount,
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('resources').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  return {
    totalOrganizations: orgsTotal.count || 0,
    verifiedOrganizations: orgsVerified.count || 0,
    totalUsers: usersCount.count || 0,
    totalResources: resourcesCount.count || 0,
    totalBookings: bookingsCount.count || 0,
    openIncidents: incidentsCount.count || 0,
  };
}
