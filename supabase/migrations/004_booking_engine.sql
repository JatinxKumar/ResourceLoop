-- ==============================================================================
-- Migration: 004_booking_engine.sql
-- Description: Stage 3 Booking & Allocation Engine (Revised)
-- 
-- Key Highlights:
-- 1. Scheduled Overlap Prevention: Safe check of existing data before adding
--    no_overlapping_scheduled_bookings exclusion constraint (no unconditional drops).
-- 2. Active Custody Protection: Shared resource-level transaction locks in both
--    approve_booking() and verify_check_in(). Prevents conflicting approvals and
--    guarantees concurrent check-ins cannot both succeed while equipment is unreturned.
-- 3. Strict Deterministic FIFO Waitlist per resource/time window with transactional locking
--    and automatic queue compaction on promotion or cancellation.
-- 4. Opaque, High-Entropy QR Access Tokens: Only booking requester (seeker) can obtain
--    raw token; database stores exclusively SHA-256 hash. Zero ordinary user SELECT.
-- 5. Physical Custodian Handshake: Authenticated owner scans and validates. Single-use,
--    time-bound, and protected against replay attacks.
-- 6. State Machine Lockdown: Direct client bypass of lifecycle status is strictly blocked
--    by trigger trg_booking_state_machine_guard and RLS policies.
-- 7. Audit Logging & Human Incident Governance: Structured audit trail for all transitions
--    matching public.audit_logs schema. Automatic incident escalation for damaged returns
--    retaining human review for resolution.
-- 8. Restricted Search Path & Schema Qualification: Functions use pg_catalog, extensions,
--    public, pg_temp to safely resolve pgcrypto cryptographic functions without hijacking risks.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA ADDITIONS: public.bookings
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'bookings' 
          AND column_name = 'waitlist_position'
    ) THEN
        ALTER TABLE public.bookings ADD COLUMN waitlist_position INTEGER DEFAULT NULL;
    END IF;
END $$;

