import { supabase } from '@/lib/supabase'
import type { Booking, CreateBookingDTO, ConditionStatus } from '@/types/domain'

export type PassTokenType = 'check_in' | 'check_out'

export interface BookingPassResponse {
  token: string
  token_type: PassTokenType
  expires_at?: string
  booking_id?: string
  [key: string]: unknown
}

export interface VerificationResult {
  booking_id: string
  status: string
  [key: string]: unknown
}

/**
 * Fetch all bookings created by a specific seeker.
 */
export async function fetchUserBookings(userId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      resource:resources(
        *,
        organization:organizations(*),
        owner:profiles(id, full_name, email)
      ),
      condition_reports(*)
    `)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user bookings:', error.message)
    throw error
  }

  return (data || []) as Booking[]
}

/**
 * Fetch all bookings for resources managed by an owner.
 */
export async function fetchOwnerBookings(ownerId: string): Promise<Booking[]> {
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
        organization:organizations(*)
      ),
      condition_reports(*)
    `)
    .eq('resource.owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching owner bookings:', error.message)
    throw error
  }

  return (data || []) as Booking[]
}

/**
 * Submit a real booking request.
 */
export async function requestBooking(dto: CreateBookingDTO): Promise<Booking> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to submit a reservation request.')

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      resource_id: dto.resource_id,
      requester_id: user.id,
      start_time: dto.start_time,
      end_time: dto.end_time,
      purpose: dto.purpose.trim(),
      status: 'pending'
    })
    .select(`
      *,
      resource:resources(title, category, location)
    `)
    .single()

  if (error) {
    console.error('Booking creation failed:', error.message)
    throw error
  }

  return data as Booking
}

// =============================================================================
// RPC-based booking operations (per approved backend contract)
// =============================================================================

/**
 * Approve a pending booking via backend RPC `approve_booking`.
 * The RPC enforces ownership, status-guard, and audit logging.
 */
export async function approveBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_booking', {
    p_booking_id: bookingId,
  })

  if (error) {
    console.error('approve_booking RPC failed:', error.message)
    throw new Error(error.message || 'Failed to approve booking.')
  }
}

/**
 * Reject a pending booking via backend RPC `reject_booking`.
 * The RPC enforces ownership, status-guard, and audit logging.
 */
export async function rejectBooking(
  bookingId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('reject_booking', {
    p_booking_id: bookingId,
    p_reason: reason.trim(),
  })

  if (error) {
    console.error('reject_booking RPC failed:', error.message)
    throw new Error(error.message || 'Failed to reject booking.')
  }
}

/**
 * Generate a booking pass via backend RPC `generate_booking_pass`.
 * Arguments:
 * - p_booking_id: UUID
 * - p_token_type: 'check_in' | 'check_out'
 *
 * Matches the backend response shape whether returned as JSON or string.
 */
export async function generateBookingPass(
  bookingId: string,
  tokenType: PassTokenType = 'check_in'
): Promise<BookingPassResponse> {
  const { data, error } = await supabase.rpc('generate_booking_pass', {
    p_booking_id: bookingId,
    p_token_type: tokenType,
  })

  if (error) {
    console.error('generate_booking_pass RPC failed:', error.message)
    throw new Error(error.message || 'Failed to generate booking pass.')
  }

  // Handle bare string if returned
  if (typeof data === 'string') {
    return {
      token: data,
      token_type: tokenType,
    }
  }

  // Handle JSON object returned by backend RPC
  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    const token =
      (typeof raw.token === 'string' && raw.token) ||
      (typeof raw.pass_token === 'string' && raw.pass_token) ||
      (typeof raw.pass === 'string' && raw.pass) ||
      (typeof raw.qr_code === 'string' && raw.qr_code) ||
      JSON.stringify(raw)

    const expires_at =
      typeof raw.expires_at === 'string'
        ? raw.expires_at
        : typeof raw.expiresAt === 'string'
        ? raw.expiresAt
        : undefined

    const retTokenType =
      raw.token_type === 'check_in' || raw.token_type === 'check_out'
        ? (raw.token_type as PassTokenType)
        : tokenType

    return {
      token,
      token_type: retTokenType,
      expires_at,
      booking_id: typeof raw.booking_id === 'string' ? raw.booking_id : bookingId,
      ...raw,
    }
  }

  throw new Error('Invalid response received from generate_booking_pass.')
}

/**
 * Verify a check-in token and transition booking to checked_in via `verify_check_in`.
 * Condition report data is passed atomically with the check-in.
 */
export async function verifyCheckIn(
  token: string,
  conditionStatus?: ConditionStatus,
  conditionNotes?: string
): Promise<VerificationResult> {
  const { data, error } = await supabase.rpc('verify_check_in', {
    p_token: token,
    p_condition_status: conditionStatus || null,
    p_condition_notes: conditionNotes || null,
  })

  if (error) {
    console.error('verify_check_in RPC failed:', error.message)
    throw new Error(error.message || 'Check-in verification failed.')
  }

  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    return {
      booking_id: (raw.booking_id as string) || (raw.id as string) || '',
      status: (raw.status as string) || 'checked_in',
      ...raw,
    }
  }

  return {
    booking_id: typeof data === 'string' ? data : '',
    status: 'checked_in',
  }
}

/**
 * Verify a check-out / return token and transition booking to returned via `verify_check_out`.
 * Condition report data is passed atomically with the check-out.
 */
export async function verifyCheckOut(
  token: string,
  conditionStatus?: ConditionStatus,
  conditionNotes?: string
): Promise<VerificationResult> {
  const { data, error } = await supabase.rpc('verify_check_out', {
    p_token: token,
    p_condition_status: conditionStatus || null,
    p_condition_notes: conditionNotes || null,
  })

  if (error) {
    console.error('verify_check_out RPC failed:', error.message)
    throw new Error(error.message || 'Check-out verification failed.')
  }

  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    return {
      booking_id: (raw.booking_id as string) || (raw.id as string) || '',
      status: (raw.status as string) || 'returned',
      ...raw,
    }
  }

  return {
    booking_id: typeof data === 'string' ? data : '',
    status: 'returned',
  }
}

/**
 * Cancel a booking via backend RPC `cancel_booking`.
 * Enforces requester ownership, state transition guard, and audit logging.
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
  })

  if (error) {
    console.error('cancel_booking RPC failed:', error.message)
    throw new Error(error.message || 'Failed to cancel reservation.')
  }
}
