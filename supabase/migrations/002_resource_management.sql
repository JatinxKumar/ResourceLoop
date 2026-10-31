-- ==============================================================================
-- ResourceLoop - Smart Institutional Resource Sharing Network
-- Migration: 002_resource_management.sql
-- Storage bucket creation, Storage RLS policies, and Full-Text Search indexing
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- 2. FULL-TEXT SEARCH INDEX FOR RESOURCES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_resources_fts 
    ON public.resources 
    USING gin (to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || location || ' ' || category));

-- ------------------------------------------------------------------------------
-- 2.1 PUBLIC DISCOVERY POLICIES
-- Allow unauthenticated visitors and seekers to discover verified organizations and available assets
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "organizations_select_public" ON public.organizations;
CREATE POLICY "organizations_select_public"
    ON public.organizations
    FOR SELECT
    TO anon
    USING (verification_status = 'verified');

DROP POLICY IF EXISTS "resources_select_public" ON public.resources;
CREATE POLICY "resources_select_public"
    ON public.resources
    FOR SELECT
    TO anon
    USING (status = 'available');

-- ------------------------------------------------------------------------------
-- 3. STORAGE BUCKET: resource-images
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resource-images',
    'resource-images',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

-- ------------------------------------------------------------------------------
-- 4. STORAGE RLS POLICIES FOR resource-images
-- ------------------------------------------------------------------------------

-- Allow public viewing of resource images
DROP POLICY IF EXISTS "resource_images_public_view" ON storage.objects;
CREATE POLICY "resource_images_public_view"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'resource-images');

-- Only authenticated users with role 'owner' or 'admin' can upload resource images
DROP POLICY IF EXISTS "resource_images_owner_upload" ON storage.objects;
CREATE POLICY "resource_images_owner_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'resource-images'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'admin')
        )
    );

-- Only image uploaders or platform admins can update their images
DROP POLICY IF EXISTS "resource_images_owner_update" ON storage.objects;
CREATE POLICY "resource_images_owner_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'resource-images'
        AND (
            owner = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
        )
    );

-- Only image uploaders or platform admins can delete their images
DROP POLICY IF EXISTS "resource_images_owner_delete" ON storage.objects;
CREATE POLICY "resource_images_owner_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'resource-images'
        AND (
            owner = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 5. FUNCTION: validate_resource_eligibility
-- Database-level verification helper for institutional resource access
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_resource_eligibility(
    p_resource_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_resource RECORD;
    v_profile RECORD;
    v_reasons TEXT[] := ARRAY[]::TEXT[];
    v_eligible BOOLEAN := true;
BEGIN
    -- Fetch resource
    SELECT * INTO v_resource FROM public.resources WHERE id = p_resource_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'eligible', false,
            'reasons', ARRAY['Resource not found']
        );
    END IF;

    -- Check 1: Operational Status
    IF v_resource.status <> 'available' THEN
        v_eligible := false;
        v_reasons := array_append(v_reasons, 'Resource is currently marked as ' || v_resource.status || ' and cannot be booked');
    END IF;

    -- If a user is provided, check user-specific constraints
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
        
        -- Check 2: Institutional Affiliation (if resource belongs to an organization)
        IF v_profile.organization_id IS NULL THEN
            v_eligible := false;
            v_reasons := array_append(v_reasons, 'User is not affiliated with an institution');
        END IF;

        -- Check 3: Training requirement
        IF v_resource.training_required THEN
            v_reasons := array_append(v_reasons, 'Operator safety clearance/training is required prior to session activation');
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'status', v_resource.status,
        'training_required', v_resource.training_required,
        'reasons', v_reasons
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
