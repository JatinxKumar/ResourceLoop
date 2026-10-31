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
--    Extension functions (gen_random_bytes, digest, encode) are explicitly resolved
--    under the extensions schema.
-- 3. Extension Management: Ensures extensions schema exists, installs btree_gist
--    and pgcrypto in extensions schema, and safely relocates any legacy public installations.
-- 4. Scheduled Overlap Prevention: Safe check of existing data before adding the
--    no_overlapping_scheduled_bookings exclusion constraint (no unconditional drops).
-- 5. Active Custody Protection: Shared resource-level transaction lock
--    (pg_advisory_xact_lock on resource_custody) acquired before evaluating custody.
--    An unreturned 'checked_in' or 'overdue' booking strictly blocks new approvals
--    and check-ins until physical checkout is completed, even if scheduled end time has passed.
-- 6. Connected Interval Cluster FIFO Queue & Approval Enforcement:
--    Evaluated per resource across connected overlapping interval chains. Requests
--    in connected clusters receive strictly sequential, deterministic FIFO positions
--    (1, 2, 3...) ordered by (created_at ASC, id ASC). Independent intervals maintain
--    isolated queues. FIFO priority is strictly enforced on approval: earlier requests
--    in a connected cluster cannot be bypassed by later chained requests.
-- 7. Shared Custody Lock in Maintenance: mark_overdue_bookings() acquires the shared
--    resource-custody advisory lock and rechecks status under lock.
-- 8. Seeker-Only QR Pass Generation: generate_booking_pass() strictly restricts token
--    generation to the booking requester (auth.uid() = requester_id). Returns symmetric
--    token and raw_token payload with ISO expiration.
-- 9. Complete Verification Return Contract: verify_check_in() and verify_check_out()
--    return the full public.bookings row with parameter names (p_raw_token, p_condition_status,
--    p_condition_notes, p_image_url) matching the frontend DTO.
-- 10. Audit Logging & Human Governance: Full audit trail matching public.audit_logs.
--     Automatic damage incident flagging with human-only resolution and penalty review.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & SCHEMA QUALIFICATION
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Safely relocate pgcrypto or btree_gist if installed in public by earlier scripts.
-- Wrapped in exception handlers so migration role permissions never fail the script.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
    ) THEN
        BEGIN
            ALTER EXTENSION pgcrypto SET SCHEMA extensions;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Extension pgcrypto is in schema public; relocation skipped due to role privileges.';
        END;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
    ) THEN
        BEGIN
            ALTER EXTENSION btree_gist SET SCHEMA extensions;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Extension btree_gist is in schema public; relocation skipped due to role privileges.';
        END;
    END IF;
END $$;

-- Verify required extensions resolve under the 'extensions' schema.
-- Prevents Migration 004 from proceeding into a broken state if pgcrypto or btree_gist
-- is missing or remains outside the 'extensions' schema.
DO $$
DECLARE
    v_pgcrypto_schema TEXT;
    v_btree_gist_schema TEXT;
BEGIN
    SELECT n.nspname INTO v_pgcrypto_schema
    FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgcrypto';

    SELECT n.nspname INTO v_btree_gist_schema
    FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'btree_gist';

    -- 1. Check pgcrypto presence and schema
    IF v_pgcrypto_schema IS NULL THEN
        RAISE EXCEPTION 'CRITICAL EXTENSION MISSING: Extension "pgcrypto" is not installed. Migration 004 requires pgcrypto under schema "extensions". Please execute "CREATE EXTENSION pgcrypto WITH SCHEMA extensions;" before applying Migration 004.'
        USING ERRCODE = '0A000';
    ELSIF v_pgcrypto_schema <> 'extensions' THEN
        RAISE EXCEPTION 'CRITICAL EXTENSION SCHEMA MISMATCH: Extension pgcrypto is installed in schema "%", but Migration 004 requires schema "extensions". Please execute "ALTER EXTENSION pgcrypto SET SCHEMA extensions;" before applying Migration 004.', v_pgcrypto_schema
        USING ERRCODE = '0A000';
    END IF;

    -- 2. Check btree_gist presence and schema
    IF v_btree_gist_schema IS NULL THEN
        RAISE EXCEPTION 'CRITICAL EXTENSION MISSING: Extension "btree_gist" is not installed. Migration 004 requires btree_gist under schema "extensions". Please execute "CREATE EXTENSION btree_gist WITH SCHEMA extensions;" before applying Migration 004.'
        USING ERRCODE = '0A000';
    ELSIF v_btree_gist_schema <> 'extensions' THEN
        RAISE EXCEPTION 'CRITICAL EXTENSION SCHEMA MISMATCH: Extension btree_gist is installed in schema "%", but Migration 004 requires schema "extensions". Please execute "ALTER EXTENSION btree_gist SET SCHEMA extensions;" before applying Migration 004.', v_btree_gist_schema
        USING ERRCODE = '0A000';
    END IF;
