-- ==============================================================================
-- ResourceLoop - Smart Institutional Resource Sharing Network
-- Database Seed: seed.sql
-- Fictional Demonstration Data for Supabase
-- NOTE: Uses purely fictional academic institutions, personas, and equipment.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEED AUTH USERS (Supabase auth.users)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_admin_id  UUID := 'a0000000-0000-0000-0000-000000000001';
    v_owner1_id UUID := 'b0000000-0000-0000-0000-000000000002';
    v_owner2_id UUID := 'b0000000-0000-0000-0000-000000000003';
    v_seeker1_id UUID := 'c0000000-0000-0000-0000-000000000004';
    v_seeker2_id UUID := 'c0000000-0000-0000-0000-000000000005';
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES
        (
            '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
            'admin@resourceloop.institution.test', crypt('DemoPass123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Aris Thorne"}', now(), now()
        ),
        (
            '00000000-0000-0000-0000-000000000000', v_owner1_id, 'authenticated', 'authenticated',
            'h.vance@resourceloop.institution.test', crypt('DemoPass123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Prof. Helena Vance"}', now(), now()
        ),
        (
            '00000000-0000-0000-0000-000000000000', v_owner2_id, 'authenticated', 'authenticated',
            'k.chen@resourceloop.institution.test', crypt('DemoPass123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Kaelen Chen"}', now(), now()
        ),
        (
            '00000000-0000-0000-0000-000000000000', v_seeker1_id, 'authenticated', 'authenticated',
            'm.lin@resourceloop.institution.test', crypt('DemoPass123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Maya Lin"}', now(), now()
        ),
        (
            '00000000-0000-0000-0000-000000000000', v_seeker2_id, 'authenticated', 'authenticated',
            't.almansoor@resourceloop.institution.test', crypt('DemoPass123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"full_name":"Tariq Al-Mansoor"}', now(), now()
        )
        -- Also seed auth.identities so password sign-in works seamlessly for demo accounts
        IF EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities'
        ) THEN
            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
            ) VALUES
            (
                v_admin_id, v_admin_id,
                jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@resourceloop.institution.test', 'email_verified', true),
                'email', now(), now(), now()
            ),
            (
                v_owner1_id, v_owner1_id,
                jsonb_build_object('sub', v_owner1_id::text, 'email', 'h.vance@resourceloop.institution.test', 'email_verified', true),
                'email', now(), now(), now()
            ),
            (
                v_owner2_id, v_owner2_id,
                jsonb_build_object('sub', v_owner2_id::text, 'email', 'k.chen@resourceloop.institution.test', 'email_verified', true),
                'email', now(), now(), now()
            ),
            (
                v_seeker1_id, v_seeker1_id,
                jsonb_build_object('sub', v_seeker1_id::text, 'email', 'm.lin@resourceloop.institution.test', 'email_verified', true),
                'email', now(), now(), now()
            ),
            (
                v_seeker2_id, v_seeker2_id,
                jsonb_build_object('sub', v_seeker2_id::text, 'email', 't.almansoor@resourceloop.institution.test', 'email_verified', true),
                'email', now(), now(), now()
            )
            ON CONFLICT (provider, id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SEED ORGANIZATIONS
-- ------------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, organization_type, description, address, verification_status, created_at)
VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Apex Institute of Advanced Technology',
    'university',
    'Leading technological university specializing in nanotech, advanced materials, and computer engineering.',
    'Building 4, Science & Innovation Campus, West Corridor',
    'verified',
    now() - INTERVAL '60 days'
),
(
    '22222222-2222-2222-2222-222222222222',
    'Nova Quantum & Photonics Laboratory',
    'research_lab',
    'Inter-institutional research facility focused on optical quantum computing and ultra-fast laser dynamics.',
    'Suite 300, Technology Research Quad, East Campus',
    'verified',
    now() - INTERVAL '45 days'
),
(
    '33333333-3333-3333-3333-333333333333',
    'BioSynthetica Genomic Center',
    'institute',
    'National collaborative center for macromolecular NMR and high-throughput molecular analysis.',
    'Biomedical Innovation Tower, 8th Floor, North Wing',
    'verified',
    now() - INTERVAL '30 days'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. SEED PROFILES
-- ------------------------------------------------------------------------------
-- Temporarily disable role guard trigger during bulk seeding
ALTER TABLE public.profiles DISABLE TRIGGER trg_profiles_role_guard;

INSERT INTO public.profiles (id, full_name, email, role, organization_id, avatar_url, created_at)
VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'Dr. Aris Thorne',
    'admin@resourceloop.institution.test',
    'admin',
    '11111111-1111-1111-1111-111111111111',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    now() - INTERVAL '60 days'
),
(
    'b0000000-0000-0000-0000-000000000002',
    'Prof. Helena Vance',
    'h.vance@resourceloop.institution.test',
    'owner',
    '11111111-1111-1111-1111-111111111111',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    now() - INTERVAL '50 days'
),
(
    'b0000000-0000-0000-0000-000000000003',
    'Dr. Kaelen Chen',
    'k.chen@resourceloop.institution.test',
    'owner',
    '22222222-2222-2222-2222-222222222222',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    now() - INTERVAL '40 days'
),
(
    'c0000000-0000-0000-0000-000000000004',
    'Maya Lin',
    'm.lin@resourceloop.institution.test',
    'seeker',
    '11111111-1111-1111-1111-111111111111',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    now() - INTERVAL '25 days'
),
(
    'c0000000-0000-0000-0000-000000000005',
    'Tariq Al-Mansoor',
    't.almansoor@resourceloop.institution.test',
    'seeker',
    '33333333-3333-3333-3333-333333333333',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    now() - INTERVAL '20 days'
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id;

-- Re-enable role guard trigger
ALTER TABLE public.profiles ENABLE TRIGGER trg_profiles_role_guard;

-- ------------------------------------------------------------------------------
-- 4. SEED RESOURCES
-- ------------------------------------------------------------------------------
INSERT INTO public.resources (
    id, owner_id, organization_id, title, description, category, resource_type,
    location, image_url, availability_info, eligibility_requirements,
    training_required, usage_limit_per_user, status, created_at
) VALUES
(
    'aaaa0001-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Field Emission SEM (Hitachi SU5000 Sub-Nanometer)',
    'Variable pressure Schottky FE-SEM equipped with Oxford EDS detector. Suitable for non-conductive specimen imaging up to 500,000x.',
    'Microscopy & Imaging',
    'equipment',
    'Apex Materials Hall, Clean Room Sub-Level B12',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
    '{"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "hours": "08:00 - 20:00", "slot_duration_minutes": 120}'::jsonb,
    'Graduate student or postdoctoral researcher with verified basic electron beam safety certification.',
    true,
    3,
    'available',
    now() - INTERVAL '30 days'
),
(
    'aaaa0002-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'ISO Class 5 Cleanroom Microfabrication Bay A',
    'Lithography and thin-film deposition cleanroom equipped with mask aligner, spin coater, and laminar airflow stations.',
    'Cleanroom & Fabrication',
    'space',
    'Apex Innovation Complex, Room CR-101',
    'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
    '{"days": ["Monday", "Tuesday", "Wednesday", "Thursday"], "hours": "09:00 - 17:00", "slot_duration_minutes": 240}'::jsonb,
    'Certified ISO Class 5 gowning protocol and cleanroom safety training completed within past 12 months.',
    true,
    2,
    'available',
    now() - INTERVAL '28 days'
),
(
    'aaaa0003-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    '22222222-2222-2222-2222-222222222222',
    'Femtosecond Titanium-Sapphire Laser Spectrometer',
    'Tuneable 680-1080nm ultra-short pulse laser workstation for non-linear optical spectroscopy and pump-probe characterization.',
    'Photonics & Lasers',
    'equipment',
    'Nova Quantum Wing, Laser Lab 404',
    'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80',
    '{"days": ["Monday", "Wednesday", "Friday"], "hours": "10:00 - 18:00", "slot_duration_minutes": 180}'::jsonb,
    'Class 4 Laser Safety Operator certification required.',
    true,
    1,
    'available',
    now() - INTERVAL '20 days'
),
(
    'aaaa0004-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000003',
    '22222222-2222-2222-2222-222222222222',
    'Anechoic RF & Microwave Testing Chamber',
    'Shielded electromagnetic testing enclosure rated from 500 MHz to 40 GHz with calibrated horn antennas and network analyzer.',
    'Electromagnetics & RF',
    'space',
    'Nova Quantum Research Quad, Bay RF-02',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    '{"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "hours": "08:00 - 18:00", "slot_duration_minutes": 120}'::jsonb,
    'Open to all verified research students in engineering and physics.',
    false,
    4,
    'available',
    now() - INTERVAL '15 days'
),
(
    'aaaa0005-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'High-Field 800 MHz NMR Spectrometer',
    'Four-channel cryoprobe NMR system for biomolecular structural determination and chemical shift perturbation.',
    'Spectroscopy',
    'equipment',
    'BioCore Annex, Room S-104',
    'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=80',
    '{"days": ["Tuesday", "Thursday"], "hours": "09:00 - 17:00", "slot_duration_minutes": 240}'::jsonb,
    'Department head sign-off and specialized cryogen safety clearance.',
    true,
    1,
    'maintenance',
    now() - INTERVAL '10 days'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. SEED BOOKINGS
-- ------------------------------------------------------------------------------
INSERT INTO public.bookings (
    id, resource_id, requester_id, start_time, end_time, purpose, status, approved_by, rejection_reason, created_at
) VALUES
(
    'bbbb0001-0000-0000-0000-000000000001',
    'aaaa0001-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000004',
    now() - INTERVAL '3 days',
    now() - INTERVAL '3 days' + INTERVAL '2 hours',
    'High-resolution topographical imaging of silver nanowire transparent conducting meshes.',
    'returned',
    'b0000000-0000-0000-0000-000000000002',
    NULL,
    now() - INTERVAL '6 days'
),
(
    'bbbb0002-0000-0000-0000-000000000002',
    'aaaa0002-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    now() - INTERVAL '1 day',
    now() - INTERVAL '1 day' + INTERVAL '4 hours',
    'Photolithography patterning for microfluidic biosensor device fabrication.',
    'checked_in',
    'b0000000-0000-0000-0000-000000000002',
    NULL,
    now() - INTERVAL '4 days'
),
(
    'bbbb0003-0000-0000-0000-000000000003',
    'aaaa0003-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000005',
    now() + INTERVAL '2 days',
    now() + INTERVAL '2 days' + INTERVAL '3 hours',
    'Time-resolved photoluminescence characterization of 2D molybdenum disulfide quantum dots.',
    'approved',
    'b0000000-0000-0000-0000-000000000003',
    NULL,
    now() - INTERVAL '2 days'
),
(
    'bbbb0004-0000-0000-0000-000000000004',
    'aaaa0004-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000005',
    now() + INTERVAL '4 days',
    now() + INTERVAL '4 days' + INTERVAL '2 hours',
    'Antenna pattern radiation verification for miniature IoT sensor node prototype.',
    'pending',
    NULL,
    NULL,
    now() - INTERVAL '12 hours'
),
(
    'bbbb0005-0000-0000-0000-000000000005',
    'aaaa0001-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000005',
    now() - INTERVAL '7 days',
    now() - INTERVAL '7 days' + INTERVAL '2 hours',
    'Sample evaluation for magnetic nanoparticle clustering.',
    'rejected',
    'b0000000-0000-0000-0000-000000000002',
    'Operator training record for FE-SEM vacuum procedures is pending renewal. Please attend Tuesday safety clinic.',
    now() - INTERVAL '9 days'
),
(
    'bbbb0006-0000-0000-0000-000000000006',
    'aaaa0004-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000004',
    now() - INTERVAL '5 days',
    now() - INTERVAL '5 days' + INTERVAL '2 hours',
    'Preliminary microwave waveguide tuning session.',
    'cancelled',
    NULL,
    NULL,
    now() - INTERVAL '8 days'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. SEED CONDITION REPORTS
-- ------------------------------------------------------------------------------
INSERT INTO public.condition_reports (
    id, booking_id, submitted_by, report_type, condition_status, notes, image_url, created_at
) VALUES
(
    'cccc0001-0000-0000-0000-000000000001',
    'bbbb0001-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000004',
    'before',
    'excellent',
    'Chamber vacuum baseline verified at 1.2e-4 Pa. Objective lens clean and specimen holder standard 12mm stub mounted.',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80',
    now() - INTERVAL '3 days'
),
(
    'cccc0002-0000-0000-0000-000000000002',
    'bbbb0001-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000004',
    'after',
    'excellent',
    'Session completed without anomaly. Sample vented and removed. Beam column switched to standby and logged in bench register.',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80',
    now() - INTERVAL '3 days' + INTERVAL '2 hours'
),
(
    'cccc0003-0000-0000-0000-000000000003',
    'bbbb0002-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    'before',
    'good',
    'Cleanroom airflow gauge within ISO 5 thresholds. Spin coater bowl clean with fresh foil lining.',
    NULL,
    now() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. SEED INCIDENTS
-- ------------------------------------------------------------------------------
INSERT INTO public.incidents (
    id, booking_id, reported_by, incident_type, description, status, resolution_notes, created_at
) VALUES
(
    'dddd0001-0000-0000-0000-000000000001',
    'bbbb0001-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000004',
    'safety_hazard',
    'Nitrogen purge valve on auxiliary specimen exchange airlock showed minor pressure oscillation.',
    'resolved',
    'Technician re-seated the O-ring seal and verified leak integrity. Restored to full specification.',
    now() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. SEED NOTIFICATIONS
-- ------------------------------------------------------------------------------
INSERT INTO public.notifications (
    id, user_id, title, message, is_read, link_url, created_at
) VALUES
(
    'eeee0001-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000005',
    'Booking Approved',
    'Your reservation for "Femtosecond Titanium-Sapphire Laser Spectrometer" has been approved.',
    false,
    '/bookings/bbbb0003-0000-0000-0000-000000000003',
    now() - INTERVAL '2 days'
),
(
    'eeee0002-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'New Booking Request',
    'A new reservation request has been submitted for "Anechoic RF & Microwave Testing Chamber".',
    false,
    '/owner/bookings/bbbb0004-0000-0000-0000-000000000004',
    now() - INTERVAL '12 hours'
),
(
    'eeee0003-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000004',
    'Check-in Confirmed',
    'Session started for "ISO Class 5 Cleanroom Microfabrication Bay A". Please complete your return inspection upon completion.',
    true,
    '/bookings/bbbb0002-0000-0000-0000-000000000002',
    now() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. SEED AUDIT LOGS
-- ------------------------------------------------------------------------------
INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, details, created_at
) VALUES
(
    'ffff0001-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'RESOURCE_CREATED',
    'resource',
    'aaaa0001-0000-0000-0000-000000000001',
    '{"title": "Field Emission SEM (Hitachi SU5000 Sub-Nanometer)", "category": "Microscopy & Imaging"}'::jsonb,
    now() - INTERVAL '30 days'
),
(
    'ffff0002-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000004',
    'BOOKING_CREATED',
    'booking',
    'bbbb0001-0000-0000-0000-000000000001',
    '{"resource_id": "aaaa0001-0000-0000-0000-000000000001", "purpose": "Silver nanowire mesh characterization"}'::jsonb,
    now() - INTERVAL '6 days'
),
(
    'ffff0003-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000002',
    'BOOKING_STATUS_APPROVED',
    'booking',
    'bbbb0001-0000-0000-0000-000000000001',
    '{"previous_status": "pending", "new_status": "approved"}'::jsonb,
    now() - INTERVAL '5 days'
),
(
    'ffff0004-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000004',
    'CONDITION_REPORT_SUBMITTED',
    'condition_report',
    'cccc0001-0000-0000-0000-000000000001',
    '{"report_type": "before", "condition_status": "excellent"}'::jsonb,
    now() - INTERVAL '3 days'
)
ON CONFLICT (id) DO NOTHING;
