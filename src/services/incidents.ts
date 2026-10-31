/**
 * ResourceLoop - Incident & Penalty Management Service
 * Manages safety hazards, damage reporting, equipment loss, misuse,
 * and administrative human review of penalties and disputes.
 */

import { supabase } from '../lib/supabase';
import type {
  Incident,
  CreateIncidentDTO,
  ResolveIncidentDTO,
  IncidentFilters,
  ReviewPenaltyDTO,
} from '../types/domain';
import { getCurrentProfile } from './profiles';

/**
 * Reports a new incident against a booking or equipment asset.
 * Notifies the equipment custodian and logs to the compliance audit trail.
 */
export async function reportIncident(dto: CreateIncidentDTO): Promise<Incident> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: You must be signed in to report an incident');
  }

  const description = dto.description.trim();
  if (description.length < 5) {
    throw new Error('Incident description must be at least 5 characters');
  }

  const payload = {
    booking_id: dto.booking_id || null,
    reported_by: profile.id,
    incident_type: dto.incident_type,
    description,
    status: 'open' as const,
  };

  const { data, error } = await supabase
    .from('incidents')
    .insert(payload)
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email, avatar_url),
      booking:bookings(
        id,
        resource:resources(id, title, owner_id)
      )
    `)
    .single();

  if (error) {
    console.error('[reportIncident] Error creating incident:', error.message);
    throw new Error(`Failed to report incident: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'INCIDENT_REPORTED',
    entity_type: 'incident',
    entity_id: data.id,
    details: {
      booking_id: dto.booking_id || null,
      incident_type: dto.incident_type,
      description,
    },
  });

  return data as Incident;
}

/**
 * Retrieves a list of incidents with optional filtering by status, type, or booking.
 */
export async function getIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
  let query = supabase
    .from('incidents')
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email, avatar_url),
      booking:bookings(
        id,
        resource:resources(id, title, location, organization:organizations(name)),
        requester:profiles!bookings_requester_id_fkey(id, full_name, email)
      )
    `);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.incident_type && filters.incident_type !== 'all') {
    query = query.eq('incident_type', filters.incident_type);
  }

  if (filters.booking_id) {
    query = query.eq('booking_id', filters.booking_id);
  }

  if (filters.reported_by) {
    query = query.eq('reported_by', filters.reported_by);
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    const from = filters.offset || 0;
    const to = from + filters.limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getIncidents] Query error:', error.message);
    throw new Error(`Failed to fetch incidents: ${error.message}`);
  }

  return (data as Incident[]) || [];
}

/**
 * Retrieves detailed information for a single incident.
 */
export async function getIncidentById(id: string): Promise<Incident | null> {
  if (!id) throw new Error('Incident ID is required');

  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email, avatar_url),
      booking:bookings(
        id,
        start_time,
        end_time,
        purpose,
        status,
        resource:resources(id, title, location, organization:organizations(name)),
        requester:profiles!bookings_requester_id_fkey(id, full_name, email),
        condition_reports(*)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`[getIncidentById] Error fetching incident ${id}:`, error.message);
    throw new Error(`Failed to retrieve incident: ${error.message}`);
  }

  return (data as Incident) || null;
}

/**
 * Updates an incident's investigation status and resolution notes.
 */
export async function updateIncidentStatus(
  id: string,
  dto: ResolveIncidentDTO
): Promise<Incident> {
  if (!id) throw new Error('Incident ID is required');

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: Authentication required to resolve incidents');
  }

  const { data, error } = await supabase
    .from('incidents')
    .update({
      status: dto.status,
      resolution_notes: dto.resolution_notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error(`[updateIncidentStatus] Error updating incident ${id}:`, error.message);
    throw new Error(`Failed to update incident: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'INCIDENT_STATUS_UPDATED',
    entity_type: 'incident',
    entity_id: id,
    details: {
      new_status: dto.status,
      resolution_notes: dto.resolution_notes,
    },
  });

  return data as Incident;
}

/**
 * Administrative Human Review of Penalties:
 * Allows authorized platform administrators or lab directors to review damage,
 * late return, or safety violation penalties, apply discretion (e.g. waive, warn,
 * require repair compensation, or suspend borrowing privileges), and notify the borrower.
 */
export async function reviewPenalty(dto: ReviewPenaltyDTO): Promise<Incident> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Only platform administrators can conduct official human penalty reviews');
  }

  const incident = await getIncidentById(dto.incident_id);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const resolutionSummary = `[ADMIN PENALTY REVIEW: ${dto.action.toUpperCase()}] ${dto.resolution_notes.trim()}${
    dto.penalty_amount ? ` (Financial assessment: $${dto.penalty_amount})` : ''
  }`;

  const { data, error } = await supabase
    .from('incidents')
    .update({
      status: dto.status,
      resolution_notes: resolutionSummary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dto.incident_id)
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email)
    `)
    .single();

  if (error) {
    console.error(`[reviewPenalty] Error completing penalty review for ${dto.incident_id}:`, error.message);
    throw new Error(`Failed to complete penalty review: ${error.message}`);
  }

  // Audit log with full governance details
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'PENALTY_HUMAN_REVIEW_COMPLETED',
    entity_type: 'incident',
    entity_id: dto.incident_id,
    details: {
      action: dto.action,
      penalty_amount: dto.penalty_amount || 0,
      notes: dto.resolution_notes,
      reviewed_by: profile.id,
    },
  });

  // Notify the reported user if linked to a booking
  const booking = incident.booking as { requester?: { id: string } } | null;
  if (booking?.requester?.id) {
    await supabase.from('notifications').insert({
      user_id: booking.requester.id,
      title: 'Administrative Decision on Reported Incident',
      message: `Your incident review has concluded with action "${dto.action}". Resolution: ${dto.resolution_notes}`,
      link_url: '/seeker/bookings',
    });
  }

  return data as Incident;
}
