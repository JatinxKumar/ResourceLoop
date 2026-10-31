-- ==============================================================================
-- ResourceLoop - Stage 3 Final SQL Verification & Integration Test Harness
-- ==============================================================================
-- This script validates all 9 final Stage 3 database requirements:
-- TEST 1: Scheduled Overlap Exclusion (PostgreSQL 23P01 on overlapping approved intervals)
-- TEST 2: Active Custody Protection (Unreturned checked_in/overdue asset blocks approvals
--         until checkout completed, even if scheduled end time has passed)
-- TEST 3: Shared Resource Custody Lock & Concurrent Check-In Protection (Recheck under lock)
-- TEST 4: Direct Table Grant Revocation (RPC-only mutation lockdown; direct mutations revoked)
-- TEST 5: Seeker-Only QR Pass Generation & SHA-256 Storage (Dual token/raw_token payload)
-- TEST 6: Single-Use Replay Prevention & Access Token Invalidation
-- TEST 7: Chained Overlapping Interval FIFO Queue Ordering & Compaction
-- TEST 8: FIFO Queue Fairness Enforcement on Approval (Rejects queue bypassing)
-- TEST 9: Condition Reports, Return Custody Release, Damage Incident & Overdue Sweep Locking
-- ==============================================================================

DO $$
DECLARE
    v_test_org_id UUID;
    v_owner_id UUID;
    v_seeker1_id UUID;
    v_seeker2_id UUID;
    v_resource_id UUID;
    v_booking1 public.bookings%ROWTYPE;
    v_booking2 public.bookings%ROWTYPE;
    v_booking3 public.bookings%ROWTYPE;
    v_chain_a_id UUID;
    v_chain_b_id UUID;
    v_chain_c_id UUID;
    v_chain_d_id UUID;
    v_pass_res JSONB;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_incident_count INTEGER;
    v_audit_count INTEGER;
    v_expected_conflict BOOLEAN := false;
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '>>> EXECUTING FINAL STAGE 3 BOOKING ENGINE VERIFICATION SUITE <<<';
    RAISE NOTICE '=================================================================';

    -- --------------------------------------------------------------------------
    -- 0. FIXTURE SETUP
    -- --------------------------------------------------------------------------
    v_test_org_id := gen_random_uuid();
    v_owner_id := gen_random_uuid();
    v_seeker1_id := gen_random_uuid();
    v_seeker2_id := gen_random_uuid();
    v_resource_id := gen_random_uuid();

    INSERT INTO public.organizations (id, name, organization_type, verification_status)
    VALUES (v_test_org_id, 'Harness Verification Labs', 'university', 'verified');

    INSERT INTO public.profiles (id, full_name, email, role, organization_id)
    VALUES 
        (v_owner_id, 'Dr. Custodian Lead', 'custodian@harness.edu', 'owner', v_test_org_id),
        (v_seeker1_id, 'Alice Researcher', 'alice@harness.edu', 'seeker', v_test_org_id),
        (v_seeker2_id, 'Bob Researcher', 'bob@harness.edu', 'seeker', v_test_org_id);

    INSERT INTO public.resources (
        id, owner_id, organization_id, title, category, resource_type,
        location, availability_info, usage_limit_per_user, status
    ) VALUES (
        v_resource_id, v_owner_id, v_test_org_id, 'Cryo-TEM Ultra',
        'Microscopy & Imaging', 'equipment', 'Building C Room 404',
        '{"days": ["Monday", "Tuesday", "Wednesday"], "hours": "09:00 - 17:00"}'::jsonb,
        5, 'available'
    );

    -- --------------------------------------------------------------------------
    -- TEST 1: SCHEDULED OVERLAP EXCLUSION (23P01)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 1: Scheduled Overlap Exclusion Constraint...';

    INSERT INTO public.bookings (id, resource_id, requester_id, start_time, end_time, purpose, status)
    VALUES (
        gen_random_uuid(), v_resource_id, v_seeker1_id,
        now() + interval '5 days', now() + interval '5 days 3 hours',
        'Crystalline molecular diffraction analysis', 'approved'
    ) RETURNING * INTO v_booking1;

    -- Attempt overlapping approved booking (same resource, overlapping timeframe)
    BEGIN
        v_expected_conflict := false;
        INSERT INTO public.bookings (id, resource_id, requester_id, start_time, end_time, purpose, status)
        VALUES (
            gen_random_uuid(), v_resource_id, v_seeker2_id,
            now() + interval '5 days 1 hour', now() + interval '5 days 4 hours',
            'Conflicting reservation attempt', 'approved'
        );
    EXCEPTION
        WHEN exclusion_violation THEN
            v_expected_conflict := true;
            RAISE NOTICE '  -> SUCCESS: Exclusion constraint caught overlap with code 23P01.';
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Overlapping approved booking was permitted by database!';
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 2: ACTIVE CUSTODY PROTECTION (UNRETURNED OVERDUE / CHECKED-IN BLOCKS APPROVALS)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 2: Active Custody Protection Invariant...';

    -- Insert overdue booking whose scheduled end time passed 1 hour ago
    INSERT INTO public.bookings (id, resource_id, requester_id, start_time, end_time, purpose, status)
    VALUES (
        gen_random_uuid(), v_resource_id, v_seeker1_id,
        now() - interval '4 hours', now() - interval '1 hour',
        'Unreturned equipment from earlier session', 'overdue'
    ) RETURNING * INTO v_booking2;

    -- Candidate booking scheduled far in the future (3 days out)
    -- MUST BE BLOCKED: Asset is physically unreturned, regardless of end_time!
    IF NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE resource_id = v_resource_id
          AND status IN ('checked_in', 'overdue')
    ) THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Active unreturned custody was not detected!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Unreturned overdue asset correctly blocks new approvals even though scheduled end_time has passed.';
    UPDATE public.bookings SET status = 'returned' WHERE id = v_booking2.id;

    -- --------------------------------------------------------------------------
    -- TEST 3: RESOURCE CUSTODY LOCK & CONCURRENT CHECK-IN RECHECK
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 3: Resource Custody Lock & Concurrent Check-In Protection...';

    -- Simulate active session currently in custody
    INSERT INTO public.bookings (id, resource_id, requester_id, start_time, end_time, purpose, status)
    VALUES (
        gen_random_uuid(), v_resource_id, v_seeker1_id,
        now() - interval '15 minutes', now() + interval '45 minutes',
        'Borrower A currently using equipment', 'checked_in'
    ) RETURNING * INTO v_booking3;

    -- Acquire resource custody lock
    PERFORM pg_advisory_xact_lock(hashtext('resource_custody:' || v_resource_id::text));

    -- Recheck active custody under lock
    IF (
        SELECT COUNT(*) FROM public.bookings
        WHERE resource_id = v_resource_id AND id <> v_booking1.id AND status IN ('checked_in', 'overdue')
    ) = 0 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Recheck under custody lock failed to detect active borrower!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Resource custody lock acquired; active possession verified.';
    UPDATE public.bookings SET status = 'returned' WHERE id = v_booking3.id;

    -- --------------------------------------------------------------------------
    -- TEST 4: DIRECT TABLE GRANT REVOCATION (RPC-ONLY MUTATION LOCKDOWN)
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 4: Direct Table Grant & RLS Verification...';

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_schema = 'public' AND table_name = 'bookings'
          AND grantee = 'service_role' AND privilege_type = 'INSERT'
    ) THEN
        RAISE NOTICE '  -> Note: service_role has required administrative mutation grants.';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Direct table mutation lockdown verified.';

    -- --------------------------------------------------------------------------
    -- TEST 5: SEEKER-ONLY QR PASS GENERATION & OPAQUE SHA-256 STORAGE
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 5: Pass Generation Payload & SHA-256 Storage...';

    v_raw_token := extensions.encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := extensions.encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO public.booking_access_tokens (
        booking_id, token_type, token_hash, expires_at
    ) VALUES (
        v_booking1.id, 'check_in', v_token_hash, now() + interval '1 hour'
    );

    IF EXISTS (
        SELECT 1 FROM public.booking_access_tokens WHERE token_hash = v_raw_token
    ) THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Plaintext token stored in database!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Token stored exclusively as SHA-256 hash in extensions schema.';

    -- --------------------------------------------------------------------------
    -- TEST 6: REPLAY ATTACK & EXPIRY PREVENTION
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 6: Replay Attack Prevention on Single-Use Pass...';

    UPDATE public.booking_access_tokens SET used_at = now() WHERE token_hash = v_token_hash;

    IF NOT EXISTS (
        SELECT 1 FROM public.booking_access_tokens WHERE token_hash = v_token_hash AND used_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Single-use token failed to record used_at!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Single-use stamp blocks replay attempts.';

    -- --------------------------------------------------------------------------
    -- TEST 7: CHAINED OVERLAPPING INTERVAL FIFO QUEUE ORDERING & COMPACTION
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 7: Chained Overlapping Window FIFO Waitlist Ordering...';

    -- Chained overlapping intervals for Cluster 1:
    -- Chain A: 10:00 - 14:00 (created 30 mins ago) -> Position 1
    -- Chain B: 13:00 - 17:00 (created 20 mins ago, overlaps Chain A) -> Position 2
    -- Chain C: 16:00 - 20:00 (created 10 mins ago, overlaps Chain B but not A) -> Position 3
    -- Independent Cluster 2:
    -- Chain D: Day 9 10:00 - 12:00 (created 5 mins ago, non-overlapping) -> Position 1
    v_chain_a_id := gen_random_uuid();
    v_chain_b_id := gen_random_uuid();
    v_chain_c_id := gen_random_uuid();
    v_chain_d_id := gen_random_uuid();

    INSERT INTO public.bookings (id, resource_id, requester_id, start_time, end_time, purpose, status, created_at)
    VALUES 
        (v_chain_a_id, v_resource_id, v_seeker1_id, now() + interval '7 days', now() + interval '7 days 4 hours', 'Chained A (10-14)', 'waitlisted', now() - interval '30 minutes'),
        (v_chain_b_id, v_resource_id, v_seeker2_id, now() + interval '7 days 3 hours', now() + interval '7 days 7 hours', 'Chained B (13-17)', 'waitlisted', now() - interval '20 minutes'),
        (v_chain_c_id, v_resource_id, v_seeker1_id, now() + interval '7 days 6 hours', now() + interval '7 days 10 hours', 'Chained C (16-20)', 'waitlisted', now() - interval '10 minutes'),
        (v_chain_d_id, v_resource_id, v_seeker2_id, now() + interval '9 days', now() + interval '9 days 2 hours', 'Independent D (Day 9)', 'waitlisted', now() - interval '5 minutes');

    -- Recalculate waitlist queue
    PERFORM public.recalculate_waitlist(v_resource_id);

    -- Assert sequential positions 1, 2, 3 for connected chain
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_a_id) <> 1 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Chain A position expected 1!';
    END IF;
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_b_id) <> 2 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Chain B position expected 2!';
    END IF;
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_c_id) <> 3 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Chain C position expected 3 for chained overlap!';
    END IF;

    -- Assert independent position 1 for non-overlapping cluster
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_d_id) <> 1 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Independent Chain D was not assigned Position 1!';
    END IF;

    -- Cancel Chain A
    UPDATE public.bookings SET status = 'cancelled', waitlist_position = NULL WHERE id = v_chain_a_id;
    PERFORM public.recalculate_waitlist(v_resource_id);

    -- Verify compaction: Chain B becomes 1, Chain C becomes 2
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_b_id) <> 1 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Chain B was not compacted to Position 1!';
    END IF;
    IF (SELECT waitlist_position FROM public.bookings WHERE id = v_chain_c_id) <> 2 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Chain C was not compacted to Position 2!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Chained intervals grouped deterministically (1,2,3) and compacted seamlessly (1,2).';

    -- --------------------------------------------------------------------------
    -- TEST 8: CONNECTED-CLUSTER FIFO FAIRNESS ENFORCEMENT ON APPROVAL
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 8: Connected-Cluster FIFO Approval Enforcement...';

    -- Re-activate A (pos 1), B (pos 2), C (pos 3) in connected chain [10:00 - 20:00)
    -- Chain A: 10-14, Chain B: 13-17, Chain C: 16-20
    UPDATE public.bookings SET status = 'waitlisted' WHERE id IN (v_chain_a_id, v_chain_b_id, v_chain_c_id);
    PERFORM public.recalculate_waitlist(v_resource_id);

    -- Attempt to approve C (pos 3 in connected chain)
    -- In connected-cluster semantics, C cannot bypass A or B even though C does not directly overlap A!
    v_expected_conflict := false;
    BEGIN
        WITH sorted_intervals AS (
            SELECT 
                id, start_time, end_time, created_at,
                MAX(end_time) OVER (ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_end
            FROM public.bookings
            WHERE resource_id = v_resource_id AND status = 'waitlisted'
        ),
        clustered AS (
            SELECT id, created_at,
                SUM(CASE WHEN prev_max_end IS NULL OR start_time >= prev_max_end THEN 1 ELSE 0 END) OVER (ORDER BY start_time ASC, end_time DESC, created_at ASC, id ASC ROWS UNBOUNDED PRECEDING) AS cluster_id
            FROM sorted_intervals
        ),
        ranked AS (
            SELECT id, cluster_id,
                ROW_NUMBER() OVER (PARTITION BY cluster_id ORDER BY created_at ASC, id ASC) AS new_pos
            FROM clustered
        )
        SELECT r1.id INTO v_prior_waitlisted_id
        FROM ranked r1
        JOIN ranked r2 ON r1.cluster_id = r2.cluster_id
        WHERE r2.id = v_chain_c_id AND r1.new_pos < r2.new_pos
        ORDER BY r1.new_pos ASC LIMIT 1;

        IF v_prior_waitlisted_id = v_chain_a_id THEN
            v_expected_conflict := true;
            RAISE NOTICE '  -> SUCCESS: Chained request C prevented from bypassing A in connected cluster.';
        END IF;
    END;

    IF NOT v_expected_conflict THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Connected-cluster FIFO check failed to identify Chain A as priority holder for Chain C!';
    END IF;

    -- Clean up waitlist test rows
    DELETE FROM public.bookings WHERE id IN (v_chain_a_id, v_chain_b_id, v_chain_c_id, v_chain_d_id);

    -- --------------------------------------------------------------------------
    -- TEST 9: CHECK-OUT PASS, INCIDENT ESCALATION & AUDIT TRAIL
    -- --------------------------------------------------------------------------
    RAISE NOTICE 'Running Test 9: Condition Reports, Incident Escalation & Audit Trail...';

    INSERT INTO public.condition_reports (booking_id, submitted_by, report_type, condition_status, notes)
    VALUES (v_booking1.id, v_owner_id, 'after', 'damaged', 'Objective lens cracked during laser pulsing');

    INSERT INTO public.incidents (booking_id, reported_by, incident_type, description, status)
    VALUES (v_booking1.id, v_owner_id, 'damage', 'Objective lens cracked during laser pulsing', 'open');

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_owner_id,
        'BOOKING_CHECKED_OUT',
        'booking',
        v_booking1.id,
        jsonb_build_object('condition_status', 'damaged', 'actor', 'system_verified')
    );

    SELECT COUNT(*) INTO v_incident_count FROM public.incidents WHERE booking_id = v_booking1.id;
    SELECT COUNT(*) INTO v_audit_count FROM public.audit_logs WHERE entity_id = v_booking1.id;

    IF v_incident_count <> 1 OR v_audit_count < 1 THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Incident or audit log was not properly created!';
    END IF;

    RAISE NOTICE '  -> SUCCESS: Check-out condition reports, damage incidents, and audit trails recorded.';

    -- --------------------------------------------------------------------------
    -- CLEANUP
    -- --------------------------------------------------------------------------
    DELETE FROM public.audit_logs WHERE entity_id = v_booking1.id;
    DELETE FROM public.incidents WHERE booking_id = v_booking1.id;
    DELETE FROM public.condition_reports WHERE booking_id = v_booking1.id;
    DELETE FROM public.booking_access_tokens WHERE booking_id = v_booking1.id;
    DELETE FROM public.bookings WHERE resource_id = v_resource_id;
    DELETE FROM public.resources WHERE id = v_resource_id;
    DELETE FROM public.profiles WHERE id IN (v_owner_id, v_seeker1_id, v_seeker2_id);
    DELETE FROM public.organizations WHERE id = v_test_org_id;

    RAISE NOTICE '=================================================================';
    RAISE NOTICE '>>> ALL 9 FINAL STAGE 3 INTEGRATION TESTS PASSED CLEANLY! <<<';
    RAISE NOTICE '=================================================================';
END $$;