END $$;

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
-- 2b. SCHEMA ADDITIONS: public.condition_reports
-- Ensure unique constraint on (booking_id, report_type) exists for atomic
-- ON CONFLICT upserts in verify_check_in() and verify_check_out().
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'condition_reports'
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname ORDER BY a.attnum)
              FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
          ) = ARRAY['booking_id', 'report_type']
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'unique_booking_report_stage'
        ) THEN
            ALTER TABLE public.condition_reports
            ADD CONSTRAINT unique_booking_report_stage UNIQUE (booking_id, report_type);
        END IF;
    END IF;
END $$;

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
-- Evaluates deterministic queue positions per resource using Connected Interval
-- Cluster Semantics.
-- Chained overlapping intervals (A overlaps B, B overlaps C) form connected clusters
-- and receive strictly sequential FIFO positions (1, 2, 3...) ordered by (created_at ASC, id ASC).
-- Independent non-overlapping intervals maintain isolated queues starting at 1.
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

    WITH sorted_intervals AS (
        SELECT 
            id,
            start_time,
            end_time,
            created_at,
            MAX(end_time) OVER (
                ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) AS prev_max_end
        FROM public.bookings
        WHERE resource_id = p_resource_id
          AND status = 'waitlisted'
    ),
    clustered AS (
        SELECT 
            id,
            created_at,
            SUM(CASE WHEN prev_max_end IS NULL OR start_time >= prev_max_end THEN 1 ELSE 0 END) OVER (
                ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC
                ROWS UNBOUNDED PRECEDING
            ) AS cluster_id
        FROM sorted_intervals
    ),
    ranked AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY cluster_id 
                ORDER BY created_at ASC, id ASC
            ) AS new_pos
        FROM clustered
    )
    UPDATE public.bookings b
    SET waitlist_position = ranked.new_pos,
        updated_at = now()
    FROM ranked
    WHERE b.id = ranked.id
      AND b.waitlist_position IS DISTINCT FROM ranked.new_pos;
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
-- Approves a pending or waitlisted booking.
-- Shared resource custody lock is acquired FIRST before inspecting custody state.
-- Active Custody Protection: An unreturned 'checked_in' or 'overdue' booking
-- strictly blocks new approvals until physical checkout is completed, even if its
-- scheduled end time has passed.
-- FIFO Fairness: Enforces strictly deterministic FIFO approval order using the
-- EXACT SAME connected-overlap-cluster semantics as recalculate_waitlist().
-- In a chained interval A-B-C, C cannot bypass A, and requests must be approved
-- in FIFO order (position 1 first).
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
    v_prior_waitlisted_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

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

    -- Strict Lock Hierarchy Step 1: Acquire shared resource-custody advisory lock FIRST
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- Strict Lock Hierarchy Step 2: Acquire row lock on booking under the custody lock
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    -- Active Custody Protection:
    -- An unreturned checked_in or overdue booking must block new approvals until
    -- physical checkout is completed, even if its scheduled end time has passed.
    IF EXISTS (
        SELECT 1
        FROM public.bookings
        WHERE resource_id = v_booking.resource_id
          AND id <> v_booking.id
          AND status IN ('checked_in', 'overdue')
    ) THEN
        RAISE EXCEPTION 'Active custody conflict: Equipment is currently in active possession of another borrower (status: checked_in or overdue). New reservations cannot be approved until physical checkout and return inspection are completed.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Connected Interval Cluster FIFO Fairness Enforcement:
    -- If approving a waitlisted booking, ensure it is at position 1 in its connected cluster.
    -- Later chained requests (e.g. C in an A-B-C chain) cannot bypass earlier requests (A or B).
    IF v_booking.status = 'waitlisted' THEN
        -- Recalculate waitlist first under lock to ensure fresh, accurate cluster positions
        PERFORM public.recalculate_waitlist(v_booking.resource_id);

        WITH sorted_intervals AS (
            SELECT 
                id,
                start_time,
                end_time,
                created_at,
                MAX(end_time) OVER (
                    ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ) AS prev_max_end
            FROM public.bookings
            WHERE resource_id = v_booking.resource_id
              AND status = 'waitlisted'
        ),
        clustered AS (
            SELECT 
                id,
                created_at,
                SUM(CASE WHEN prev_max_end IS NULL OR start_time >= prev_max_end THEN 1 ELSE 0 END) OVER (
                    ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC
                    ROWS UNBOUNDED PRECEDING
                ) AS cluster_id
            FROM sorted_intervals
        ),
        ranked AS (
            SELECT 
                id,
                cluster_id,
                ROW_NUMBER() OVER (
                    PARTITION BY cluster_id 
                    ORDER BY created_at ASC, id ASC
                ) AS new_pos
            FROM clustered
        )
        SELECT r1.id INTO v_prior_waitlisted_id
        FROM ranked r1
        JOIN ranked r2 ON r1.cluster_id = r2.cluster_id
        WHERE r2.id = v_booking.id
          AND r1.new_pos < r2.new_pos
        ORDER BY r1.new_pos ASC
        LIMIT 1;

        IF v_prior_waitlisted_id IS NOT NULL THEN
            RAISE EXCEPTION 'FIFO fairness violation: Earlier waitlisted request % has priority in the connected waitlist cluster (position 1). Waitlisted requests must be approved in FIFO order.', v_prior_waitlisted_id
            USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- If approving a pending booking, ensure no waitlisted cluster overlaps the candidate interval
    IF v_booking.status = 'pending' THEN
        WITH sorted_intervals AS (
            SELECT 
                id,
                start_time,
                end_time,
                created_at,
                MAX(end_time) OVER (
                    ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ) AS prev_max_end
            FROM public.bookings
            WHERE resource_id = v_booking.resource_id
              AND status = 'waitlisted'
        ),
        clustered AS (
            SELECT 
                id,
                start_time,
                end_time,
                created_at,
                SUM(CASE WHEN prev_max_end IS NULL OR start_time >= prev_max_end THEN 1 ELSE 0 END) OVER (
                    ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC
                    ROWS UNBOUNDED PRECEDING
                ) AS cluster_id
            FROM sorted_intervals
        ),
        cluster_spans AS (
            SELECT 
                cluster_id,
                MIN(start_time) AS c_start,
                MAX(end_time) AS c_end
            FROM clustered
            GROUP BY cluster_id
        )
        SELECT c.id INTO v_prior_waitlisted_id
        FROM clustered c
        JOIN cluster_spans s ON c.cluster_id = s.cluster_id
        WHERE tstzrange(v_booking.start_time, v_booking.end_time, '[)') && tstzrange(s.c_start, s.c_end, '[)')
        ORDER BY c.created_at ASC, c.id ASC
        LIMIT 1;

        IF v_prior_waitlisted_id IS NOT NULL THEN
            RAISE EXCEPTION 'FIFO fairness violation: Prior waitlisted reservation % exists for this connected timeframe. Waitlist queue has priority over newly pending requests.', v_prior_waitlisted_id
            USING ERRCODE = 'P0001';
        END IF;
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
-- Rejects a booking with mandatory reason (p_rejection_reason). Recalculates waitlist.
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
-- Moves a pending booking to the waitlist.
-- Recalculates connected-cluster positions and returns the updated booking row.
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

    UPDATE public.bookings
    SET status = 'waitlisted',
        updated_at = now()
    WHERE id = p_booking_id;

    PERFORM public.recalculate_waitlist(v_booking.resource_id);

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'BOOKING_WAITLISTED',
        'booking',
        v_booking.id,
        jsonb_build_object(
            'resource_id', v_booking.resource_id,
            'requester_id', v_booking.requester_id,
            'waitlist_position', v_booking.waitlist_position
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
-- Returns both 'token' and 'raw_token' in JSON response for contract reconciliation.
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

    v_raw_token := extensions.encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := extensions.encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

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
        'raw_token', v_raw_token,
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
-- Parameters match frontend VerifyHandshakeDTO: (p_raw_token, p_condition_status, p_condition_notes, p_image_url).
-- Shared resource custody lock acquired FIRST before checking active custody.
-- Custody rechecked under lock to guarantee concurrent check-ins cannot both succeed.
-- Active custody blocks check-ins if another booking is checked_in or overdue.
-- Returns full public.bookings row matching frontend contract.
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

    v_token_hash := extensions.encode(extensions.digest(trim(p_raw_token), 'sha256'), 'hex');

    SELECT * INTO v_token_record
    FROM public.booking_access_tokens
    WHERE token_hash = v_token_hash AND token_type = 'check_in';

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
    WHERE id = v_token_record.booking_id;

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

    -- Strict Lock Hierarchy Step 1: Acquire shared resource-custody advisory lock FIRST
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- Strict Lock Hierarchy Step 2: Acquire row locks on token and booking under custody lock
    SELECT * INTO v_token_record
    FROM public.booking_access_tokens
    WHERE id = v_token_record.id
    FOR UPDATE;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_booking.id
    FOR UPDATE;

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
-- Parameters match frontend VerifyHandshakeDTO: (p_raw_token, p_condition_status, p_condition_notes, p_image_url).
-- Resolves booking SOLELY from token hash. Atomically records post-condition report.
-- Automatically logs an open incident if damaged or faulty.
-- Releases active custody protection (status becomes 'returned').
-- Returns full public.bookings row matching frontend contract.
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

    v_token_hash := extensions.encode(extensions.digest(trim(p_raw_token), 'sha256'), 'hex');

    SELECT * INTO v_token_record
    FROM public.booking_access_tokens
    WHERE token_hash = v_token_hash AND token_type = 'check_out';

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
    WHERE id = v_token_record.booking_id;

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

    -- Strict Lock Hierarchy Step 1: Acquire shared resource-custody advisory lock FIRST
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_booking.resource_id::text));

    -- Strict Lock Hierarchy Step 2: Acquire row locks on token and booking under custody lock
    SELECT * INTO v_token_record
    FROM public.booking_access_tokens
    WHERE id = v_token_record.id
    FOR UPDATE;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_booking.id
    FOR UPDATE;

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
-- Uses shared resource-custody advisory lock and rechecks status under lock.
-- RESTRICTED TO service_role ONLY.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_overdue_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, pg_temp
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_resource RECORD;
    v_record RECORD;
