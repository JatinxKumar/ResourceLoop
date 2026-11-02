-- ==============================================================================
-- ResourceLoop - Smart Institutional Resource Sharing Network
-- Migration: 005_organization_membership_requests.sql
-- Description: Organization membership request table, RPCs, and RLS policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.organization_membership_requests
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_membership_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. PARTIAL UNIQUE INDEX: One PENDING request per user per organization
--    Allows new requests after rejection (status = 'rejected')
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_membership_requests_pending
    ON public.organization_membership_requests(user_id, organization_id)
    WHERE status = 'pending';

-- ------------------------------------------------------------------------------
-- 3. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_membership_requests_user_id
    ON public.organization_membership_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_org_membership_requests_org_id
    ON public.organization_membership_requests(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_membership_requests_status
    ON public.organization_membership_requests(status);

-- ------------------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER (uses existing public.update_timestamp() from migration 001)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_org_membership_requests_updated_at
    BEFORE UPDATE ON public.organization_membership_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------------------------
-- 5. TABLE GRANTS & RLS: RPC-ONLY MUTATION LOCKDOWN
--    Ordinary users CANNOT directly INSERT, UPDATE, or DELETE membership requests.
--    All mutations must go through SECURITY DEFINER RPCs.
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.organization_membership_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organization_membership_requests TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.organization_membership_requests TO service_role;

ALTER TABLE public.organization_membership_requests ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own membership requests
DROP POLICY IF EXISTS "users_select_own_membership_requests" ON public.organization_membership_requests;
CREATE POLICY "users_select_own_membership_requests"
    ON public.organization_membership_requests
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Admins can SELECT all requests (read-only via RLS; mutations go through RPCs only)
DROP POLICY IF EXISTS "admins_manage_membership_requests" ON public.organization_membership_requests;
CREATE POLICY "admins_select_all_membership_requests"
    ON public.organization_membership_requests
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. RPC: request_organization_membership(p_org_id)
--    Frontend contract: request_organization_membership({ p_org_id })
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_organization_membership(
    p_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_profile public.profiles%ROWTYPE;
    v_org public.organizations%ROWTYPE;
BEGIN
    -- Require authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required to request organization membership'
        USING ERRCODE = '42501';
    END IF;

    -- Lock the requester's profile row FOR UPDATE to prevent concurrent affiliation changes
    SELECT * INTO v_user_profile
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found: %', v_user_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Reject users who already belong to an organization
    IF v_user_profile.organization_id IS NOT NULL THEN
        RAISE EXCEPTION 'Conflict: You are already a member of an organization. You cannot request membership to another organization.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Verify target organization exists and is verified
    SELECT * INTO v_org
    FROM public.organizations
    WHERE id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found: %', p_org_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_org.verification_status IS DISTINCT FROM 'verified' THEN
        RAISE EXCEPTION 'Organization not verified: % (status: %)', p_org_id, v_org.verification_status
        USING ERRCODE = 'P0001';
    END IF;

    -- Insert a pending membership request
    -- Partial unique index (uq_org_membership_requests_pending) prevents duplicate PENDING requests
    -- ON CONFLICT DO NOTHING safely handles race conditions for duplicate pending requests
    INSERT INTO public.organization_membership_requests (user_id, organization_id, status)
    VALUES (v_user_id, p_org_id, 'pending')
    ON CONFLICT (user_id, organization_id) WHERE status = 'pending' DO NOTHING;
END;
$$;

ALTER FUNCTION public.request_organization_membership(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.request_organization_membership(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_organization_membership(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC: approve_organization_membership(p_request_id, p_status)
--    Frontend contract: approve_organization_membership({ p_request_id, p_status })
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_organization_membership(
    p_request_id UUID,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_request public.organization_membership_requests%ROWTYPE;
    v_user_profile public.profiles%ROWTYPE;
    v_org public.organizations%ROWTYPE;
BEGIN
    -- Require authenticated caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required'
        USING ERRCODE = '42501';
    END IF;

    -- Validate p_status strictly: only 'approved' or 'rejected' (NULL is rejected)
    IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Validation error: p_status must be "approved" or "rejected", got "%"', p_status
        USING ERRCODE = '22023';
    END IF;

    -- Require platform admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve or reject membership requests'
        USING ERRCODE = '42501';
    END IF;

    -- Lock the user's profile row FIRST to establish consistent lock order
    -- (profile -> membership request) preventing deadlock with request_organization_membership
    SELECT * INTO v_user_profile
    FROM public.profiles
    WHERE id = (
        SELECT user_id
        FROM public.organization_membership_requests
        WHERE id = p_request_id
    )
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership request not found: %', p_request_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Lock the request row FOR UPDATE and revalidate its status
    SELECT * INTO v_request
    FROM public.organization_membership_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership request not found: %', p_request_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Only allow processing requests currently in 'pending' status
    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Invalid state transition: Cannot process a membership request that is currently in "%" status. Only "pending" requests can be approved or rejected.', v_request.status
        USING ERRCODE = 'P0001';
    END IF;

    -- Revalidate organization verification only when approving
    IF p_status = 'approved' THEN
        SELECT * INTO v_org
        FROM public.organizations
        WHERE id = v_request.organization_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Organization not found: %', v_request.organization_id
            USING ERRCODE = 'P0002';
        END IF;

        IF v_org.verification_status IS DISTINCT FROM 'verified' THEN
            RAISE EXCEPTION 'Organization no longer verified: % (status: %)', v_request.organization_id, v_org.verification_status
            USING ERRCODE = 'P0001';
        END IF;

        -- Prevent overwriting existing organization affiliation
        IF v_user_profile.organization_id IS NOT NULL THEN
            RAISE EXCEPTION 'Conflict: User % already belongs to organization %. Cannot overwrite existing affiliation.', v_request.user_id, v_user_profile.organization_id
            USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.profiles
        SET organization_id = v_request.organization_id,
            updated_at = now()
        WHERE id = v_request.user_id;
    END IF;

    -- Update request status atomically
    UPDATE public.organization_membership_requests
    SET status = p_status,
        updated_at = now()
    WHERE id = p_request_id;
END;
$$;

ALTER FUNCTION public.approve_organization_membership(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.approve_organization_membership(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_organization_membership(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. VALIDATION NOTES (FOR SQL EDITOR VERIFICATION)
-- ------------------------------------------------------------------------------
/*
-- TEST 1: Verify seeker can request membership to verified org
-- Expected: INSERT succeeds, row created with status 'pending'
-- SELECT * FROM public.organization_membership_requests WHERE user_id = auth.uid();

-- TEST 2: Verify user already in org is rejected
-- Expected: P0001 Conflict exception
-- SELECT public.request_organization_membership('<verified_org_id>');

-- TEST 3: Verify duplicate pending request is ignored (no error, no duplicate row)
-- Expected: Second call does nothing, count remains 1
-- SELECT public.request_organization_membership('<verified_org_id>');
-- SELECT count(*) FROM public.organization_membership_requests WHERE user_id = auth.uid() AND organization_id = '<org_id>';

-- TEST 4: Verify rejected request allows new request
-- Expected: After admin rejects, user can submit new request (partial unique index only blocks pending)
-- SELECT public.request_organization_membership('<verified_org_id>');

-- TEST 5: Verify non-admin cannot approve
-- Expected: 42501 Unauthorized exception
-- SELECT public.approve_organization_membership('<request_id>', 'approved');

-- TEST 6: Verify admin approval updates profile organization_id
-- Expected: profiles.organization_id set to requested org
-- SELECT organization_id FROM public.profiles WHERE id = '<user_id>';

-- TEST 7: Verify admin cannot approve non-pending request
-- Expected: P0001 Invalid state transition
-- SELECT public.approve_organization_membership('<approved_request_id>', 'rejected');

-- TEST 8: Verify admin cannot approve request for unverified org
-- Expected: P0001 Organization no longer verified

-- TEST 9: Verify admin cannot overwrite existing org affiliation
-- Expected: P0001 Conflict if user already has organization_id set

-- TEST 10: Verify direct INSERT/UPDATE/DELETE on table is blocked for ordinary users
-- Expected: RLS policy violation (permission denied)
-- INSERT INTO public.organization_membership_requests (user_id, organization_id, status) VALUES (auth.uid(), '<org_id>', 'pending');
*/