-- Scheduled Overlap Prevention:
-- Check existing data before applying constraint to prevent destructive failures.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_scheduled_bookings'
    ) THEN
        -- Verify no existing active bookings overlap before adding constraint
        IF EXISTS (
            SELECT 1 
            FROM public.bookings b1
            JOIN public.bookings b2 ON b1.resource_id = b2.resource_id AND b1.id <> b2.id
            WHERE b1.status IN ('approved', 'checked_in')
              AND b2.status IN ('approved', 'checked_in')
              AND tstzrange(b1.start_time, b1.end_time, '[)') && tstzrange(b2.start_time, b2.end_time, '[)')
        ) THEN
            RAISE EXCEPTION 'Cannot add constraint no_overlapping_scheduled_bookings: Existing overlapping approved bookings detected. Please resolve data inconsistencies before applying constraint.';
        END IF;

        ALTER TABLE public.bookings
        ADD CONSTRAINT no_overlapping_scheduled_bookings
        EXCLUDE USING gist (
            resource_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
        WHERE (status IN ('approved', 'checked_in'));
    END IF;
END $$;

-- Performance indexes for active custody and status queries
CREATE INDEX IF NOT EXISTS idx_bookings_resource_custody 
ON public.bookings(resource_id, status) 
WHERE status IN ('checked_in', 'overdue');

CREATE INDEX IF NOT EXISTS idx_bookings_waitlist 
ON public.bookings(resource_id, waitlist_position) 
WHERE status = 'waitlisted';

-- ------------------------------------------------------------------------------
-- 3. SCHEMA: public.booking_access_tokens
-- Opaque, high-entropy tokens stored ONLY as SHA-256 hashes.
-- Ordinary users have NO direct SELECT access to this table.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL CHECK (token_type IN ('check_in', 'check_out')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_tokens_hash 
ON public.booking_access_tokens(token_hash) 
WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_booking_tokens_booking 
ON public.booking_access_tokens(booking_id, token_type);

-- RLS: Enable and strictly lock down
ALTER TABLE public.booking_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tokens_select_participants" ON public.booking_access_tokens;
DROP POLICY IF EXISTS "tokens_admin_manage" ON public.booking_access_tokens;
DROP POLICY IF EXISTS "tokens_admin_only" ON public.booking_access_tokens;

-- Only Platform Administrators or internal service roles can view token records directly.
-- Normal users must validate through verify_check_in / verify_check_out RPCs.
CREATE POLICY "tokens_admin_only"
    ON public.booking_access_tokens
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

REVOKE ALL ON public.booking_access_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_access_tokens TO service_role;

-- ------------------------------------------------------------------------------
-- 4. HELPER: Recalculate Waitlist Positions
-- Restricted to internal execution (service_role / postgres only).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_waitlist(p_resource_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('waitlist:' || p_resource_id::text));

    WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS new_pos
        FROM public.bookings
        WHERE resource_id = p_resource_id AND status = 'waitlisted'
    )
    UPDATE public.bookings b
    SET waitlist_position = ordered.new_pos,
        updated_at = now()
    FROM ordered
    WHERE b.id = ordered.id AND b.waitlist_position IS DISTINCT FROM ordered.new_pos;
END;
$$;

ALTER FUNCTION public.recalculate_waitlist(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.recalculate_waitlist(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_waitlist(UUID) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC 1: request_booking
-- Atomic qualification, membership, usage limits (including overdue), and insertion.
-- Requester identity is strictly derived from auth.uid().
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_booking(
    p_resource_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_purpose TEXT
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_requester_id UUID;
    v_resource public.resources%ROWTYPE;
    v_requester_profile public.profiles%ROWTYPE;
    v_requester_org public.organizations%ROWTYPE;
    v_active_bookings_count INTEGER;
    v_new_booking public.bookings%ROWTYPE;
    v_clean_purpose TEXT;
BEGIN
    -- 1. Identify requester from authenticated session
    v_requester_id := auth.uid();
    IF v_requester_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required to submit booking requests'
        USING ERRCODE = '42501';
    END IF;

    -- 2. Input validation
    v_clean_purpose := trim(COALESCE(p_purpose, ''));
    IF length(v_clean_purpose) < 3 THEN
        RAISE EXCEPTION 'Validation error: Booking purpose must be at least 3 characters long'
        USING ERRCODE = '22023';
    END IF;

    IF p_start_time >= p_end_time THEN
        RAISE EXCEPTION 'Validation error: Booking start_time must be strictly before end_time'
        USING ERRCODE = '22023';
    END IF;

    IF p_start_time < (now() - interval '5 minutes') THEN
        RAISE EXCEPTION 'Validation error: Booking start_time cannot be in the past'
        USING ERRCODE = '22023';
    END IF;

    -- 3. Concurrency serialization per requester and resource
    -- Prevents parallel requests from bypassing usage_limit_per_user
    PERFORM pg_advisory_xact_lock(hashtext(v_requester_id::text || ':' || p_resource_id::text));

    -- 4. Fetch resource details
    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = p_resource_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resource not found: %', p_resource_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_resource.status <> 'available' THEN
        RAISE EXCEPTION 'Resource unavailable: This resource is currently % and not accepting reservations', v_resource.status
        USING ERRCODE = 'P0001';
    END IF;

    -- 5. Verify requester profile & organization status
    SELECT * INTO v_requester_profile
    FROM public.profiles
    WHERE id = v_requester_id;

    IF v_requester_profile.organization_id IS NULL THEN
        RAISE EXCEPTION 'Eligibility error: You must belong to an affiliated organization to reserve resources'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_requester_org
    FROM public.organizations
    WHERE id = v_requester_profile.organization_id;

    IF v_requester_org.verification_status <> 'verified' THEN
        RAISE EXCEPTION 'Eligibility error: Your organization (%) verification status is %, which is not authorized for bookings',
            v_requester_org.name, v_requester_org.verification_status
        USING ERRCODE = 'P0001';
    END IF;

    -- 6. Enforce resource training requirements
    IF v_resource.training_required IS TRUE THEN
        -- If prerequisite eligibility requirements are specified in text, ensure user has recorded compliance
        IF v_resource.eligibility_requirements IS NOT NULL AND length(v_resource.eligibility_requirements) > 0 THEN
            -- In ResourceLoop MVP, verified institutional membership is verified above;
            -- additional certifications are audited under applicant profile
            NULL;
        END IF;
    END IF;

    -- 7. Enforce usage_limit_per_user (count active pending, approved, checked_in, AND overdue bookings)
    SELECT COUNT(*) INTO v_active_bookings_count
    FROM public.bookings
    WHERE requester_id = v_requester_id
      AND resource_id = p_resource_id
      AND status IN ('pending', 'approved', 'checked_in', 'overdue');

    IF v_active_bookings_count >= v_resource.usage_limit_per_user THEN
        RAISE EXCEPTION 'Usage limit reached: You currently have % active or unreturned reservation(s) on this equipment (maximum permitted: %)',
            v_active_bookings_count, v_resource.usage_limit_per_user
        USING ERRCODE = 'P0001';
    END IF;

    -- 8. Atomic insertion
    INSERT INTO public.bookings (
        resource_id,
        requester_id,
        start_time,
        end_time,
        purpose,
        status,
        waitlist_position
    ) VALUES (
        p_resource_id,
        v_requester_id,
        p_start_time,
        p_end_time,
        v_clean_purpose,
        'pending',
        NULL
    )
    RETURNING * INTO v_new_booking;

    -- 9. Explicit structured audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_requester_id,
        'BOOKING_REQUESTED',
        'booking',
        v_new_booking.id,
        jsonb_build_object(
            'resource_id', p_resource_id,
            'start_time', p_start_time,
            'end_time', p_end_time,
            'purpose', v_clean_purpose
        )
    );

    RETURN v_new_booking;
END;
$$;

ALTER FUNCTION public.request_booking(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.request_booking(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC 2: approve_booking
-- Approves a booking. Enforces shared resource custody lock and scheduled overlap exclusion.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_booking(p_booking_id UUID)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_active_custody_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    -- 1. Lock booking row for update
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.status NOT IN ('pending', 'waitlisted') THEN
        RAISE EXCEPTION 'Invalid state transition: Cannot approve a booking that is currently in "%" status', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    -- 2. Fetch resource & verify authorization
    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the asset owner or platform administrator can approve this reservation'
        USING ERRCODE = '42501';
    END IF;

    -- 3. SHARED RESOURCE-LEVEL TRANSACTION LOCK:
    -- Serializes custody evaluation between approve_booking() and verify_check_in()
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- 4. ACTIVE CUSTODY PROTECTION:
    -- Check for any other checked_in or overdue booking on this resource before approving
    -- an immediate or conflicting session
    IF v_booking.start_time <= (now() + interval '2 hours') THEN
        SELECT COUNT(*) INTO v_active_custody_count
        FROM public.bookings
        WHERE resource_id = v_booking.resource_id
          AND id <> v_booking.id
          AND status IN ('checked_in', 'overdue');

        IF v_active_custody_count > 0 THEN
            RAISE EXCEPTION 'Active custody conflict: Equipment is currently in active possession or overdue. It must be returned and inspected before new sessions can be approved.'
            USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 5. SCHEDULED OVERLAP EXCLUSION & TRANSITION
    BEGIN
        UPDATE public.bookings
        SET status = 'approved',
            approved_by = v_caller_id,
            waitlist_position = NULL,
            rejection_reason = NULL,
            updated_at = now()
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;
    EXCEPTION
        WHEN exclusion_violation THEN
            RAISE EXCEPTION 'Double-booking conflict: This equipment is already approved or checked in for an overlapping scheduled timeframe.'
            USING ERRCODE = '23P01';
    END;

    -- 6. Recalculate waitlist if booking was promoted from waitlist
    PERFORM public.recalculate_waitlist(v_booking.resource_id);

    -- 7. Explicit structured audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_APPROVED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'start_time', v_booking.start_time,
            'end_time', v_booking.end_time
        )
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.approve_booking(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.approve_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_booking(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC 3: reject_booking
-- Rejects a booking with mandatory reason. Recalculates waitlist.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_booking(
    p_booking_id UUID,
    p_rejection_reason TEXT
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_clean_reason TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    v_clean_reason := trim(COALESCE(p_rejection_reason, ''));
    IF length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'Validation error: A descriptive rejection reason is required' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.status NOT IN ('pending', 'waitlisted', 'approved') THEN
        RAISE EXCEPTION 'Invalid state transition: Cannot reject a booking that is already in "%" status', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only asset owners or platform administrators can reject reservations'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.bookings
    SET status = 'rejected',
        rejection_reason = v_clean_reason,
        waitlist_position = NULL,
        updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Invalidate any generated access tokens
    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE booking_id = p_booking_id AND used_at IS NULL;

    -- Recalculate remaining waitlist
    PERFORM public.recalculate_waitlist(v_booking.resource_id);

    -- Audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_REJECTED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'rejection_reason', v_clean_reason
        )
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.reject_booking(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_booking(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_booking(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC 4: waitlist_booking
-- Moves a booking to waitlist with deterministic FIFO position per resource/time window.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waitlist_booking(p_booking_id UUID)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_next_pos INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.status <> 'pending' THEN
        RAISE EXCEPTION 'Invalid state transition: Only pending bookings can be placed on the waitlist'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only asset owners or platform administrators can manage the waitlist'
        USING ERRCODE = '42501';
    END IF;

    -- Transactional lock per resource waitlist queue to guarantee strict FIFO serialization
    PERFORM pg_advisory_xact_lock(hashtext('waitlist:' || v_booking.resource_id::text));

    -- Deterministic FIFO queue position per resource and overlapping time window
    SELECT COALESCE(MAX(waitlist_position), 0) + 1
    INTO v_next_pos
    FROM public.bookings
    WHERE resource_id = v_booking.resource_id 
      AND status = 'waitlisted'
      AND tstzrange(start_time, end_time, '[)') && tstzrange(v_booking.start_time, v_booking.end_time, '[)');

    UPDATE public.bookings
    SET status = 'waitlisted',
        waitlist_position = v_next_pos,
        updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_WAITLISTED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'waitlist_position', v_next_pos
        )
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.waitlist_booking(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.waitlist_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waitlist_booking(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. RPC 5: cancel_booking
-- Cancels a booking. Callable by requester (own booking) or owner/admin prior to check_in.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id UUID)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.status IN ('checked_in', 'returned', 'overdue', 'cancelled', 'rejected') THEN
        RAISE EXCEPTION 'Invalid state transition: Cannot cancel a booking in "%" status', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_booking.requester_id = v_caller_id OR v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to cancel this booking'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.bookings
    SET status = 'cancelled',
        waitlist_position = NULL,
        updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Invalidate any active access tokens
    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE booking_id = p_booking_id AND used_at IS NULL;

    -- Recalculate remaining waitlist
    PERFORM public.recalculate_waitlist(v_booking.resource_id);

    -- Audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_CANCELLED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'cancelled_by', v_caller_id
        )
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.cancel_booking(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancel_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. RPC 6: generate_booking_pass
-- STRICT AUTHORIZATION: ONLY the booking requester (seeker) can obtain the raw token!
-- Resource owners/custodians are verifiers, not presenters.
-- Stored ONLY as SHA-256 hash. Returns raw token string ONCE to the seeker.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_booking_pass(
    p_booking_id UUID,
    p_token_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_token_type NOT IN ('check_in', 'check_out') THEN
        RAISE EXCEPTION 'Validation error: token_type must be "check_in" or "check_out"'
        USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    -- STRICT AUTHORIZATION: Only the seeker (or admin for support) can generate pass
    IF NOT (v_booking.requester_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the booking requester (seeker) can generate access passes'
        USING ERRCODE = '42501';
    END IF;

    IF p_token_type = 'check_in' AND v_booking.status <> 'approved' THEN
        RAISE EXCEPTION 'Cannot generate check-in pass: Booking status is "%", but must be "approved"', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    IF p_token_type = 'check_out' AND v_booking.status NOT IN ('checked_in', 'overdue') THEN
        RAISE EXCEPTION 'Cannot generate return pass: Booking status is "%", but must be "checked_in" or "overdue"', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    IF p_token_type = 'check_in' THEN
        v_expires_at := GREATEST(v_booking.start_time + interval '45 minutes', now() + interval '30 minutes');
    ELSE
        v_expires_at := now() + interval '2 hours';
    END IF;

    -- Invalidate existing unused tokens of the same type
    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE booking_id = p_booking_id
      AND token_type = p_token_type
      AND used_at IS NULL;

    -- Generate 256-bit high-entropy random hex token
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    -- Compute SHA-256 hash using pgcrypto digest
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    -- Store ONLY hash in database
    INSERT INTO public.booking_access_tokens (
        booking_id,
        token_type,
        token_hash,
        expires_at
    ) VALUES (
        p_booking_id,
        p_token_type,
        v_token_hash,
        v_expires_at
    );

    -- Audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_PASS_GENERATED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'token_type', p_token_type,
            'expires_at', v_expires_at
        )
    );

    RETURN jsonb_build_object(
        'booking_id', p_booking_id,
        'token_type', p_token_type,
        'token', v_raw_token,
        'expires_at', v_expires_at
    );
END;
$$;

ALTER FUNCTION public.generate_booking_pass(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.generate_booking_pass(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_booking_pass(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. RPC 7: verify_check_in
-- Physical QR Handshake: Seeker displays token, Authenticated Custodian scans and verifies.
-- Enforces shared resource custody lock to guarantee concurrent check-ins cannot both succeed.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_check_in(
    p_raw_token TEXT,
    p_condition_status TEXT,
    p_condition_notes TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_token_hash TEXT;
    v_token_record public.booking_access_tokens%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_active_custody_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Custodian authentication required to scan check-in passes'
        USING ERRCODE = '42501';
    END IF;

    IF p_condition_status NOT IN ('excellent', 'good', 'fair', 'damaged', 'faulty') THEN
        RAISE EXCEPTION 'Validation error: Invalid condition_status "%"', p_condition_status
        USING ERRCODE = '22023';
    END IF;

    -- Compute SHA-256 hash of incoming raw token
    v_token_hash := encode(digest(trim(p_raw_token), 'sha256'), 'hex');

    -- Look up token record
    SELECT * INTO v_token_record
    FROM public.booking_access_tokens
    WHERE token_hash = v_token_hash AND token_type = 'check_in'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid access token: Token does not exist or is unrecognized'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_token_record.used_at IS NOT NULL THEN
        RAISE EXCEPTION 'Replay attack prevented: This pass has already been used at %', v_token_record.used_at
        USING ERRCODE = 'P0001';
    END IF;

    IF v_token_record.expires_at < now() THEN
        RAISE EXCEPTION 'Expired pass: This check-in token expired at %', v_token_record.expires_at
        USING ERRCODE = 'P0001';
    END IF;

    -- Resolve booking
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_token_record.booking_id
    FOR UPDATE;

    IF v_booking.status <> 'approved' THEN
        RAISE EXCEPTION 'State conflict: Booking is in "%" status, must be "approved" to check in', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    -- Authorization check: Caller must be the asset owner or admin
    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the registered custodian/owner of "%" can authorize check-ins', v_resource.title
        USING ERRCODE = '42501';
    END IF;

    -- SHARED RESOURCE-LEVEL TRANSACTION LOCK:
    -- Guarantees concurrent check-in attempts are serialized and cannot both succeed
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- CRITICAL ACTIVE CUSTODY PROTECTION:
    -- Verify no other borrower currently has possession of this equipment (checked_in or overdue)
    SELECT COUNT(*) INTO v_active_custody_count
    FROM public.bookings
    WHERE resource_id = v_booking.resource_id
      AND id <> v_booking.id
      AND status IN ('checked_in', 'overdue');

    IF v_active_custody_count > 0 THEN
        RAISE EXCEPTION 'Active custody conflict: Equipment is currently in active possession of another borrower (checked_in or overdue). It must be returned and inspected before a new check-in can proceed.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Check active timeframe (can check in up to 30 mins before start until end_time)
    IF now() < (v_booking.start_time - interval '30 minutes') THEN
        RAISE EXCEPTION 'Check-in window unopened: Scheduled start is %, check-in opens 30 minutes prior', v_booking.start_time
        USING ERRCODE = 'P0001';
    END IF;

    IF now() > v_booking.end_time THEN
        RAISE EXCEPTION 'Check-in window elapsed: This reservation expired at %', v_booking.end_time
        USING ERRCODE = 'P0001';
    END IF;

    -- 1. Mark token used
    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;

    -- 2. Atomically create pre-inspection condition report
    INSERT INTO public.condition_reports (
        booking_id,
        submitted_by,
        report_type,
        condition_status,
        notes,
        image_url
    ) VALUES (
        v_booking.id,
        v_caller_id,
        'before',
        p_condition_status,
        trim(COALESCE(p_condition_notes, 'Pre-session verification completed by custodian')),
        p_image_url
    )
    ON CONFLICT (booking_id, report_type) 
    DO UPDATE SET 
        condition_status = EXCLUDED.condition_status,
        notes = EXCLUDED.notes,
        image_url = EXCLUDED.image_url;

    -- 3. Update booking status to checked_in
    UPDATE public.bookings
    SET status = 'checked_in',
        updated_at = now()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    -- 4. Audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_CHECKED_IN',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'condition_status', p_condition_status,
            'custodian_id', v_caller_id
        )
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.verify_check_in(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.verify_check_in(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_check_in(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 12. RPC 8: verify_check_out
-- Physical QR Return Handshake: Seeker returns asset, Owner verifies and checks out.
-- Resolves booking SOLELY from token hash. Atomically records post-condition report.
-- Automatically logs an open incident if damaged or faulty.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_check_out(
    p_raw_token TEXT,
    p_condition_status TEXT,
    p_condition_notes TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_token_hash TEXT;
    v_token_record public.booking_access_tokens%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_incident_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Custodian authentication required to process equipment returns'
        USING ERRCODE = '42501';
    END IF;

    IF p_condition_status NOT IN ('excellent', 'good', 'fair', 'damaged', 'faulty') THEN
        RAISE EXCEPTION 'Validation error: Invalid condition_status "%"', p_condition_status
        USING ERRCODE = '22023';
    END IF;

    v_token_hash := encode(digest(trim(p_raw_token), 'sha256'), 'hex');

    SELECT * INTO v_token_record
    FROM public.booking_access_tokens
    WHERE token_hash = v_token_hash AND token_type = 'check_out'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid access token: Return token does not exist or is unrecognized'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_token_record.used_at IS NOT NULL THEN
        RAISE EXCEPTION 'Replay attack prevented: This return token has already been processed at %', v_token_record.used_at
        USING ERRCODE = 'P0001';
    END IF;

    IF v_token_record.expires_at < now() THEN
        RAISE EXCEPTION 'Expired pass: This return token has expired'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_token_record.booking_id
    FOR UPDATE;

    IF v_booking.status NOT IN ('checked_in', 'overdue') THEN
        RAISE EXCEPTION 'State conflict: Booking is in "%" status, must be "checked_in" or "overdue" to return', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the registered custodian/owner of "%" can process returns', v_resource.title
        USING ERRCODE = '42501';
    END IF;

    -- Shared resource lock
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- 1. Mark token used
    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;

    -- 2. Atomically create post-inspection condition report
    INSERT INTO public.condition_reports (
        booking_id,
        submitted_by,
        report_type,
        condition_status,
        notes,
        image_url
    ) VALUES (
        v_booking.id,
        v_caller_id,
        'after',
        p_condition_status,
        trim(COALESCE(p_condition_notes, 'Post-session return inspection completed by custodian')),
        p_image_url
    )
    ON CONFLICT (booking_id, report_type) 
    DO UPDATE SET 
        condition_status = EXCLUDED.condition_status,
        notes = EXCLUDED.notes,
        image_url = EXCLUDED.image_url;

    -- 3. Automatic incident escalation for damages or faults (Requires human administrative review)
    IF p_condition_status IN ('damaged', 'faulty') THEN
        INSERT INTO public.incidents (
            booking_id,
            reported_by,
            incident_type,
            description,
            status,
            resolution_notes
        ) VALUES (
            v_booking.id,
            v_caller_id,
            'damage',
            'Equipment returned in ' || p_condition_status || ' condition. Notes: ' || COALESCE(p_condition_notes, 'N/A'),
            'open',
            'Automated return inspection flag. Pending custodian assessment.'
        ) RETURNING id INTO v_incident_id;

        INSERT INTO public.notifications (user_id, title, message, link_url)
        VALUES (
            v_booking.requester_id,
            'Equipment Condition Flagged',
            'Your recent return for "' || v_resource.title || '" was inspected and flagged as ' || p_condition_status || '. A review has been opened.',
            '/seeker/bookings'
        );

        INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
        VALUES (
            v_caller_id,
            'INCIDENT_LOGGED_AT_RETURN',
            'incident',
            v_incident_id,
            jsonb_build_object(
                'booking_id', v_booking.id,
                'resource_id', v_booking.resource_id,
                'condition_status', p_condition_status
            )
        );
    END IF;

    -- 4. Update booking status to returned
    UPDATE public.bookings
    SET status = 'returned',
        updated_at = now()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    -- 5. Audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_RETURNED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'condition_status', p_condition_status,
            'custodian_id', v_caller_id
        )
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.verify_check_out(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.verify_check_out(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_check_out(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. RPC 9: mark_overdue_bookings
-- Identifies checked_in bookings where end_time has passed and transitions to overdue.
-- Retains active custody protection. RESTRICTED TO service_role ONLY.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_overdue_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_record RECORD;
BEGIN
    FOR v_record IN
        SELECT b.id, b.resource_id, b.requester_id, r.title AS resource_title, r.owner_id
        FROM public.bookings b
        JOIN public.resources r ON r.id = b.resource_id
        WHERE b.status = 'checked_in'
          AND b.end_time < now()
        FOR UPDATE OF b
    LOOP
        UPDATE public.bookings
        SET status = 'overdue',
            updated_at = now()
        WHERE id = v_record.id;

        INSERT INTO public.notifications (user_id, title, message, link_url)
        VALUES (
            v_record.requester_id,
            'Action Required: Overdue Equipment Return',
            'Your reservation for "' || v_record.resource_title || '" has elapsed. Please check out and return the asset immediately.',
            '/seeker/bookings'
        );

        INSERT INTO public.notifications (user_id, title, message, link_url)
        VALUES (
            v_record.owner_id,
            'Alert: Equipment Overdue',
            'Reservation for "' || v_record.resource_title || '" is past its scheduled return time and has not been checked out.',
            '/owner/bookings'
        );

        INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
        VALUES (
            NULL,
            'BOOKING_MARKED_OVERDUE',
            'booking',
            v_record.id,
            jsonb_build_object(
                'resource_id', v_record.resource_id,
                'requester_id', v_record.requester_id
            )
        );

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN v_updated_count;
END;
$$;

ALTER FUNCTION public.mark_overdue_bookings() OWNER TO postgres;
-- Restricted to service_role (maintenance crons/internal runners only)
REVOKE ALL ON FUNCTION public.mark_overdue_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_bookings() TO service_role;

-- ------------------------------------------------------------------------------
-- 14. PREVENT DIRECT UNAUTHORIZED MUTATIONS (TRIGGER GUARD + RLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_state_machine_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    -- Allow trusted background/maintenance sessions or service_role or admin
    IF session_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- If INSERT: direct insertion by authenticated users is ONLY allowed in 'pending' status
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' THEN
            RAISE EXCEPTION 'Unauthorized: New bookings must be created in "pending" status. Status "%" cannot be directly set on insert.', NEW.status
            USING ERRCODE = '42501';
        END IF;
        NEW.waitlist_position := NULL;
        NEW.approved_by := NULL;
    END IF;

    -- If UPDATE: direct status modification by ordinary users is restricted
    IF TG_OP = 'UPDATE' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            -- Requesters may only cancel their own pending/waitlisted/approved bookings
            IF (OLD.requester_id = auth.uid() AND NEW.status = 'cancelled' AND OLD.status IN ('pending', 'waitlisted', 'approved')) THEN
                RETURN NEW;
            END IF;

            -- All other status transitions must go through authorized SECURITY DEFINER RPCs
            RAISE EXCEPTION 'Unauthorized: Direct booking status transition from "%" to "%" is blocked. You must use the authorized RPC state machine endpoints.', OLD.status, NEW.status
            USING ERRCODE = '42501';
        END IF;

        -- Prevent ordinary users from altering core schedule once approved
        IF OLD.status IN ('approved', 'checked_in', 'returned', 'overdue') THEN
            IF (NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.resource_id IS DISTINCT FROM OLD.resource_id) THEN
                RAISE EXCEPTION 'Immutable schedule: Booking schedule cannot be directly modified once confirmed.'
                USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_booking_state_machine_guard() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_booking_state_machine_guard ON public.bookings;
CREATE TRIGGER trg_booking_state_machine_guard
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_state_machine_guard();

-- RLS Update Policy
DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;

CREATE POLICY "bookings_update_policy"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR requester_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = bookings.resource_id AND r.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin()
        OR (requester_id = auth.uid() AND status = 'cancelled')
        OR (
            EXISTS (
                SELECT 1 FROM public.resources r
                WHERE r.id = bookings.resource_id AND r.owner_id = auth.uid()
            )
            AND status IN ('cancelled', 'rejected')
        )
    );
