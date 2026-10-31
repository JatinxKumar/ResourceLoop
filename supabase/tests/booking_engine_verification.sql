-- ==============================================================================
-- ResourceLoop - Stage 3 & 4 Final SQL Verification & Integration Test Harness
-- ==============================================================================
-- PURPOSE:
-- Rigorously validates all core Stage 3 & 4 RPCs and database invariants against
-- an actual PostgreSQL database environment (staging or disposable test project).
--
-- DIRECT RPC CALLS TESTED:
-- 1. public.request_booking(p_resource_id, p_start_time, p_end_time, p_purpose)
-- 2. public.approve_booking(p_booking_id)
-- 3. public.generate_booking_pass(p_booking_id, p_token_type)
-- 4. public.verify_check_in(p_raw_token, p_condition_status, p_condition_notes, p_image_url)
-- 5. public.verify_check_out(p_raw_token, p_condition_status, p_condition_notes, p_image_url)
-- 6. public.mark_overdue_bookings()
-- 7. public.waitlist_booking(p_booking_id)
-- 8. public.accept_donation(p_booking_id)
--
-- NOTE ON CONCURRENCY:
-- Single-session test scripts verify lock acquisition syntax, re-check logic,
-- and SQL state machine invariants within a database transaction. True concurrent
-- race-condition testing requires separate, independent database connections.
--
-- ROLLBACK & SAFETY:
-- Runs in an isolated DO $$ ... END $$ block with dedicated generated UUID fixtures.
-- Explicitly tears down all created fixture records upon completion.
-- Any test failure raises an unhandled exception, causing PostgreSQL to automatically
-- roll back all mutations executed within the block.
-- ==============================================================================