BEGIN
    -- Permit service_role (auth.uid() IS NULL) or authenticated platform administrators
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only service_role or platform administrators can trigger overdue sweeps'
        USING ERRCODE = '42501';
    END IF;

    -- Iterate across distinct resources with overdue bookings in deterministic order
    FOR v_resource IN
        SELECT DISTINCT resource_id
        FROM public.bookings
        WHERE status = 'checked_in'
          AND end_time < now()
        ORDER BY resource_id
    LOOP
        -- Strict Lock Hierarchy Step 1: Acquire shared resource-custody advisory lock FIRST
        PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_resource.resource_id::text));

        -- Strict Lock Hierarchy Step 2: Lock and process overdue bookings for this resource under custody lock
        FOR v_record IN
            SELECT b.id, b.resource_id, b.requester_id, r.title AS resource_title, r.owner_id
            FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.resource_id = v_resource.resource_id
              AND b.status = 'checked_in'
              AND b.end_time < now()
            ORDER BY b.id
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
                    'actor', 'system',
                    'resource_id', v_record.resource_id,
                    'requester_id', v_record.requester_id,
                    'marked_at', now()
                )
            );

            v_updated_count := v_updated_count + 1;
        END LOOP;
    END LOOP;

    RETURN v_updated_count;
END;
$$;

