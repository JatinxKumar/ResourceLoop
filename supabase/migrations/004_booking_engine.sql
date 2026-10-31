-- ==============================================================================
-- Migration: 004_booking_engine.sql
-- Description: Stage 3 Booking & Allocation Engine (Final Hardened Specification)
-- 
-- Key Highlights:
-- 1. RPC-Only Mutation Architecture: Direct INSERT, UPDATE, and DELETE privileges
--    on public.bookings are strictly REVOKED from authenticated and anon roles.
--    All booking creation and lifecycle state transitions must execute through
--    designated SECURITY DEFINER RPCs.
-- 2. Strict Search Path & Schema Qualification: All RPCs configure:
--    SET search_path = pg_catalog, extensions, pg_temp;
--    (public is excluded from search_path; all application tables, types, and
--    functions are explicitly schema-qualified as public.* to prevent search-path hijacking).
-- 3. Scheduled Overlap Prevention: Safe check of existing data before adding the
--    no_overlapping_scheduled_bookings exclusion constraint (no unconditional drops).
-- 4. Active Custody Protection: Shared resource-level transaction lock
--    (pg_advisory_xact_lock on resource_custody) acquired before evaluating custody.
--    Custody state is rechecked after acquiring lock in both approve_booking() and verify_check_in().
-- 5. Precise Overdue Custody Rule: Approvals are blocked if the asset currently has an
--    unreturned 'overdue' booking and candidate start_time is within 24 hours of now(),
--    or if an active 'checked_in' session's scheduled end has not yet elapsed.
-- 6. Deterministic FIFO Waitlist: Evaluated per resource and overlapping time window
--    using interval intersection (&&) with transactional serialization and queue compaction.
-- 7. Seeker-Only QR Pass Generation: generate_booking_pass() strictly restricts token
--    generation to the booking requester (auth.uid() = requester_id).
-- 8. Audit Logging & Human Governance: Full audit trail matching public.audit_logs.
--    Automatic damage incident flagging with human-only resolution and penalty review.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_scheduled_bookings'
    ) THEN
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

ALTER TABLE public.booking_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tokens_select_participants" ON public.booking_access_tokens;
DROP POLICY IF EXISTS "tokens_admin_manage" ON public.booking_access_tokens;
DROP POLICY IF EXISTS "tokens_admin_only" ON public.booking_access_tokens;

CREATE POLICY "tokens_admin_only"
    ON public.booking_access_tokens
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

REVOKE ALL ON public.booking_access_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_access_tokens TO service_role;

