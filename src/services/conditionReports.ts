/**
 * ResourceLoop - Condition Inspection Reports Service
 * Handles pre-session and post-return asset condition assessments,
 * photographic evidence, and health tracking.
 */

import { supabase } from '../lib/supabase';
import type {
  ConditionReport,
  CreateConditionReportDTO,
} from '../types/domain';
import { getCurrentProfile } from './profiles';

/**
 * Retrieves all condition inspection reports linked to a booking.
 */
export async function getConditionReportsByBooking(bookingId: string): Promise<ConditionReport[]> {
  if (!bookingId) throw new Error('Booking ID is required');

  const { data, error } = await supabase
    .from('condition_reports')
    .select(`
      *,
      submitter:profiles(id, full_name, email, avatar_url)
    `)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`[getConditionReportsByBooking] Error for ${bookingId}:`, error.message);
    throw new Error(`Failed to retrieve condition reports: ${error.message}`);
  }

  return (data as ConditionReport[]) || [];
}

/**
 * Submits an independent condition report for a booking.
 * Note: Check-in and check-out handshakes automatically log condition reports
 * via verify_check_in and verify_check_out RPCs.
 */
export async function createConditionReport(
  dto: CreateConditionReportDTO
): Promise<ConditionReport> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: Authentication required to file a condition report');
  }

  const payload = {
    booking_id: dto.booking_id,
    submitted_by: profile.id,
    report_type: dto.report_type,
    condition_status: dto.condition_status,
    notes: dto.notes?.trim() || null,
    image_url: dto.image_url?.trim() || null,
  };

  const { data, error } = await supabase
    .from('condition_reports')
    .insert(payload)
    .select(`
      *,
      submitter:profiles(id, full_name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('[createConditionReport] Insert error:', error.message);
    throw new Error(`Failed to submit condition report: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'CONDITION_REPORT_SUBMITTED',
    entity_type: 'condition_report',
    entity_id: data.id,
    details: {
      booking_id: dto.booking_id,
      report_type: dto.report_type,
      condition_status: dto.condition_status,
    },
  });

  return data as ConditionReport;
}

