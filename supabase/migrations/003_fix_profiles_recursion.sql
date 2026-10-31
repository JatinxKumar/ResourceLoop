-- ==============================================================================
-- ResourceLoop - Smart Institutional Resource Sharing Network
-- Migration: 003_fix_profiles_recursion.sql (REVISED SECURITY HARDENED)
-- 
-- Fixes:
-- 1. Eliminates PostgreSQL 42P17 infinite recursion in profiles_select_policy.
-- 2. Uses session_user (not current_user) in SECURITY DEFINER role guard trigger.
-- 3. Checks trusted Supabase JWT role ('service_role') explicitly, no blanket auth.uid() IS NULL.
-- 4. Revokes PUBLIC/anon execution on internal security functions.
-- 5. Tightens profiles_select_policy to prevent blanket exposure of owner/admin profiles.
-- 6. Enforces search_path = public, pg_temp on all SECURITY DEFINER functions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS (Safe RLS bypass with strict search_path)
-- ------------------------------------------------------------------------------

-- Retrieve the authenticated caller's role directly from public.profiles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role FROM public.profiles WHERE id = auth.uid()),
        'anonymous'
    );
$$;

-- Maintain backward compatibility for any existing calls to get_user_role()
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT public.get_current_user_role();
$$;

-- Check if current authenticated user has administrative privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
        false
    );
$$;

-- Check if current authenticated user is an owner or admin
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role IN ('owner', 'admin') FROM public.profiles WHERE id = auth.uid()),
        false
    );
$$;

-- Retrieve the authenticated caller's affiliated organization ID directly
-- Returns NULL if user has no affiliation or is unauthenticated
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 2. LEAST-PRIVILEGE FUNCTION EXECUTE GRANTS
-- ------------------------------------------------------------------------------

-- Revoke default PUBLIC and anon execution on all internal security functions
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_owner_or_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_current_user_org_id() FROM PUBLIC, anon;

-- Grant execution strictly to authenticated users and backend service_role
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_or_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. REVISE profiles RLS POLICY (ELIMINATE IN-POLICY SUBQUERIES & BLANKET LEAKAGE)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Re-create profiles SELECT policy with least-privilege visibility:
-- Condition 1: A user can always view their own profile (id = auth.uid())
-- Condition 2: Platform administrators can view all profiles (public.is_admin())
-- Condition 3: Peers in the same verified organization can view each other (evaluated via scalar helper)
-- Condition 4: Users who actively manage public catalogue resources can be viewed by seekers (for booking attribution)
-- NOTE: Blanket exposure of all 'owner'/'admin' accounts across unrelated institutions is eliminated.
CREATE POLICY "profiles_select_policy"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR public.is_admin()
        OR (
            organization_id IS NOT NULL 
            AND organization_id = public.get_current_user_org_id()
        )
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.owner_id = profiles.id AND r.status <> 'unavailable'
        )
    );

-- ------------------------------------------------------------------------------
-- 4. REVISE organizations SELECT POLICY (ELIMINATE CROSS-TABLE RECURSION)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "organizations_select_authenticated" ON public.organizations;

CREATE POLICY "organizations_select_authenticated"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        verification_status = 'verified'
        OR public.is_admin()
        OR id = public.get_current_user_org_id()
    );

-- ------------------------------------------------------------------------------
-- 5. REVISE STORAGE RLS POLICIES FOR resource-images
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "resource_images_owner_upload" ON storage.objects;
CREATE POLICY "resource_images_owner_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'resource-images'
        AND public.is_owner_or_admin()
    );

-- ------------------------------------------------------------------------------
-- 6. SECURITY-HARDENED ROLE PROTECTION TRIGGER FUNCTION
-- ------------------------------------------------------------------------------

-- In SECURITY DEFINER functions, current_user evaluates to the function owner (postgres),
-- which would dangerously bypass trigger checks for all callers.
-- We fix this by:
-- 1. Using session_user to identify trusted direct SQL Editor / psql connections.
-- 2. Checking the trusted Supabase JWT claim ('service_role') for automated backend workers.
-- 3. Requiring public.is_admin() for all standard authenticated user sessions.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_role TEXT;
BEGIN
    -- Only evaluate when role column is being modified
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Case A: Trusted database administrator session (SQL Editor, direct psql)
        -- session_user preserves the connected user identity, unaffected by SECURITY DEFINER
        IF session_user IN ('postgres', 'supabase_admin') THEN
            RETURN NEW;
        END IF;

        -- Case B: Trusted backend service_role execution via Supabase Auth gateway
        -- Explicitly verify the JWT claim; do NOT use auth.uid() IS NULL
        BEGIN
            v_jwt_role := COALESCE(
                current_setting('request.jwt.claim.role', true),
                (auth.jwt()->>'role')
            );
        EXCEPTION WHEN OTHERS THEN
            v_jwt_role := NULL;
        END;

        IF v_jwt_role = 'service_role' THEN
            RETURN NEW;
        END IF;

        -- Case C: Standard authenticated user session through API
        -- Strictly require caller to be an existing administrator
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'AccessDenied: Only platform administrators can change user roles (attempted by user %, current role: %)',
                auth.uid(), public.get_current_user_role()
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Ensure the trigger is active on public.profiles
DROP TRIGGER IF EXISTS trg_profiles_role_guard ON public.profiles;
CREATE TRIGGER trg_profiles_role_guard
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ==============================================================================
-- 7. VALIDATION TEST SUITE (FOR SUPABASE SQL EDITOR VERIFICATION)
-- ==============================================================================
/*
-- TEST 1: Verify session_user bypass works for postgres in SQL Editor
-- Expected: Successfully updates role without 42501 error
DO $$
BEGIN
    RAISE NOTICE 'Connected session_user: %', session_user;
    -- SQL Editor runs as postgres, so manual role management works:
    -- UPDATE public.profiles SET role = 'owner' WHERE email = 'test@example.com';
END $$;

-- TEST 2: Verify non-admin role escalation rejection
-- Expected: Raises 42501 AccessDenied exception when called in an authenticated session
-- Run as simulated seeker:
-- SET LOCAL role = 'authenticated';
-- SET LOCAL "request.jwt.claims" = '{"sub": "c0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'c0000000-0000-0000-0000-000000000004';
-- Expected error: 42501: AccessDenied: Only platform administrators can change user roles

-- TEST 3: Verify profiles_select_policy has ZERO infinite recursion
-- Expected: Returns profiles immediately without error 42P17
-- SET LOCAL role = 'authenticated';
-- SET LOCAL "request.jwt.claims" = '{"sub": "c0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
-- SELECT id, full_name, role, organization_id FROM public.profiles;
*/