-- ------------------------------------------------------------------------------
-- 4. HELPER: recalculate_waitlist
-- Restricted to internal execution (service_role / postgres only).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_waitlist(p_resource_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, pg_temp
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
-- Exclusive client reservation creation endpoint.
-- Atomic qualification, membership, availability, and usage limits (including overdue).
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
SET search_path = pg_catalog, extensions, pg_temp
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
    v_requester_id := auth.uid();
    IF v_requester_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required to submit booking requests'
        USING ERRCODE = '42501';
    END IF;

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

    PERFORM pg_advisory_xact_lock(hashtext(v_requester_id::text || ':' || p_resource_id::text));

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
-- Approves a booking.
-- Shared resource lock is acquired FIRST before inspecting custody state.
-- Precise Overdue Custody Rule:
-- 1. If resource has an unreturned 'overdue' booking, no new booking starting within
--    24 hours of now() can be approved until the overdue asset is returned and inspected.
-- 2. If resource has an active 'checked_in' booking, no booking starting before the
--    scheduled session end can be approved.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_booking(p_booking_id UUID)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_overdue_conflict_count INTEGER;
    v_checked_in_conflict_count INTEGER;
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

    IF v_booking.status NOT IN ('pending', 'waitlisted') THEN
        RAISE EXCEPTION 'Invalid state transition: Cannot approve a booking that is currently in "%" status', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the asset owner or platform administrator can approve this reservation'
        USING ERRCODE = '42501';
    END IF;

    -- Lock resource custody first before evaluating checks
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- Precise Overdue Rule: Block if overdue and starting within 24 hours of now
    IF v_booking.start_time <= (now() + interval '24 hours') THEN
        SELECT COUNT(*) INTO v_overdue_conflict_count
        FROM public.bookings
        WHERE resource_id = v_booking.resource_id
          AND id <> v_booking.id
          AND status = 'overdue';

        IF v_overdue_conflict_count > 0 THEN
            RAISE EXCEPTION 'Active custody conflict: Equipment is currently OVERDUE and unreturned. Approvals for sessions starting within 24 hours are blocked until the asset is returned and inspected.'
            USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Block if checked_in and candidate start_time is before ongoing session scheduled end
    SELECT COUNT(*) INTO v_checked_in_conflict_count
    FROM public.bookings
    WHERE resource_id = v_booking.resource_id
      AND id <> v_booking.id
      AND status = 'checked_in'
      AND v_booking.start_time < end_time;

    IF v_checked_in_conflict_count > 0 THEN
        RAISE EXCEPTION 'Active custody conflict: Equipment is currently checked in. Candidate booking start_time conflicts with ongoing session.'
        USING ERRCODE = 'P0001';
    END IF;

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

    PERFORM public.recalculate_waitlist(v_booking.resource_id);

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
SET search_path = pg_catalog, extensions, pg_temp
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

    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE booking_id = p_booking_id AND used_at IS NULL;

    PERFORM public.recalculate_waitlist(v_booking.resource_id);

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
SET search_path = pg_catalog, extensions, pg_temp
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

    PERFORM pg_advisory_xact_lock(hashtext('waitlist:' || v_booking.resource_id::text));

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
SET search_path = pg_catalog, extensions, pg_temp
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

    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE booking_id = p_booking_id AND used_at IS NULL;

    PERFORM public.recalculate_waitlist(v_booking.resource_id);

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
-- STRICT FRONTEND CONTRACT: generate_booking_pass(p_booking_id, p_token_type)
-- STRICT AUTHORIZATION: ONLY the booking requester (seeker) can obtain the raw token!
-- Stored ONLY as SHA-256 hash. Returns raw token string ONCE to the seeker.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_booking_pass(
    p_booking_id UUID,
    p_token_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_booking public.bookings%ROWTYPE;
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

    -- STRICT: Only seeker (or admin for support) can generate pass
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

    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE booking_id = p_booking_id
      AND token_type = p_token_type
      AND used_at IS NULL;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

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
-- Shared resource custody lock acquired FIRST before checking active custody.
-- Custody rechecked under lock to guarantee concurrent check-ins cannot both succeed.
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
SET search_path = pg_catalog, extensions, pg_temp
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

    v_token_hash := encode(digest(trim(p_raw_token), 'sha256'), 'hex');

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

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_token_record.booking_id
    FOR UPDATE;

    IF v_booking.status <> 'approved' THEN
        RAISE EXCEPTION 'State conflict: Booking is in "%" status, must be "approved" to check in', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the registered custodian/owner of "%" can authorize check-ins', v_resource.title
        USING ERRCODE = '42501';
    END IF;

    -- Shared resource custody lock acquired first
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- Recheck active custody under lock
    SELECT COUNT(*) INTO v_active_custody_count
    FROM public.bookings
    WHERE resource_id = v_booking.resource_id
      AND id <> v_booking.id
      AND status IN ('checked_in', 'overdue');

    IF v_active_custody_count > 0 THEN
        RAISE EXCEPTION 'Active custody conflict: Equipment is currently in active possession of another borrower (checked_in or overdue). It must be returned and inspected before a new check-in can proceed.'
        USING ERRCODE = 'P0001';
    END IF;

    IF now() < (v_booking.start_time - interval '30 minutes') THEN
        RAISE EXCEPTION 'Check-in window unopened: Scheduled start is %, check-in opens 30 minutes prior', v_booking.start_time
        USING ERRCODE = 'P0001';
    END IF;

    IF now() > v_booking.end_time THEN
        RAISE EXCEPTION 'Check-in window elapsed: This reservation expired at %', v_booking.end_time
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;

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

    UPDATE public.bookings
    SET status = 'checked_in',
        updated_at = now()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

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
SET search_path = pg_catalog, extensions, pg_temp
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

    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    UPDATE public.booking_access_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;

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

    UPDATE public.bookings
    SET status = 'returned',
        updated_at = now()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

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
SET search_path = pg_catalog, extensions, pg_temp
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
REVOKE ALL ON FUNCTION public.mark_overdue_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_bookings() TO service_role;

-- ------------------------------------------------------------------------------
-- 14. TABLE PRIVILEGES & RLS POLICIES (RPC-ONLY MUTATION LOCKDOWN)
-- ------------------------------------------------------------------------------
-- REVOKE direct client INSERT, UPDATE, and DELETE privileges on public.bookings.
-- All mutations must execute through the SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bookings TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.bookings TO service_role;

DROP POLICY IF EXISTS "bookings_insert_requester" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_admin" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_mutation" ON public.bookings;

CREATE POLICY "bookings_admin_mutation"
    ON public.bookings
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
