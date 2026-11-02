/**
 * ResourceLoop - Smart Institutional Resource Sharing Network
 * Frontend Data Contract & Domain TypeScript Definitions
 * 
 * Strict boundary: Provides strongly typed interfaces for Supabase data models,
 * DTOs for mutations, and domain status unions to ensure seamless frontend-backend integration.
 */

// ==============================================================================
// 1. ENUMS & UNION TYPES
// ==============================================================================

/**
 * Access control roles within ResourceLoop
 */
export type UserRole = 'seeker' | 'owner' | 'admin';

/**
 * Institutional classification
 */
export type OrganizationType = 
  | 'university' 
  | 'research_lab' 
  | 'institute' 
  | 'department' 
  | 'other';

/**
 * Institutional verification lifecycle status
 */
export type OrganizationVerificationStatus = 'pending' | 'verified' | 'rejected';

/**
 * Classification of shared institutional resources
 */
export type ResourceType = 'equipment' | 'space';

/**
 * Operational availability status of a resource
 */
export type ResourceStatus = 'available' | 'unavailable' | 'maintenance';

/**
 * Booking lifecycle status transitions
 */
export type BookingStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'checked_in'
  | 'returned'
  | 'cancelled'
  | 'overdue';

/**
 * Inspection report stage
 */
export type ConditionReportType = 'before' | 'after';

/**
 * Physical and operational health of resource upon inspection
 */
export type ConditionStatus = 
  | 'excellent' 
  | 'good' 
  | 'fair' 
  | 'damaged' 
  | 'faulty';

/**
 * Categories of incidents logged against reservations
 */
export type IncidentType = 
  | 'damage' 
  | 'loss' 
  | 'late_return' 
  | 'misuse' 
  | 'safety_hazard' 
  | 'other';

/**
 * Resolution lifecycle of an incident
 */
export type IncidentStatus = 
  | 'open' 
  | 'investigating' 
  | 'resolved' 
  | 'closed';

// ==============================================================================
// 2. DOMAIN ENTITY INTERFACES
// ==============================================================================

/**
 * Participating institution or research organization
 */
export interface Organization {
  id: string;
  name: string;
  organization_type: OrganizationType;
  description: string | null;
  address: string | null;
  verification_status: OrganizationVerificationStatus;
  created_at: string;
  updated_at: string;
}

/**
 * User profile linked to Supabase auth.users
 */
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  organization_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  // Optional expanded relation
  organization?: Organization | null;
}

/**
 * Availability schedule metadata stored in JSONB
 */
export interface ResourceAvailabilityInfo {
  days: string[];
  hours: string;
  slot_duration_minutes?: number;
  maintenance_blackouts?: Array<{
    start: string;
    end: string;
    reason: string;
  }>;
  is_donation?: boolean;
  condition_status?: ConditionStatus;
  estimated_value?: number;
  transfer_terms?: string;
}

/**
 * Institutional resource available for reservation
 */
export interface Resource {
  id: string;
  owner_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  category: string;
  resource_type: ResourceType;
  location: string;
  image_url: string | null;
  availability_info: ResourceAvailabilityInfo;
  eligibility_requirements: string | null;
  training_required: boolean;
  usage_limit_per_user: number;
  status: ResourceStatus;
  created_at: string;
  updated_at: string;
  // Optional expanded relations
  owner?: Profile;
  organization?: Organization;
}

/**
 * Booking request and confirmed reservation
 */
export interface Booking {
  id: string;
  resource_id: string;
  requester_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  status: BookingStatus;
  approved_by: string | null;
  rejection_reason: string | null;
  waitlist_position?: number | null;
  created_at: string;
  updated_at: string;
  // Optional expanded relations
  resource?: Resource;
  requester?: Profile;
  approver?: Profile | null;
  condition_reports?: ConditionReport[];
  incidents?: Incident[];
}

/**
 * Pre-usage and post-return condition verification report
 */
export interface ConditionReport {
  id: string;
  booking_id: string;
  submitted_by: string;
  report_type: ConditionReportType;
  condition_status: ConditionStatus;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  // Optional expanded relations
  submitter?: Profile;
  booking?: Booking;
}

/**
 * Formal incident report logged against a booking or piece of equipment
 */
export interface Incident {
  id: string;
  booking_id: string | null;
  reported_by: string;
  incident_type: IncidentType;
  description: string;
  status: IncidentStatus;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  // Optional expanded relations
  reporter?: Profile;
  booking?: Booking | null;
}

/**
 * User notification for booking updates, requests, and warnings
 */
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

/**
 * Immutable administrative and compliance audit log
 */
export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  // Optional expanded relation
  actor?: Profile | null;
}

// ==============================================================================
// 3. FRONTEND DATA TRANSFER OBJECTS (DTOs)
// ==============================================================================

export interface CreateBookingDTO {
  resource_id: string;
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
  purpose: string;
}

export interface UpdateBookingStatusDTO {
  status: BookingStatus;
  rejection_reason?: string;
  approved_by?: string;
}