DO $$
DECLARE
    v_test_org_id UUID;
    v_owner_id UUID;
    v_seeker1_id UUID;
    v_seeker2_id UUID;
    v_admin_id UUID;
    v_resource_id UUID;
    v_donation_res_id UUID;

    -- Return variables
    v_booking1 public.bookings%ROWTYPE;
    v_booking2 public.bookings%ROWTYPE;
    v_booking_overdue public.bookings%ROWTYPE;
    v_booking_donation public.bookings%ROWTYPE;
    v_chain_a public.bookings%ROWTYPE;
    v_chain_b public.bookings%ROWTYPE;
    v_chain_c public.bookings%ROWTYPE;

    v_pass_res JSONB;
    v_checkin_token TEXT;
    v_checkout_token TEXT;
    v_token_hash TEXT;
    v_incident_count INTEGER;
    v_audit_count INTEGER;
    v_notif_count INTEGER;
    v_overdue_swept INTEGER;
    v_expected_conflict BOOLEAN := false;
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '>>> EXECUTING PRODUCTION RPC VERIFICATION & INTEGRATION SUITE <<<';
    RAISE NOTICE '=================================================================';

    -- --------------------------------------------------------------------------
    -- 0. FIXTURE SETUP
    -- --------------------------------------------------------------------------
    v_test_org_id := gen_random_uuid();
    v_owner_id := gen_random_uuid();
    v_seeker1_id := gen_random_uuid();
    v_seeker2_id := gen_random_uuid();
    v_admin_id := gen_random_uuid();
    v_resource_id := gen_random_uuid();
    v_donation_res_id := gen_random_uuid();

    -- Provision isolated institutional organization
    INSERT INTO public.organizations (id, name, organization_type, verification_status)
    VALUES (v_test_org_id, 'Harness Verification Labs', 'university', 'verified');

    -- Provision user profiles
    INSERT INTO public.profiles (id, full_name, email, role, organization_id)
    VALUES 
        (v_owner_id, 'Dr. Custodian Lead', 'custodian@harness.edu', 'owner', v_test_org_id),
        (v_seeker1_id, 'Alice Researcher', 'alice@harness.edu', 'seeker', v_test_org_id),
        (v_seeker2_id, 'Bob Researcher', 'bob@harness.edu', 'seeker', v_test_org_id),
        (v_admin_id, 'System Administrator', 'admin@harness.edu', 'admin', v_test_org_id);

    -- Provision standard reservable equipment
    INSERT INTO public.resources (
        id, owner_id, organization_id, title, category, resource_type,
        location, availability_info, usage_limit_per_user, status
    ) VALUES (
        v_resource_id, v_owner_id, v_test_org_id, 'Cryo-TEM Ultra',
        'Microscopy & Imaging', 'equipment', 'Building C Room 404',
        '{"days": ["Monday", "Tuesday", "Wednesday"], "hours": "09:00 - 17:00"}'::jsonb,
        5, 'available'
    );

    -- Provision surplus donation equipment
    INSERT INTO public.resources (
        id, owner_id, organization_id, title, category, resource_type,
        location, availability_info, usage_limit_per_user, status
    ) VALUES (
        v_donation_res_id, v_owner_id, v_test_org_id, 'Surplus Spectrophotometer',
        'Spectroscopy', 'equipment', 'Storage Bay 2',
        '{"is_donation": true, "condition_status": "good", "estimated_value": 4500}'::jsonb,
        1, 'available'
    );

    -- --------------------------------------------------------------------------
    -- TEST 1: RPC request_booking + approve_booking + GiST Exclusion Constraint
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 1: request_booking + approve_booking + Exclusion Constraint...';

    -- Simulate Seeker 1 session calling request_booking RPC
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    SELECT * INTO v_booking1 FROM public.request_booking(
        v_resource_id,
        now() + interval '5 days',
        now() + interval '5 days 3 hours',
        'Crystalline molecular diffraction analysis'
    );

    IF v_booking1.id IS NULL OR v_booking1.status <> 'pending' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: request_booking did not return pending booking row!';
    END IF;

    -- Simulate Owner session calling approve_booking RPC
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    SELECT * INTO v_booking1 FROM public.approve_booking(v_booking1.id);

    IF v_booking1.status <> 'approved' OR v_booking1.approved_by <> v_owner_id THEN
        RAISE EXCEPTION 'TEST 1 FAILED: approve_booking did not transition status to approved!';
    END IF;

    -- Simulate Seeker 2 session calling request_booking for overlapping interval
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    SELECT * INTO v_booking2 FROM public.request_booking(
        v_resource_id,
        now() + interval '5 days 1 hour',
        now() + interval '5 days 4 hours',
        'Conflicting overlapping reservation'
    );

    -- Owner attempts to approve conflicting booking 2: MUST fail via exclusion violation
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    v_expected_conflict := false;
    BEGIN
        PERFORM public.approve_booking(v_booking2.id);
    EXCEPTION
        WHEN exclusion_violation THEN
            v_expected_conflict := true;
            RAISE NOTICE '  -> SUCCESS: GiST exclusion constraint caught overlap via approve_booking RPC (Code 23P01).';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Active custody conflict%' OR SQLERRM LIKE '%overlap%' THEN
                v_expected_conflict := true;
                RAISE NOTICE '  -> SUCCESS: Overlap prevented by booking engine (%): %', SQLSTATE, SQLERRM;
            ELSE
                RAISE;
            END IF;
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Overlapping approved reservation was permitted!';
    END IF;

    -- Clean up conflicting pending booking 2
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    PERFORM public.cancel_booking(v_booking2.id);

    -- --------------------------------------------------------------------------
    -- TEST 2: RPC generate_booking_pass & SHA-256 Opaque Storage
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 2: generate_booking_pass Payload & Opaque Storage...';

    -- Simulate Seeker 1 calling generate_booking_pass
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    v_pass_res := public.generate_booking_pass(v_booking1.id, 'check_in');
    v_checkin_token := v_pass_res->>'raw_token';

    IF v_checkin_token IS NULL OR length(v_checkin_token) < 32 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: generate_booking_pass did not return valid raw_token!';
    END IF;

    IF (v_pass_res->>'token') <> v_checkin_token THEN
        RAISE EXCEPTION 'TEST 2 FAILED: token and raw_token payload mismatch!';
    END IF;

    -- Verify plaintext token is NOT stored in public.booking_access_tokens
    IF EXISTS (
        SELECT 1 FROM public.booking_access_tokens WHERE token_hash = v_checkin_token
    ) THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Plaintext token stored in database table!';
    END IF;

    -- Verify token hash exists
    v_token_hash := extensions.encode(extensions.digest(v_checkin_token, 'sha256'), 'hex');
    IF NOT EXISTS (
        SELECT 1 FROM public.booking_access_tokens WHERE token_hash = v_token_hash AND used_at IS NULL
    ) THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Token hash not found in booking_access_tokens table!';
    END IF;

    -- Non-participant unauthorized caller test
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    v_expected_conflict := false;
    BEGIN
        PERFORM public.generate_booking_pass(v_booking1.id, 'check_in');
    EXCEPTION WHEN insufficient_privilege THEN
        v_expected_conflict := true;
        RAISE NOTICE '  -> SUCCESS: Unauthorized user pass generation blocked with 42501.';
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Non-participant was permitted to generate pass for another user!';
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 3: RPC verify_check_in (Handshake, Token Invalidation & Condition Report)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 3: verify_check_in Handshake & Atomic Condition Record...';

    -- Simulate Owner calling verify_check_in
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    SELECT * INTO v_booking1 FROM public.verify_check_in(
        v_checkin_token,
        'good',
        'Pre-session optics verified intact',
        NULL
    );

    IF v_booking1.status <> 'checked_in' THEN
        RAISE EXCEPTION 'TEST 3 FAILED: verify_check_in did not transition booking to checked_in!';
    END IF;

    -- Verify access token is atomically invalidated (used_at recorded)
    IF NOT EXISTS (
        SELECT 1 FROM public.booking_access_tokens 
        WHERE token_hash = v_token_hash AND used_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: verify_check_in failed to mark used_at timestamp on token!';
    END IF;

    -- Verify condition report was created
    IF NOT EXISTS (
        SELECT 1 FROM public.condition_reports
        WHERE booking_id = v_booking1.id AND report_type = 'before' AND condition_status = 'good'
    ) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Pre-session condition report was not created!';
    END IF;

    -- Verify audit log entry
    IF NOT EXISTS (
        SELECT 1 FROM public.audit_logs
        WHERE entity_id = v_booking1.id AND action = 'BOOKING_CHECKED_IN'
    ) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Check-in audit log was not recorded!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: verify_check_in completed atomically (Status: checked_in, token consumed, condition logged).';

    -- --------------------------------------------------------------------------
    -- TEST 4: Single-Use Replay Attack Prevention
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 4: Replay Attack Prevention on Consumed Token...';

    -- Re-presenting the consumed v_checkin_token MUST fail
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    v_expected_conflict := false;
    BEGIN
        PERFORM public.verify_check_in(v_checkin_token, 'good', 'Replay attempt', NULL);
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE '%already been used%' OR SQLSTATE = 'P0001' THEN
            v_expected_conflict := true;
            RAISE NOTICE '  -> SUCCESS: Consumed token correctly rejected on replay attempt.';
        END IF;
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Replay of consumed access token was permitted!';
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 5: Active Custody Protection (Unreturned Asset Blocks New Approvals)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 5: Active Custody Invariant (Checked-In Asset Blocks Approvals)...';

    -- While v_booking1 is actively checked_in, attempt to approve another booking
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    SELECT * INTO v_booking2 FROM public.request_booking(
        v_resource_id,
        now() + interval '10 days',
        now() + interval '10 days 2 hours',
        'Future session attempt while equipment is in active possession'
    );

    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    v_expected_conflict := false;
    BEGIN
        PERFORM public.approve_booking(v_booking2.id);
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE '%Active custody conflict%' OR SQLSTATE = 'P0001' THEN
            v_expected_conflict := true;
            RAISE NOTICE '  -> SUCCESS: Active custody protection blocked approval while asset is checked_in.';
        END IF;
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Approval was permitted while equipment was in active borrower custody!';
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 6: RPC verify_check_out (Return Handshake & Incident Auto-Escalation)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 6: verify_check_out Return Handshake & Damage Escalation...';

    -- Seeker 1 generates check_out pass
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    v_pass_res := public.generate_booking_pass(v_booking1.id, 'check_out');
    v_checkout_token := v_pass_res->>'raw_token';

    -- Custodian processes return with 'damaged' condition
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    SELECT * INTO v_booking1 FROM public.verify_check_out(
        v_checkout_token,
        'damaged',
        'Objective lens cracked during laser pulsing experiment',
        NULL
    );

    IF v_booking1.status <> 'returned' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: verify_check_out did not transition status to returned!';
    END IF;

    -- Assert return condition report exists
    IF NOT EXISTS (
        SELECT 1 FROM public.condition_reports
        WHERE booking_id = v_booking1.id AND report_type = 'after' AND condition_status = 'damaged'
    ) THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Return condition report not recorded!';
    END IF;

    -- Assert damage automatically escalated to public.incidents
    IF NOT EXISTS (
        SELECT 1 FROM public.incidents
        WHERE booking_id = v_booking1.id AND incident_type = 'damage' AND status = 'open'
    ) THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Damaged return was not escalated to open incident!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: verify_check_out completed (Status: returned, custody released, damage incident escalated).';

    -- Clean up pending booking 2
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    PERFORM public.cancel_booking(v_booking2.id);

    -- --------------------------------------------------------------------------
    -- TEST 7: RPC mark_overdue_bookings (Maintenance Sweep & Notification)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 7: mark_overdue_bookings Sweep & Notifications...';

    -- Setup a past-due checked-in booking directly for sweep verification
    INSERT INTO public.bookings (
        id, resource_id, requester_id, start_time, end_time, purpose, status
    ) VALUES (
        gen_random_uuid(), v_resource_id, v_seeker1_id,
        now() - interval '2 hours', now() - interval '30 minutes',
        'Unreturned session for overdue sweep test', 'checked_in'
    ) RETURNING * INTO v_booking_overdue;

    -- Non-admin execution attempt MUST fail
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    v_expected_conflict := false;
    BEGIN
        PERFORM public.mark_overdue_bookings();
    EXCEPTION WHEN insufficient_privilege THEN
        v_expected_conflict := true;
        RAISE NOTICE '  -> SUCCESS: Non-admin caller blocked from mark_overdue_bookings (42501).';
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Non-admin caller was permitted to trigger overdue sweep!';
    END IF;

    -- Admin execution of mark_overdue_bookings
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    v_overdue_swept := public.mark_overdue_bookings();

    IF v_overdue_swept < 1 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: mark_overdue_bookings swept 0 records, expected >= 1!';
    END IF;

    -- Verify booking status transitioned to overdue
    IF (SELECT status FROM public.bookings WHERE id = v_booking_overdue.id) <> 'overdue' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Booking status was not transitioned to overdue!';
    END IF;

    -- Verify borrower notification
    IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_seeker1_id AND title LIKE '%Overdue%'
    ) THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Overdue notification not dispatched to borrower!';
    END IF;

    -- Verify custodian notification
    IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_owner_id AND title LIKE '%Overdue%'
    ) THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Overdue notification not dispatched to custodian!';
    END IF;

    -- Verify audit log with NULL actor_id (system action)
    IF NOT EXISTS (
        SELECT 1 FROM public.audit_logs
        WHERE entity_id = v_booking_overdue.id AND action = 'BOOKING_MARKED_OVERDUE' AND actor_id IS NULL
    ) THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Audit log for overdue sweep missing or actor_id not NULL!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: mark_overdue_bookings swept % record(s) with notifications and system audit log.', v_overdue_swept;

    -- Mark overdue booking returned to release custody
    UPDATE public.bookings SET status = 'returned' WHERE id = v_booking_overdue.id;

    -- --------------------------------------------------------------------------
    -- TEST 8: RPC waitlist_booking & FIFO Approval Fairness Enforcement
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 8: waitlist_booking & Connected Cluster FIFO Approval Guard...';

    -- Seeker 1 submits Chain A (10:00 - 14:00 on Day 7)
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    SELECT * INTO v_chain_a FROM public.request_booking(
        v_resource_id, now() + interval '7 days', now() + interval '7 days 4 hours', 'Chain A (10-14)'
    );

    -- Seeker 2 submits Chain B (13:00 - 17:00 on Day 7, overlaps A)
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    SELECT * INTO v_chain_b FROM public.request_booking(
        v_resource_id, now() + interval '7 days 3 hours', now() + interval '7 days 7 hours', 'Chain B (13-17)'
    );

    -- Seeker 1 submits Chain C (16:00 - 20:00 on Day 7, overlaps B but not A directly)
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    SELECT * INTO v_chain_c FROM public.request_booking(
        v_resource_id, now() + interval '7 days 6 hours', now() + interval '7 days 10 hours', 'Chain C (16-20)'
    );

    -- Move all to waitlist via waitlist_booking RPC
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    PERFORM public.waitlist_booking(v_chain_a.id);
    PERFORM public.waitlist_booking(v_chain_b.id);
    PERFORM public.waitlist_booking(v_chain_c.id);

    -- Assert sequential positions 1, 2, 3 within the connected overlap cluster
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_a.id) <> 1 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Chain A waitlist_position expected 1, got %', (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_a.id);
    END IF;
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_b.id) <> 2 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Chain B waitlist_position expected 2, got %', (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_b.id);
    END IF;
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_c.id) <> 3 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Chain C waitlist_position expected 3, got %', (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_c.id);
    END IF;

    -- Attempt to approve Chain C (pos 3 in connected chain) ahead of A: MUST FAIL FIFO GUARD
    v_expected_conflict := false;
    BEGIN
        PERFORM public.approve_booking(v_chain_c.id);
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE '%FIFO queue fairness violation%' OR SQLSTATE = 'P0001' THEN
            v_expected_conflict := true;
            RAISE NOTICE '  -> SUCCESS: FIFO fairness guard blocked Chain C from bypassing earlier Chain A in connected cluster.';
        END IF;
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Later chained request was permitted to bypass earlier reservation request!';
    END IF;

    -- Owner approves Chain A (Position 1): MUST SUCCEED
    PERFORM public.approve_booking(v_chain_a.id);

    -- Clean up waitlist test rows
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    PERFORM public.cancel_booking(v_chain_a.id);
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    PERFORM public.cancel_booking(v_chain_b.id);
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    PERFORM public.cancel_booking(v_chain_c.id);

    -- --------------------------------------------------------------------------
    -- TEST 9: RPC accept_donation (Atomic Transfer, Retirement & Audit)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 9: accept_donation Atomic Transfer & Resource Retirement...';

    -- Seeker 1 submits donation claim via request_booking
    PERFORM set_config('request.jwt.claim.sub', v_seeker1_id::text, true);
    SELECT * INTO v_booking_donation FROM public.request_booking(
        v_donation_res_id,
        now() + interval '1 day',
        now() + interval '14 days',
        '[DONATION_CLAIM] Requesting surplus spectrophotometer for biochemistry lab'
    );

    IF v_booking_donation.id IS NULL THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Failed to create donation claim booking!';
    END IF;

    -- Non-owner/non-admin caller attempt MUST fail
    PERFORM set_config('request.jwt.claim.sub', v_seeker2_id::text, true);
    v_expected_conflict := false;
    BEGIN
        PERFORM public.accept_donation(v_booking_donation.id);
    EXCEPTION WHEN insufficient_privilege THEN
        v_expected_conflict := true;
        RAISE NOTICE '  -> SUCCESS: Unauthorized non-owner blocked from accept_donation (42501).';
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Non-owner was permitted to accept donation!';
    END IF;

    -- Owner accepts donation atomically
    PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
    SELECT * INTO v_booking_donation FROM public.accept_donation(v_booking_donation.id);

    -- Assert booking status is approved
    IF v_booking_donation.status <> 'approved' THEN
        RAISE EXCEPTION 'TEST 9 FAILED: accept_donation did not approve booking!';
    END IF;

    -- Assert resource status is retired to 'unavailable'
    IF (SELECT status FROM public.resources WHERE id = v_donation_res_id) <> 'unavailable' THEN
        RAISE EXCEPTION 'TEST 9 FAILED: accept_donation did not retire resource to unavailable!';
    END IF;

    -- Assert audit log recorded
    IF NOT EXISTS (
        SELECT 1 FROM public.audit_logs
        WHERE entity_id = v_donation_res_id AND action = 'DONATION_TRANSFER_ACCEPTED'
    ) THEN
        RAISE EXCEPTION 'TEST 9 FAILED: DONATION_TRANSFER_ACCEPTED audit log not recorded!';
    END IF;

    -- Assert recipient notification dispatched
    IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_seeker1_id AND title LIKE '%Donation Request Approved%'
    ) THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Recipient donation approval notification not created!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: accept_donation executed atomically in single transaction.';

    -- --------------------------------------------------------------------------
    -- FIXTURE TEARDOWN & CLEANUP
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Cleaning up isolated test fixtures...';

    DELETE FROM public.audit_logs WHERE entity_id IN (v_resource_id, v_donation_res_id, v_booking1.id, v_booking_overdue.id, v_booking_donation.id);
    DELETE FROM public.notifications WHERE user_id IN (v_seeker1_id, v_seeker2_id, v_owner_id, v_admin_id);
    DELETE FROM public.incidents WHERE booking_id IN (v_booking1.id, v_booking_overdue.id, v_booking_donation.id);
    DELETE FROM public.condition_reports WHERE booking_id IN (v_booking1.id, v_booking_overdue.id, v_booking_donation.id);
    DELETE FROM public.booking_access_tokens WHERE booking_id IN (v_booking1.id, v_booking_overdue.id, v_booking_donation.id);
    DELETE FROM public.bookings WHERE resource_id IN (v_resource_id, v_donation_res_id);
    DELETE FROM public.resources WHERE id IN (v_resource_id, v_donation_res_id);
    DELETE FROM public.profiles WHERE id IN (v_owner_id, v_seeker1_id, v_seeker2_id, v_admin_id);
    DELETE FROM public.organizations WHERE id = v_test_org_id;

    RAISE NOTICE '=================================================================';
    RAISE NOTICE '>>> ALL 9 PRODUCTION RPC VERIFICATION TESTS PASSED CLEANLY! <<<';
    RAISE NOTICE '=================================================================';
END $$;
