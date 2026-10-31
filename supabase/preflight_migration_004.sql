-- ==============================================================================
-- ResourceLoop - Migration 004 Read-Only Preflight Validation Script
-- ==============================================================================
-- PURPOSE:
-- Safely audits an existing database environment BEFORE applying Migration 004.
-- Performs ZERO writes, creates NO objects, and acquires NO locks.
-- Run in Supabase SQL Editor or via psql prior to executing 004_booking_engine.sql.
-- ==============================================================================

DO $$
DECLARE
    v_overlapping_approved_count INTEGER := 0;
    v_invalid_booking_status_count INTEGER := 0;
    v_duplicate_condition_reports INTEGER := 0;
    v_btree_gist_installed BOOLEAN := false;
    v_pgcrypto_installed BOOLEAN := false;
    v_btree_gist_schema TEXT;
    v_pgcrypto_schema TEXT;
    v_can_proceed BOOLEAN := true;
BEGIN
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'RESOURCELOOP MIGRATION 004 — PREFLIGHT COMPATIBILITY AUDIT';
    RAISE NOTICE '==============================================================';

    -- --------------------------------------------------------------------------
    -- CHECK 1: Detect Existing Overlapping 'approved' Bookings
    -- --------------------------------------------------------------------------
    -- If any exist, ALTER TABLE ... ADD CONSTRAINT exclude_overlapping_approved_bookings will FAIL.
    SELECT COUNT(*) INTO v_overlapping_approved_count
    FROM (
        SELECT b1.id
        FROM public.bookings b1
        JOIN public.bookings b2 ON b1.resource_id = b2.resource_id
                               AND b1.id < b2.id
                               AND b1.status = 'approved'
                               AND b2.status = 'approved'
                               AND tstzrange(b1.start_time, b1.end_time) && tstzrange(b2.start_time, b2.end_time)
    ) collisions;

    IF v_overlapping_approved_count > 0 THEN
        v_can_proceed := false;
        RAISE WARNING '[BLOCKER] Found % pair(s) of overlapping approved bookings in public.bookings.', v_overlapping_approved_count;
        RAISE WARNING 'Action: Cancel or adjust overlapping approved bookings before adding the exclusion constraint.';
    ELSE
        RAISE NOTICE '[OK] Check 1: Zero overlapping approved reservations found. GiST exclusion constraint can safely be added.';
    END IF;

    -- --------------------------------------------------------------------------
    -- CHECK 2: Validate Existing Booking Status Strings
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_invalid_booking_status_count
    FROM public.bookings
    WHERE status NOT IN ('pending', 'approved', 'rejected', 'waitlisted', 'checked_in', 'returned', 'overdue', 'cancelled');

    IF v_invalid_booking_status_count > 0 THEN
        v_can_proceed := false;
        RAISE WARNING '[BLOCKER] Found % booking row(s) with unrecognized status values.', v_invalid_booking_status_count;
    ELSE
        RAISE NOTICE '[OK] Check 2: All existing bookings have valid status strings.';
    END IF;

    -- --------------------------------------------------------------------------
    -- CHECK 3: Detect Duplicate Condition Reports per Stage
    -- --------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_duplicate_condition_reports
    FROM (
        SELECT booking_id, report_type
        FROM public.condition_reports
        GROUP BY booking_id, report_type
        HAVING COUNT(*) > 1
    ) dupes;

    IF v_duplicate_condition_reports > 0 THEN
        v_can_proceed := false;
        RAISE WARNING '[BLOCKER] Found % duplicate (booking_id, report_type) pair(s) in condition_reports.', v_duplicate_condition_reports;
    ELSE
        RAISE NOTICE '[OK] Check 3: Unique constraint on (booking_id, report_type) is safe to apply.';
    END IF;

    -- --------------------------------------------------------------------------
    -- CHECK 4: Verify Installed Extensions & Schemas
    -- --------------------------------------------------------------------------
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'),
           (SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'btree_gist')
    INTO v_btree_gist_installed, v_btree_gist_schema;

    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'),
           (SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'pgcrypto')
    INTO v_pgcrypto_installed, v_pgcrypto_schema;

    RAISE NOTICE '[INFO] btree_gist installed: %, schema: %', v_btree_gist_installed, COALESCE(v_btree_gist_schema, 'not installed');
    RAISE NOTICE '[INFO] pgcrypto installed: %, schema: %', v_pgcrypto_installed, COALESCE(v_pgcrypto_schema, 'not installed');

    -- --------------------------------------------------------------------------
    -- PREFLIGHT SUMMARY
    -- --------------------------------------------------------------------------
    RAISE NOTICE '--------------------------------------------------------------';
    IF v_can_proceed THEN
        RAISE NOTICE '>>> PREFLIGHT AUDIT PASSED: Database is 100%% ready for Migration 004.';
    ELSE
        RAISE WARNING '>>> PREFLIGHT AUDIT FAILED: Address the blockers above before running Migration 004.';
    END IF;
    RAISE NOTICE '==============================================================';
END $$;