export interface CreateResourceDTO {
  organization_id: string;
  title: string;
  description?: string;
  category: string;
  resource_type: ResourceType;
  location: string;
  image_url?: string;
  availability_info?: ResourceAvailabilityInfo;
  eligibility_requirements?: string;
  training_required?: boolean;
  usage_limit_per_user?: number;
  status?: ResourceStatus;
}

export interface UpdateResourceDTO extends Partial<CreateResourceDTO> {
  status?: ResourceStatus;
}

export interface CreateConditionReportDTO {
  booking_id: string;
  report_type: ConditionReportType;
  condition_status: ConditionStatus;
  notes?: string;
  image_url?: string;
}

export interface CreateIncidentDTO {
  booking_id?: string;
  incident_type: IncidentType;
  description: string;
}

export interface ResolveIncidentDTO {
  status: IncidentStatus;
  resolution_notes: string;
}

export interface UpdateProfileDTO {
  full_name?: string;
  avatar_url?: string;
  organization_id?: string;
}

/**
 * Filter and search criteria for resource catalogue queries
 */
export interface ResourceFilters {
  query?: string;
  search?: string;
  category?: string;
  resource_type?: ResourceType;
  resourceType?: ResourceType | 'all';
  organization_id?: string;
  organizationId?: string;
  status?: ResourceStatus | 'all';
  available_only?: boolean;
  training_required?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Detailed eligibility assessment response
 */
export interface ResourceEligibilityResult {
  eligible: boolean;
  reasons: string[];
  checks: {
    isActive: boolean;
    isAvailable: boolean;
    trainingRequired: boolean;
    hasOrganizationAffiliation: boolean;
  };
}

/**
 * QR Access Pass response carrying opaque high-entropy token
 */
export interface BookingPassResponse {
  booking_id: string;
  token_type: 'check_in' | 'check_out';
  token: string;
  raw_token: string;
  expires_at: string;
}

/**
 * Inspection handshake payload for check-in and check-out
 */
export interface VerifyHandshakeDTO {
  raw_token: string;
  condition_status: ConditionStatus;
  condition_notes?: string;
  image_url?: string;
}

/**
 * Query criteria for listing bookings
 */
export interface BookingFilters {
  status?: BookingStatus | 'all';
  resource_id?: string;
  requester_id?: string;
  limit?: number;
  offset?: number;
}

// ==============================================================================
// 4. DONATION & SURPLUS EQUIPMENT TYPES
// ==============================================================================

export interface CreateDonationDTO {
  organization_id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  image_url?: string;
  condition_status: ConditionStatus;
  estimated_value?: number;
  transfer_terms?: string;
}

export interface RequestDonationDTO {
  resource_id: string;
  purpose: string;
  intended_use?: string;
}

// ==============================================================================
// 5. INCIDENT & PENALTY HUMAN REVIEW TYPES
// ==============================================================================

export type PenaltyAction = 
  | 'waived' 
  | 'warning' 
  | 'penalty_applied' 
  | 'restitution_required' 
  | 'privilege_suspended';

export interface IncidentFilters {
  status?: IncidentStatus | 'all';
  incident_type?: IncidentType | 'all';
  booking_id?: string;
  reported_by?: string;
  limit?: number;
  offset?: number;
}

export interface ReviewPenaltyDTO {
  incident_id: string;
  action: PenaltyAction;
  status: IncidentStatus;
  resolution_notes: string;
  penalty_amount?: number;
}

// ==============================================================================
// 6. AUDIT & IMPACT ANALYTICS TYPES
// ==============================================================================

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface ImpactMetrics {
  total_completed_bookings: number;
  total_booking_hours: number;
  total_active_resources: number;
  total_participating_orgs: number;
  estimated_capex_avoidance_usd: number;
  estimated_co2_avoidance_kg: number;
  generated_at: string;
}

export interface ResourceHistory {
  resource: Resource;
  total_bookings: number;
  completed_bookings: number;
  incidents_count: number;
  bookings: Booking[];
  condition_reports: ConditionReport[];
  incidents: Incident[];
}

export interface UserHistory {
  profile: Profile;
  total_reservations: number;
  completed_reservations: number;
  incidents_logged: number;
  bookings: Booking[];
  notifications: Notification[];
}


// ==============================================================================
// 7. ORGANIZATION MEMBERSHIP REQUEST
// ==============================================================================

/**
 * Status of a user's request to join an organization.
 */
export type MembershipRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * A request made by a user to be affiliated with an organization.
 * Backend table: organization_membership_requests
 */
export interface OrganizationMembershipRequest {
  id: string;
  user_id: string;
  organization_id: string;
  status: MembershipRequestStatus;
  created_at: string;
  updated_at: string;
  // Optional expanded relations (joined from Supabase)
  user?: Pick<Profile, 'id' | 'full_name' | 'email'>;
  organization?: Pick<Organization, 'id' | 'name' | 'organization_type'>;
}
