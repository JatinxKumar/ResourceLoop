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
import { requestBooking, approveBooking, rejectBooking, getBookingById } from './bookings';

/**
 * Creates a donation / surplus asset listing for permanent transfer.
 * Restricted to verified owners or platform administrators.
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

  // Set a standard 14-day transfer window for the donation allocation request
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

  return booking;
}

/**
 * Accepts a donation transfer request.
 * Approves the booking and marks the resource as unavailable to conclude the donation lifecycle.
 */
export async function acceptDonation(bookingId: string): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  // Approve through the core engine
  const approved = await approveBooking(bookingId);

  // Mark the resource as unavailable / completed transfer so it leaves the active catalogue
  await supabase
    .from('resources')
    .update({ status: 'unavailable', updated_at: new Date().toISOString() })
    .eq('id', booking.resource_id);

  // Insert audit record
  const profile = await getCurrentProfile();
  await supabase.from('audit_logs').insert({
    actor_id: profile?.id || null,
    action: 'DONATION_TRANSFER_ACCEPTED',
    entity_type: 'resource',
    entity_id: booking.resource_id,
    details: {
      booking_id: bookingId,
      recipient_id: booking.requester_id,
      accepted_at: new Date().toISOString(),
    },
  });

  return approved;
}

/**
 * Rejects a donation claim request with a mandatory explanation.
 */
export async function rejectDonation(bookingId: string, reason: string): Promise<Booking> {
  return rejectBooking(bookingId, reason);
}
