import type {
  Booking,
  CreateBookingDTO,
  BookingPassResponse,
  VerifyHandshakeDTO,
  ConditionStatus,
} from '@/types/domain'
import {
  requestBooking as serviceRequestBooking,
  approveBooking as serviceApproveBooking,
  rejectBooking as serviceRejectBooking,
  waitlistBooking as serviceWaitlistBooking,
  cancelBooking as serviceCancelBooking,
  generateBookingPass as serviceGenerateBookingPass,
  verifyCheckIn as serviceVerifyCheckIn,
  verifyCheckOut as serviceVerifyCheckOut,
  fetchUserBookings as serviceFetchUserBookings,
  fetchOwnerBookings as serviceFetchOwnerBookings,
  getBookingById as serviceGetBookingById,
  markOverdueBookings as serviceMarkOverdueBookings,
} from '@/services/bookings'

export type PassTokenType = 'check_in' | 'check_out'
export type { BookingPassResponse }

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
 * Direct table inserts on public.bookings are revoked.
 */
export async function requestBooking(dto: CreateBookingDTO): Promise<Booking> {
  return serviceRequestBooking(dto)
}

/**
 * Approve a pending or waitlisted booking (Owner/Admin action) via Stage 3 RPC.
 */
export async function approveBooking(bookingId: string): Promise<Booking> {
  return serviceApproveBooking(bookingId)
}

/**
 * Reject a pending booking via Stage 3 RPC `reject_booking`.
 */
export async function rejectBooking(
  bookingId: string,
  rejectionReason: string
): Promise<Booking> {
  return serviceRejectBooking(bookingId, rejectionReason)
}

/**
 * Convenience helper: Approve or reject a booking (Owner action) via Stage 3 RPC endpoints.
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<Booking> {
  if (newStatus === 'approved') {
    return serviceApproveBooking(bookingId)
  } else {
    return serviceRejectBooking(bookingId, rejectionReason || 'Declined by custodian')
  }
}

/**
 * Move a pending booking to the deterministic FIFO waitlist queue via RPC.
 */
export async function waitlistBooking(bookingId: string): Promise<Booking> {
  return serviceWaitlistBooking(bookingId)
}

/**
 * Cancel a pending booking (Requester action) via Stage 3 RPC endpoint.
 */
export async function cancelBooking(bookingId: string): Promise<Booking> {
  return serviceCancelBooking(bookingId)
}

/**
 * Generate a single-use high-entropy access pass via Stage 3 RPC `generate_booking_pass`.
 * Strictly restricted to booking requester (seeker).
 * Returns both `token` and `raw_token` with ISO expiration.
 */
export async function generateBookingPass(
  bookingId: string,
  tokenType: PassTokenType = 'check_in'
): Promise<BookingPassResponse> {
  return serviceGenerateBookingPass(bookingId, tokenType)
}

/**
 * Physical QR Check-In Handshake:
 * Authenticated Owner/Custodian scans seeker's displayed token, inspects asset,
 * and completes verification. Returns the full updated Booking row.
 */
export async function verifyCheckIn(
  rawToken: string,
  conditionStatus: ConditionStatus = 'good',
  conditionNotes?: string,
  imageUrl?: string
): Promise<Booking> {
  return serviceVerifyCheckIn({
    raw_token: rawToken,
    condition_status: conditionStatus,
    condition_notes: conditionNotes,
    image_url: imageUrl,
  })
}

/**
 * Physical QR Return / Check-Out Handshake:
 * Authenticated Owner/Custodian scans return token, inspects asset post-session,
 * and completes return. If damaged or faulty, opens an incident automatically.
 * Returns the full updated Booking row.
 */
export async function verifyCheckOut(
  rawToken: string,
  conditionStatus: ConditionStatus = 'good',
  conditionNotes?: string,
  imageUrl?: string
): Promise<Booking> {
  return serviceVerifyCheckOut({
    raw_token: rawToken,
    condition_status: conditionStatus,
    condition_notes: conditionNotes,
    image_url: imageUrl,
  })
}

/**
 * Retrieves a single booking by ID with full joins.
 */
export async function getBookingById(bookingId: string): Promise<Booking | null> {
  return serviceGetBookingById(bookingId)
}

/**
 * Maintenance check: sweeps all checked_in bookings past end_time to overdue.
 */
export async function markOverdueBookings(): Promise<number> {
  return serviceMarkOverdueBookings()
}
