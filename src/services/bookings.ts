/**
 * ResourceLoop - Booking & Allocation Engine Service
 * Implements the complete booking lifecycle: request, review (approve/reject/waitlist),
 * cancellation, QR access pass generation, physical check-in/out handshakes,
 * and overdue tracking.
 */

import { supabase } from '../lib/supabase';
import type {
  Booking,
  CreateBookingDTO,
  BookingPassResponse,
  VerifyHandshakeDTO,
  BookingFilters,
  ConditionReport,
  Incident,
} from '../types/domain';

// ==============================================================================
// 1. QUERY SERVICES
// ==============================================================================

/**
 * Retrieves a single booking by UUID with expanded resource, organization,
 * condition reports, and incidents.
 */
export async function getBookingById(id: string): Promise<Booking | null> {
  if (!id) throw new Error('Booking ID is required');

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      resource:resources(
        *,
        organization:organizations(*),
        owner:profiles(id, full_name, email, avatar_url)
      ),
      requester:profiles!bookings_requester_id_fkey(
        id,
        full_name,
        email,
        avatar_url,
        organization:organizations(*)
      ),
      approver:profiles!bookings_approved_by_fkey(
        id,
        full_name,
        email
      ),
      condition_reports(*),
      incidents(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getBookingById] Query error:', error.message);
    throw new Error(`Failed to retrieve booking: ${error.message}`);
  }

  return (data as Booking) || null;
}

/**
 * Lists all bookings requested by a specific seeker (or current authenticated user).
 */
export async function fetchUserBookings(userId?: string): Promise<Booking[]> {
  let targetUserId = userId;

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to fetch reservations');
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      resource:resources(
        *,
        organization:organizations(*),
        owner:profiles(id, full_name, email, avatar_url)
      ),
      condition_reports(*),
      incidents(*)
    `)
    .eq('requester_id', targetUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchUserBookings] Query error:', error.message);
    throw new Error(`Failed to fetch user reservations: ${error.message}`);
  }

  return (data as Booking[]) || [];
}

/**
 * Lists all bookings for resources managed by an asset owner.
 */
export async function fetchOwnerBookings(ownerId?: string): Promise<Booking[]> {
  let targetOwnerId = ownerId;

  if (!targetOwnerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to fetch owner bookings');
    targetOwnerId = user.id;
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      resource!inner(
        *,
        organization:organizations(*)
      ),
      requester:profiles!bookings_requester_id_fkey(
        id,
        full_name,
        email,
        avatar_url,
        organization:organizations(*)
      ),
      condition_reports(*),
      incidents(*)
    `)
    .eq('resource.owner_id', targetOwnerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchOwnerBookings] Query error:', error.message);
    throw new Error(`Failed to fetch owner reservations: ${error.message}`);
  }

  return (data as Booking[]) || [];
}

/**
 * General filterable query for administrative or dashboard views.
 */
export async function listBookings(filters: BookingFilters = {}): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select(`
      *,
      resource:resources(title, category, location, organization:organizations(name)),
      requester:profiles!bookings_requester_id_fkey(full_name, email)
    `);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.resource_id) {
    query = query.eq('resource_id', filters.resource_id);
  }

  if (filters.requester_id) {
    query = query.eq('requester_id', filters.requester_id);
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    const from = filters.offset || 0;
    const to = from + filters.limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[listBookings] Query error:', error.message);
    throw new Error(`Failed to list bookings: ${error.message}`);
  }

  return (data as Booking[]) || [];
}

/**
 * Retrieves the complete operational timeline for a booking:
 * The booking details, associated condition inspection reports, and compliance audit trail.
 */
export async function getBookingTimeline(bookingId: string): Promise<{
  booking: Booking;
  conditionReports: ConditionReport[];
  incidents: Incident[];
  auditLogs: Record<string, unknown>[];
}> {
  const booking = await getBookingById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  // Query audit logs linked to this booking
  const { data: auditData, error: auditError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'booking')
    .eq('entity_id', bookingId)
    .order('created_at', { ascending: true });

  if (auditError) {
    console.warn('[getBookingTimeline] Audit log query warning:', auditError.message);
  }

  return {
    booking,
    conditionReports: booking.condition_reports || [],
    incidents: booking.incidents || [],
    auditLogs: (auditData as Record<string, unknown>[]) || [],
  };
}

// ==============================================================================
// 2. STATE MACHINE RPC MUTATIONS
// ==============================================================================

/**
 * Submits a new booking request.
 * Enforces atomic eligibility, organization verification, and usage limits.
 * Executes: public.request_booking(p_resource_id, p_start_time, p_end_time, p_purpose)
 */