ALTER FUNCTION public.mark_overdue_bookings() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_overdue_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_overdue_bookings() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 14. RPC 10: accept_donation
-- Atomically approves a donation booking and retires the surplus asset.
-- Guarantees single-transaction atomicity across:
--   1. Caller authentication & ownership/admin authorization
--   2. Booking status validation (must be 'pending' or 'waitlisted')
--   3. Donation metadata validation (is_donation flag or [DONATION_CLAIM] marker)
--   4. Active custody protection (no unreturned session on resource)
--   5. Booking approval (assigns approver, clears waitlist position)
--   6. Resource retirement (status = 'unavailable')
--   7. Waitlist recalculation for remaining requests
--   8. Recipient notification creation
--   9. Compliance audit log recording
-- Failure of any step automatically rolls back the entire transaction.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_donation(
    p_booking_id UUID
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
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
    END IF;

    -- Lookup booking
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id USING ERRCODE = 'P0002';
    END IF;

    -- Lookup resource
    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resource not found: %', v_booking.resource_id USING ERRCODE = 'P0002';
    END IF;

    -- Strict Lock Hierarchy Step 1: Acquire shared resource-custody advisory lock FIRST
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_resource.id::text));

    -- Strict Lock Hierarchy Step 2: Acquire row locks on resource and booking under custody lock
    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_resource.id
    FOR UPDATE;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    -- Authorization: Caller must be the asset owner or a platform administrator
    IF NOT (v_resource.owner_id = v_caller_id OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only the resource owner or platform administrator can accept a donation transfer'
        USING ERRCODE = '42501';
    END IF;

    -- Booking status validation: must be 'pending' or 'waitlisted'
    IF v_booking.status NOT IN ('pending', 'waitlisted') THEN
        RAISE EXCEPTION 'State conflict: Booking is in "%" status, but must be "pending" or "waitlisted" to accept donation', v_booking.status
        USING ERRCODE = 'P0001';
    END IF;

    -- Donation metadata validation: verify resource is marked for donation or booking has [DONATION_CLAIM] marker
    -- Safe text comparison prevents 22P02 invalid input syntax exceptions on malformed JSONB values
    IF NOT (
        LOWER(TRIM(COALESCE(v_resource.availability_info->>'is_donation', 'false'))) IN ('true', 't', '1', 'yes')
        OR v_booking.purpose LIKE '[DONATION_CLAIM]%'
    ) THEN
        RAISE EXCEPTION 'Validation error: Resource or reservation request is not designated as an institutional surplus donation'
        USING ERRCODE = 'P0001';
    END IF;

    -- Active Custody Protection: Ensure equipment is not currently in active borrower possession
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE resource_id = v_booking.resource_id
          AND id <> v_booking.id
          AND status IN ('checked_in', 'overdue')
    ) THEN
        RAISE EXCEPTION 'Active custody conflict: Equipment is currently in active possession of another borrower. Donation cannot be accepted until return inspection is completed.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Step A: Approve booking and clear waitlist position
    UPDATE public.bookings
    SET status = 'approved',
        approved_by = v_caller_id,
        waitlist_position = NULL,
        updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Step B: Retire resource lifecycle status to 'unavailable' so it cannot be claimed or booked again
    UPDATE public.resources
    SET status = 'unavailable',
        updated_at = now()
    WHERE id = v_resource.id;

    -- Step C: Recalculate waitlist queue for remaining requests
    PERFORM public.recalculate_waitlist(v_resource.id);

    -- Step D: Insert compliance audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_caller_id,
        'DONATION_TRANSFER_ACCEPTED',
        'resource',
        v_resource.id,
        jsonb_build_object(
            'booking_id', p_booking_id,
            'recipient_id', v_booking.requester_id,
            'donor_id', v_resource.owner_id,
            'accepted_at', now()
        )
    );

    -- Step E: Insert in-app recipient notification
    INSERT INTO public.notifications (user_id, title, message, link_url)
    VALUES (
        v_booking.requester_id,
        'Donation Request Approved',
        'Your donation claim for "' || v_resource.title || '" has been accepted! Please coordinate physical transfer with the donor.',
        '/seeker/bookings'
    );

    RETURN v_booking;
END;
$$;

ALTER FUNCTION public.accept_donation(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_donation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_donation(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 15. TABLE PRIVILEGES & RLS POLICIES (RPC-ONLY MUTATION LOCKDOWN)
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
