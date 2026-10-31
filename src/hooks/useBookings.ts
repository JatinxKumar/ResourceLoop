import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Booking, CreateBookingDTO, BookingStatus, ConditionStatus } from '@/types/domain'

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
 * Approve a pending booking via backend RPC.
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
 * Reject a pending booking via backend RPC.
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
 * Verify a check-in token and transition booking to checked_in.
 * Condition report data is passed atomically with the check-in.
 */
export async function verifyCheckIn(
  token: string,
  conditionStatus?: ConditionStatus,
  conditionNotes?: string
): Promise<{ booking_id: string; status: string }> {
  const { data, error } = await supabase.rpc('verify_check_in', {
    p_token: token,
    p_condition_status: conditionStatus || null,
    p_condition_notes: conditionNotes || null,
  })

  if (error) {
    console.error('verify_check_in RPC failed:', error.message)
    throw new Error(error.message || 'Check-in verification failed.')
  }

  return data as { booking_id: string; status: string }
}

/**
 * Verify a check-out / return token and transition booking to returned.
 * Condition report data is passed atomically with the check-out.
 */
export async function verifyCheckOut(
  token: string,
  conditionStatus?: ConditionStatus,
  conditionNotes?: string
): Promise<{ booking_id: string; status: string }> {
  const { data, error } = await supabase.rpc('verify_check_out', {
    p_token: token,
    p_condition_status: conditionStatus || null,
    p_condition_notes: conditionNotes || null,
  })

  if (error) {
    console.error('verify_check_out RPC failed:', error.message)
    throw new Error(error.message || 'Check-out verification failed.')
  }

  return data as { booking_id: string; status: string }
}

/**
 * Generate a custody pass token for an approved booking.
 * Returns an opaque token to be rendered as a QR code.
 */
export async function generateCustodyToken(
  bookingId: string
): Promise<{ token: string; expires_at: string }> {
  const { data, error } = await supabase.rpc('generate_custody_token', {
    p_booking_id: bookingId,
  })

  if (error) {
    console.error('generate_custody_token RPC failed:', error.message)
    throw new Error(error.message || 'Failed to generate custody token.')
  }

  return data as { token: string; expires_at: string }
}

/**
 * Cancel a pending booking (Requester action).
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) {
    console.error('Failed to cancel booking:', error.message)
    throw error
  }
}