export async function requestBooking(dto: CreateBookingDTO): Promise<Booking> {
  const { data, error } = await supabase.rpc('request_booking', {
    p_resource_id: dto.resource_id,
    p_start_time: dto.start_time,
    p_end_time: dto.end_time,
    p_purpose: dto.purpose.trim(),
  });

  if (error) {
    console.error('[requestBooking] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

/**
 * Approves a pending or waitlisted booking (Owner/Admin action).
 * Enforces GiST scheduled overlap exclusion constraint and active custody checks.
 * Executes: public.approve_booking(p_booking_id)
 */
export async function approveBooking(bookingId: string): Promise<Booking> {
  if (!bookingId) throw new Error('Booking ID is required');

  const { data, error } = await supabase.rpc('approve_booking', {
    p_booking_id: bookingId,
  });

  if (error) {
    console.error('[approveBooking] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

/**
 * Rejects a booking request with a mandatory explanation reason.
 * Executes: public.reject_booking(p_booking_id, p_rejection_reason)
 */
export async function rejectBooking(bookingId: string, rejectionReason: string): Promise<Booking> {
  if (!bookingId) throw new Error('Booking ID is required');
  const cleanReason = (rejectionReason || '').trim();
  if (cleanReason.length < 3) {
    throw new Error('A descriptive rejection reason is required (at least 3 characters)');
  }

  const { data, error } = await supabase.rpc('reject_booking', {
    p_booking_id: bookingId,
    p_rejection_reason: cleanReason,
  });

  if (error) {
    console.error('[rejectBooking] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

/**
 * Moves a pending booking to the deterministic FIFO waitlist queue.
 * Executes: public.waitlist_booking(p_booking_id)
 */
export async function waitlistBooking(bookingId: string): Promise<Booking> {
  if (!bookingId) throw new Error('Booking ID is required');

  const { data, error } = await supabase.rpc('waitlist_booking', {
    p_booking_id: bookingId,
  });

  if (error) {
    console.error('[waitlistBooking] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

/**
 * Cancels a booking. Callable by requester (own booking) or owner/admin prior to check_in.
 * Executes: public.cancel_booking(p_booking_id)
 */
export async function cancelBooking(bookingId: string): Promise<Booking> {
  if (!bookingId) throw new Error('Booking ID is required');

  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
  });

  if (error) {
    console.error('[cancelBooking] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

// ==============================================================================
// 3. QR LIFECYCLE & HANDSHAKE MUTATIONS
// ==============================================================================

/**
 * Generates an opaque, high-entropy QR access pass.
 * STRICT: Restricted to the booking's requester (seeker).
 * Returns the raw token ONCE to the seeker for display on screen.
 * Stored in database exclusively as SHA-256 hash.
 * Executes: public.generate_booking_pass(p_booking_id, p_token_type)
 */
export async function generateBookingPass(
  bookingId: string,
  tokenType: 'check_in' | 'check_out'
): Promise<BookingPassResponse> {
  if (!bookingId) throw new Error('Booking ID is required');

  const { data, error } = await supabase.rpc('generate_booking_pass', {
    p_booking_id: bookingId,
    p_token_type: tokenType,
  });

  if (error) {
    console.error('[generateBookingPass] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return data as BookingPassResponse;
}

/**
 * Physical QR Check-In Handshake:
 * Authenticated Owner/Custodian scans seeker's displayed token, inspects asset,
 * and completes verification.
 * Executes: public.verify_check_in(p_raw_token, p_condition_status, p_condition_notes, p_image_url)
 */
export async function verifyCheckIn(dto: VerifyHandshakeDTO): Promise<Booking> {
  if (!dto.raw_token) throw new Error('Access token is required');
  if (!dto.condition_status) throw new Error('Pre-session condition status is required');

  const { data, error } = await supabase.rpc('verify_check_in', {
    p_raw_token: dto.raw_token.trim(),
    p_condition_status: dto.condition_status,
    p_condition_notes: dto.condition_notes?.trim() || null,
    p_image_url: dto.image_url?.trim() || null,
  });

  if (error) {
    console.error('[verifyCheckIn] Handshake failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

/**
 * Physical QR Return / Check-Out Handshake:
 * Authenticated Owner/Custodian scans return token, inspects asset post-session,
 * and completes return. If damaged or faulty, opens an incident automatically.
 * Executes: public.verify_check_out(p_raw_token, p_condition_status, p_condition_notes, p_image_url)
 */
export async function verifyCheckOut(dto: VerifyHandshakeDTO): Promise<Booking> {
  if (!dto.raw_token) throw new Error('Return token is required');
  if (!dto.condition_status) throw new Error('Post-session condition status is required');

  const { data, error } = await supabase.rpc('verify_check_out', {
    p_raw_token: dto.raw_token.trim(),
    p_condition_status: dto.condition_status,
    p_condition_notes: dto.condition_notes?.trim() || null,
    p_image_url: dto.image_url?.trim() || null,
  });

  if (error) {
    console.error('[verifyCheckOut] Handshake failed:', error.message);
    throw new Error(error.message);
  }

  return data as Booking;
}

/**
 * Maintenance check: sweeps all checked_in bookings where end_time has passed
 * and transitions them to overdue.
 * Executes: public.mark_overdue_bookings()
 */
export async function markOverdueBookings(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_overdue_bookings');

  if (error) {
    console.error('[markOverdueBookings] RPC failed:', error.message);
    throw new Error(error.message);
  }

  return (data as number) || 0;
}
