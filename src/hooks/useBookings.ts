import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Booking, CreateBookingDTO, BookingStatus } from '@/types/domain'

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

/**
 * Approve or reject a booking (Owner action).
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<Booking> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated.')

  const payload: Record<string, unknown> = {
    status: newStatus,
    approved_by: newStatus === 'approved' ? user.id : null,
  }

  if (rejectionReason) {
    payload.rejection_reason = rejectionReason.trim()
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', bookingId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update booking status:', error.message)
    throw error
  }

  return data as Booking
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
