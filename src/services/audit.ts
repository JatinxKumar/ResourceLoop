/**
 * ResourceLoop - Compliance Audit & History Service
 * Provides auditable activity logs, operational history for resources and users,
 * and data-backed institutional impact analytics.
 */

import { supabase } from '../lib/supabase';
import type {
  AuditLog,
  AuditLogFilters,
  ResourceHistory,
  UserHistory,
  ImpactMetrics,
  Booking,
  ConditionReport,
  Incident,
  Notification,
} from '../types/domain';
import { getResourceById } from './resources';
import { getProfileById } from './profiles';

/**
 * Retrieves compliance audit logs with filtering and actor details.
 * Restricted to administrators at the RLS database level.
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      actor:profiles!audit_logs_actor_id_fkey(id, full_name, email, avatar_url, role)
    `);

  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  if (filters.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }

  if (filters.actor_id) {
    query = query.eq('actor_id', filters.actor_id);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    const from = filters.offset || 0;
    const to = from + filters.limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getAuditLogs] Query error:', error.message);
    throw new Error(`Failed to retrieve audit trail: ${error.message}`);
  }

  return (data as AuditLog[]) || [];
}

/**
 * Retrieves the complete operational history of a specific asset:
 * Its catalog record, historical bookings, condition reports, and incidents.
 */
export async function getResourceHistory(resourceId: string): Promise<ResourceHistory> {
  const resource = await getResourceById(resourceId);
  if (!resource) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  const [bookingsRes, conditionRes, incidentsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        *,
        requester:profiles!bookings_requester_id_fkey(id, full_name, email)
      `)
      .eq('resource_id', resourceId)
      .order('start_time', { ascending: false }),
    supabase
      .from('condition_reports')
      .select(`
        *,
        submitter:profiles(id, full_name, email),
        booking:bookings!inner(resource_id)
      `)
      .eq('booking.resource_id', resourceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('incidents')
      .select(`
        *,
        reporter:profiles(id, full_name, email),
        booking:bookings!inner(resource_id)
      `)
      .eq('booking.resource_id', resourceId)
      .order('created_at', { ascending: false }),
  ]);

  const bookings = (bookingsRes.data as Booking[]) || [];
  const conditionReports = (conditionRes.data as ConditionReport[]) || [];
  const incidents = (incidentsRes.data as Incident[]) || [];

  const completedCount = bookings.filter(
    (b) => b.status === 'returned' || b.status === 'checked_in'
  ).length;

  return {
    resource,
    total_bookings: bookings.length,
    completed_bookings: completedCount,
    incidents_count: incidents.length,
    bookings,
    condition_reports: conditionReports,
    incidents,
  };
}

/**
 * Retrieves the comprehensive historical track record of a user / researcher:
 * Their bookings, completed sessions, logged incidents, and notifications.
 */
export async function getUserHistory(userId: string): Promise<UserHistory> {
  const profile = await getProfileById(userId);
  if (!profile) {
    throw new Error(`Profile ${userId} not found`);
  }

  const [bookingsRes, notificationsRes, incidentsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        *,
        resource:resources(id, title, category, location)
      `)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('incidents')
      .select('*')
      .eq('reported_by', userId)
      .order('created_at', { ascending: false }),
  ]);

  const bookings = (bookingsRes.data as Booking[]) || [];
  const notifications = (notificationsRes.data as Notification[]) || [];
  const incidents = (incidentsRes.data as Incident[]) || [];

  const completed = bookings.filter((b) => b.status === 'returned').length;

  return {
    profile,
    total_reservations: bookings.length,
    completed_reservations: completed,
    incidents_logged: incidents.length,
    bookings,
    notifications,
  };
}

/**
 * Calculates live institutional impact metrics derived directly from Supabase database tables:
 * Aggregates completed reservation duration, counts active equipment, and computes
 * research capital avoidance metrics.
 */
export async function getInstitutionalImpactMetrics(): Promise<ImpactMetrics> {
  const [completedBookingsRes, activeResourcesRes, orgsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, start_time, end_time, status')
      .in('status', ['approved', 'checked_in', 'returned']),
    supabase
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'available'),
    supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'verified'),
  ]);

  const bookings = completedBookingsRes.data || [];
  let totalHours = 0;

  for (const b of bookings) {
    const start = new Date(b.start_time).getTime();
    const end = new Date(b.end_time).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      totalHours += (end - start) / (1000 * 60 * 60);
    }
  }

  // Institutional benchmarks:
  // $125/hr average CapEx duplication avoidance for specialized lab equipment
  // 1.5 kg CO2 avoided per equipment sharing hour vs new fabrication
  const capexAvoidance = Math.round(totalHours * 125);
  const co2Avoidance = Math.round(totalHours * 1.5);

  return {
    total_completed_bookings: bookings.length,
    total_booking_hours: Math.round(totalHours),
    total_active_resources: activeResourcesRes.count || 0,
    total_participating_orgs: orgsRes.count || 0,
    estimated_capex_avoidance_usd: capexAvoidance,
    estimated_co2_avoidance_kg: co2Avoidance,
    generated_at: new Date().toISOString(),
  };
}

