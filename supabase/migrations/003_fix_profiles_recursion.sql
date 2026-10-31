-- ==============================================================================
-- ResourceLoop - Smart Institutional Resource Sharing Network
-- Migration: 003_fix_profiles_recursion.sql
-- Eliminates PostgreSQL 42P17 infinite recursion in profiles_select_policy
-- using SECURITY DEFINER helper functions while preserving strict role security.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS (Bypass RLS safely on internal lookups)
-- ------------------------------------------------------------------------------

-- Retrieve the authenticated caller's role directly from public.profiles
-- Bypasses RLS to prevent recursion when evaluated inside policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
STABLE
AS $$
    SELECT public.get_current_user_role();
$$;

-- Check if current authenticated user has administrative privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
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
SET search_path = public
STABLE
AS $$
    SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Grant execution permissions to standard roles
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_or_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 2. REVISE profiles RLS POLICIES (ELIMINATE IN-POLICY SUBQUERIES)
-- ------------------------------------------------------------------------------

-- Drop the recursive policy
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Re-create with non-recursive scalar evaluation:
-- Condition 1: A user can always view their own profile (id = auth.uid())
-- Condition 2: Platform administrators can view all profiles (public.is_admin())
-- Condition 3: Any authenticated user can view owners and admins (for resource/booking displays)
-- Condition 4: Organization peers can view each other using get_current_user_org_id() (ZERO recursion)
CREATE POLICY "profiles_select_policy"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR public.is_admin()
        OR role IN ('owner', 'admin')
        OR (
            organization_id IS NOT NULL 
            AND organization_id = public.get_current_user_org_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 3. REVISE organizations SELECT POLICY (ELIMINATE CROSS-TABLE RECURSION)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "organizations_select_authenticated" ON public.organizations;

-- Re-create organizations authenticated SELECT policy using scalar helper
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
-- 4. REVISE STORAGE RLS POLICIES FOR resource-images
-- ------------------------------------------------------------------------------

-- Ensure storage policies use the non-recursive helper function
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
-- 5. REVISE ROLE PROTECTION TRIGGER FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow direct database migrations, superusers, and service_role executions
    IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- If role is being changed, ensure caller has admin privileges
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only platform administrators can change user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
