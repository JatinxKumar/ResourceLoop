import { supabase } from '@/lib/supabase'
import type { Organization, Profile, Resource, Booking, AuditLog } from '@/types/domain'

export interface PlatformTelemetry {
  totalResources: number
  totalUsers: number
  totalBookings: number
  totalIncidents: number
  totalAuditLogs: number
  organizations: Organization[]
}

/**
 * Retrieves aggregate platform telemetry for the administrative console.
 */
export async function getAdminPlatformTelemetry(): Promise<PlatformTelemetry> {
  const [orgsRes, resCountRes, usersCountRes, bookingsCountRes, incidentsCountRes, auditCountRes] =
    await Promise.all([
      supabase.from('organizations').select('*').order('name'),
      supabase.from('resources').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('incidents').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
    ])

  return {
    organizations: (orgsRes.data as Organization[]) || [],
    totalResources: resCountRes.count || 0,
    totalUsers: usersCountRes.count || 0,
    totalBookings: bookingsCountRes.count || 0,
    totalIncidents: incidentsCountRes.count || 0,
    totalAuditLogs: auditCountRes.count || 0,
  }
}

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
    .limit(limit)

  if (error) {
    console.error('[fetchAdminAuditLogs] Error:', error.message)
    return []
  }

  return (data as AuditLog[]) || []
}

/**
 * Fetch all platform users/profiles for governance oversight.
 */
export async function fetchAdminUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      organization:organizations(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchAdminUsers] Error:', error.message)
    throw new Error(error.message)
  }

  return (data as Profile[]) || []
}

/**
 * Update an organization verification status (Admin action).
 */
export async function updateOrganizationVerification(
  orgId: string,
  status: 'verified' | 'rejected' | 'pending'
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .update({ verification_status: status, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[updateOrganizationVerification] Error:', error.message)
    throw new Error(error.message)
  }

  return data as Organization
}
