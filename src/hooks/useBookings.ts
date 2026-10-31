import { supabase } from '@/lib/supabase'
import type { Booking, CreateBookingDTO } from '@/types/domain'
import {
  requestBooking as rpcRequestBooking,
  approveBooking as rpcApproveBooking,
  rejectBooking as rpcRejectBooking,
  cancelBooking as rpcCancelBooking,
  fetchUserBookings as serviceFetchUserBookings,
  fetchOwnerBookings as serviceFetchOwnerBookings,
} from '@/services/bookings'

/**
 * Fetch all bookings created by a specific seeker.
 */
export async function fetchUserBookings(userId: string): Promise<Booking[]> {
  return serviceFetchUserBookings(userId)
}

/**
 * Fetch all bookings for resources managed by an owner.
 */
export async function fetchOwnerBookings(ownerId: string): Promise<Booking[]> {
  return serviceFetchOwnerBookings(ownerId)
}

/**
 * Submit a booking request via the Stage 3 RPC endpoint.
 */
export async function requestBooking(dto: CreateBookingDTO): Promise<Booking> {
  return rpcRequestBooking(dto)
}

/**
 * Approve or reject a booking (Owner action) via Stage 3 RPC endpoints.
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<Booking> {
  if (newStatus === 'approved') {
    return rpcApproveBooking(bookingId)
  } else {
    return rpcRejectBooking(bookingId, rejectionReason || 'Declined by custodian')
  }
}

/**
 * Cancel a pending booking (Requester action) via Stage 3 RPC endpoint.
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  await rpcCancelBooking(bookingId)
}
