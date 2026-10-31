/**
 * ResourceLoop - Resource Donations & Surplus Asset Service
 * Manages institutional equipment donations, permanent transfers, and surplus allocation
 * without requiring new tables by utilizing resources (availability_info metadata) and bookings.
 */

import { supabase } from '../lib/supabase';
import type {
  Resource,
  Booking,
  CreateDonationDTO,
  RequestDonationDTO,
  ResourceFilters,
} from '../types/domain';
import { getCurrentProfile } from './profiles';
import { requestBooking, rejectBooking } from './bookings';

/**
 * Creates a donation / surplus asset listing for permanent transfer.
 * Strictly restricted to verified owners or platform administrators.
 */
export async function createDonationListing(dto: CreateDonationDTO): Promise<Resource> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: Authentication required to create a donation listing');
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    throw new Error('Forbidden: Only institutional asset owners or administrators can list surplus donations');
  }

  if (profile.role !== 'admin' && profile.organization_id !== dto.organization_id) {
    throw new Error('Forbidden: You can only list donations for your affiliated organization');
  }

  const availabilityInfo = {
    is_donation: true,
    condition_status: dto.condition_status,
    estimated_value: dto.estimated_value || 0,
    transfer_terms: dto.transfer_terms?.trim() || 'Institutional transfer as-is',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    hours: 'Transfer on schedule',
  };

  const payload = {
    owner_id: profile.id,
    organization_id: dto.organization_id,
    title: dto.title.trim(),
    description: dto.description.trim(),
    category: dto.category.trim(),
    resource_type: 'equipment' as const,
    location: dto.location.trim(),
    image_url: dto.image_url || null,
    availability_info: availabilityInfo,
    eligibility_requirements: 'Verified academic or non-profit research institution',
    training_required: false,
    usage_limit_per_user: 1,
    status: 'available' as const,
  };

  const { data, error } = await supabase
    .from('resources')
    .insert(payload)
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('[createDonationListing] Insert error:', error.message);
    throw new Error(`Failed to list donation: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'DONATION_LISTING_CREATED',
    entity_type: 'resource',
    entity_id: data.id,
    details: {
      title: data.title,
      organization_id: dto.organization_id,
      condition_status: dto.condition_status,
    },
  });

  return data as Resource;
}

/**
 * Lists available surplus and donated equipment across all partner institutions.
 */
export async function listDonationListings(filters: ResourceFilters = {}): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .eq('resource_type', 'equipment')
    .filter('availability_info->>is_donation', 'eq', 'true');

  if (filters.available_only !== false) {
    query = query.eq('status', 'available');
  }

  const search = (filters.query || filters.search || '').trim();
  if (search.length > 0) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%,category.ilike.%${search}%`);
  }

  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  if (filters.organization_id || filters.organizationId) {
    query = query.eq('organization_id', (filters.organization_id || filters.organizationId)!);
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    const from = filters.offset || 0;
    const to = from + filters.limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[listDonationListings] Query error:', error.message);
    throw new Error(`Failed to retrieve donation listings: ${error.message}`);
  }

  return (data as Resource[]) || [];
}

/**
 * Submits a request to claim / acquire a donated surplus asset.
 * Executes through the unified booking RPC engine with a designated donation payload.
 */
export async function requestDonation(dto: RequestDonationDTO): Promise<Booking> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: You must be signed in to request a donation');
  }

  if (!profile.organization_id) {
    throw new Error('Forbidden: You must be affiliated with an institution to request surplus equipment');
  }

  // Retrieve resource details to identify donor owner for notification dispatch
  const { data: resource, error: resError } = await supabase
    .from('resources')
    .select('id, title, owner_id')
    .eq('id', dto.resource_id)
    .single();

  if (resError || !resource) {
    throw new Error('Surplus resource not found');
  }

  // Standard 14-day transfer window for the donation allocation request
  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const formattedPurpose = `[DONATION_CLAIM] ${dto.purpose.trim()}${
    dto.intended_use ? ` | Intended Use: ${dto.intended_use.trim()}` : ''
  }`;

  const booking = await requestBooking({
    resource_id: dto.resource_id,
    start_time: startTime,
    end_time: endTime,
    purpose: formattedPurpose,
  });

  // Notify donor owner
  if (resource.owner_id) {
    await supabase.from('notifications').insert({
      user_id: resource.owner_id,
      title: 'New Donation Request Received',
      message: `${profile.full_name || 'A researcher'} submitted a claim request for surplus equipment "${resource.title}".`,
      link_url: '/donations',
    });
  }

  return booking;
}

/**
 * Accepts a donation transfer request.
 * Executes atomically in a single database transaction via the public.accept_donation RPC:
 *   1. Authenticates caller & verifies ownership/admin privileges.
 *   2. Validates booking is currently pending/waitlisted.
 *   3. Validates donation metadata and [DONATION_CLAIM] purpose marker.
 *   4. Enforces active custody protection and shared resource advisory locks.
 *   5. Approves booking, assigns approver, clears waitlist position.
 *   6. Retires resource lifecycle status to 'unavailable'.
 *   7. Recalculates waitlist queue for remaining reservations.
 *   8. Provisions compliance audit trail record.
 *   9. Dispatches recipient notification.
 * Failure of any step rolls back the entire database transaction.
 *
 * NOTE: If Migration 004 is not yet deployed, throws a clear user-facing requirement
 * rather than silently performing non-atomic mutations or bypassing authorization checks.
 */
export async function acceptDonation(bookingId: string): Promise<Booking> {
  if (!bookingId) throw new Error('Booking ID is required');

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: Authentication required to accept donation');
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    throw new Error('Forbidden: Only institutional asset owners or administrators can accept a donation request');
  }

  // Primary execution: Atomic single-transaction RPC
  const { data, error } = await supabase.rpc('accept_donation', {
    p_booking_id: bookingId,
  });

  if (!error && data) {
    return data as Booking;
  }

  // Explicitly detect if Migration 004 RPC has not yet been deployed to target database
  if (
    error &&
    (error.code === '42883' ||
      error.message?.includes('accept_donation') ||
      error.message?.includes('does not exist') ||
      error.code === 'PGRST202')
  ) {
    throw new Error(
      'Database Migration 004 is required for atomic donation transfers: public.accept_donation RPC is not deployed in Supabase.'
    );
  }

  console.error('[acceptDonation] RPC error:', error?.message);
  throw new Error(error?.message || 'Failed to accept donation');
}

/**
 * Rejects a donation claim request with a mandatory explanation.
 */
export async function rejectDonation(bookingId: string, reason: string): Promise<Booking> {
  return rejectBooking(bookingId, reason);
}

/**
 * Lists incoming claim requests for surplus equipment owned by the user (or all if admin).
 */
export async function listDonationClaims(ownerId?: string): Promise<Booking[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  let query = supabase
    .from('bookings')
    .select(`
      *,
      resource:resources!inner(id, title, category, location, owner_id, organization:organizations(name), availability_info),
      requester:profiles!bookings_requester_id_fkey(id, full_name, email, organization:organizations(name))
    `)
    .filter('purpose', 'like', '[DONATION_CLAIM]%')
    .order('created_at', { ascending: false });

  if (profile.role !== 'admin') {
    const targetOwner = ownerId || profile.id;
    query = query.eq('resource.owner_id', targetOwner);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[listDonationClaims] Error:', error.message);
    return [];
  }

  return (data as Booking[]) || [];
}
