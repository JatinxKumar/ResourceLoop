-- ==============================================================================
-- ResourceLoop - Smart Institutional Resource Sharing Network
-- Database Migration: 001_initial_schema.sql
-- PostgreSQL / Supabase Schema Definition
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: organizations
-- Participating universities, research laboratories, and institutes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL CHECK (organization_type IN ('university', 'research_lab', 'institute', 'department', 'other')),
    description TEXT,
    address TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Table: profiles
-- User profiles linked to Supabase auth.users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'seeker' CHECK (role IN ('seeker', 'owner', 'admin')),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Table: resources
-- Institutional equipment and spaces available for shared booking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('equipment', 'space')),
    location TEXT NOT NULL,
    image_url TEXT,
    availability_info JSONB NOT NULL DEFAULT '{"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "hours": "09:00 - 18:00"}'::jsonb,
    eligibility_requirements TEXT,
    training_required BOOLEAN NOT NULL DEFAULT false,
    usage_limit_per_user INTEGER NOT NULL DEFAULT 1 CHECK (usage_limit_per_user >= 1),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'maintenance')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Table: bookings
-- Resource reservation requests and active bookings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'approved',
        'rejected',
        'waitlisted',
        'checked_in',
        'returned',
        'cancelled',
        'overdue'
    )),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT booking_time_order CHECK (end_time > start_time)
);

-- ------------------------------------------------------------------------------
-- Table: condition_reports
-- Equipment / space condition reports submitted before check-in and after return
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.condition_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('before', 'after')),
    condition_status TEXT NOT NULL CHECK (condition_status IN ('excellent', 'good', 'fair', 'damaged', 'faulty')),
    notes TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_booking_report_stage UNIQUE (booking_id, report_type)
);

-- ------------------------------------------------------------------------------
-- Table: incidents
-- Issues, damages, late returns, or safety hazards logged against bookings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('damage', 'loss', 'late_return', 'misuse', 'safety_hazard', 'other')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Table: notifications
-- In-app notifications for users regarding bookings, approvals, and alerts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    link_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Table: audit_logs
-- Append-only audit trail for compliance, security, and administrative visibility
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_verification ON public.organizations(verification_status);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

CREATE INDEX IF NOT EXISTS idx_resources_owner_id ON public.resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_organization_id ON public.resources(organization_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(resource_type);

CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON public.bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_requester_id ON public.bookings(requester_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON public.bookings(resource_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_condition_reports_booking_id ON public.condition_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_condition_reports_submitted_by ON public.condition_reports(submitted_by);

CREATE INDEX IF NOT EXISTS idx_incidents_booking_id ON public.incidents(booking_id);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON public.incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 4. UTILITY FUNCTIONS & TRIGGERS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Function: update_timestamp
-- Automatically sets updated_at to now() before row update
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE TRIGGER trg_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------------------------
-- Helper Security Functions (SECURITY DEFINER with strict search_path)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ------------------------------------------------------------------------------
-- Function: prevent_profile_role_escalation
-- Strictly blocks users from self-promoting to admin or owner unless executed by admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only platform administrators can change user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_profiles_role_guard
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ------------------------------------------------------------------------------
-- Function: handle_new_user
-- Automatically provisions a seeker profile when an auth.users record is created
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'seeker',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger to auth.users if available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
        DROP TRIGGER on_auth_user_created ON auth.users;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Gracefully proceed if executing outside Supabase Cloud environment
END;
$$;

-- ------------------------------------------------------------------------------
-- Function: notify_booking_status_change
-- Automatically emits notifications to requesters and owners on status transitions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_resource_title TEXT;
    v_owner_id UUID;
BEGIN
    -- Fetch resource title and owner
    SELECT title, owner_id INTO v_resource_title, v_owner_id
    FROM public.resources
    WHERE id = NEW.resource_id;

    -- Case 1: Status changed on existing booking
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Notify the requester of status update
        INSERT INTO public.notifications (user_id, title, message, link_url)
        VALUES (
            NEW.requester_id,
            'Booking ' || initcap(NEW.status),
            'Your booking request for "' || v_resource_title || '" has been updated to ' || NEW.status || '.',
            '/bookings/' || NEW.id
        );

        -- Audit log entry
        INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
        VALUES (
            auth.uid(),
            'BOOKING_STATUS_' || upper(NEW.status),
            'booking',
            NEW.id,
            jsonb_build_object(
                'previous_status', OLD.status,
                'new_status', NEW.status,
                'resource_id', NEW.resource_id,
                'rejection_reason', NEW.rejection_reason
            )
        );
    END IF;

    -- Case 2: New booking created (notify resource owner)
    IF TG_OP = 'INSERT' THEN
        IF v_owner_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, link_url)
            VALUES (
                v_owner_id,
                'New Booking Request',
                'A new reservation request has been submitted for "' || v_resource_title || '".',
                '/owner/bookings/' || NEW.id
            );
        END IF;

        -- Audit log creation
        INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
        VALUES (
            auth.uid(),
            'BOOKING_CREATED',
            'booking',
            NEW.id,
            jsonb_build_object(
                'resource_id', NEW.resource_id,
                'start_time', NEW.start_time,
                'end_time', NEW.end_time,
                'purpose', NEW.purpose
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_booking_lifecycle
    AFTER INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Policies: organizations
-- ------------------------------------------------------------------------------
-- Anyone authenticated can view verified organizations (or their own linked org)
CREATE POLICY "organizations_select_authenticated"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        verification_status = 'verified'
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.organization_id = organizations.id
        )
    );

-- Only administrators can insert, update, or delete organizations
CREATE POLICY "organizations_admin_manage"
    ON public.organizations
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- Policies: profiles
-- ------------------------------------------------------------------------------
-- Authenticated users can view their own profile, members of same org, or resource owners
CREATE POLICY "profiles_select_policy"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR public.is_admin()
        OR role IN ('owner', 'admin')
        OR organization_id IN (
            SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

-- Users can update their own profile details (role updates blocked by trigger)
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- Users can insert their initial profile (or provisioned via auth trigger)
CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- Policies: resources
-- ------------------------------------------------------------------------------
-- Authenticated users can browse all available or active resources
CREATE POLICY "resources_select_authenticated"
    ON public.resources
    FOR SELECT
    TO authenticated
    USING (
        status <> 'unavailable'
        OR owner_id = auth.uid()
        OR public.is_admin()
    );

-- Only owners or admins can register resources for their organization
CREATE POLICY "resources_insert_owners"
    ON public.resources
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (owner_id = auth.uid() AND public.get_user_role() IN ('owner', 'admin'))
        OR public.is_admin()
    );

-- Owners can update only their own resources; Admins can update any
CREATE POLICY "resources_update_owners"
    ON public.resources
    FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_admin())
    WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- Owners can delete their own resources if no active bookings exist
CREATE POLICY "resources_delete_owners"
    ON public.resources
    FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- Policies: bookings
-- ------------------------------------------------------------------------------
-- Requesters can view their own bookings; Resource owners can view bookings for their resources; Admins view all
CREATE POLICY "bookings_select_policy"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        requester_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = bookings.resource_id AND r.owner_id = auth.uid()
        )
    );

-- Seekers and authenticated users can insert bookings for themselves with pending status
CREATE POLICY "bookings_insert_requester"
    ON public.bookings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        requester_id = auth.uid()
        AND status = 'pending'
    );

-- Requesters can cancel their own bookings; Owners and admins can approve, reject, or update statuses
CREATE POLICY "bookings_update_policy"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (
        -- Requester can update their own booking (e.g. to cancel)
        requester_id = auth.uid()
        -- Resource owner can update bookings for their equipment/space
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = bookings.resource_id AND r.owner_id = auth.uid()
        )
        -- Admin has full operational access
        OR public.is_admin()
    )
    WITH CHECK (
        -- If requester is updating, they may only transition status to 'cancelled'
        (requester_id = auth.uid() AND status = 'cancelled')
        -- Owners can transition to approved, rejected, waitlisted, checked_in, returned, overdue
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = bookings.resource_id AND r.owner_id = auth.uid()
        )
        OR public.is_admin()
    );

-- Hard deletes are restricted to administrators (prefer status = 'cancelled')
CREATE POLICY "bookings_delete_admin"
    ON public.bookings
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Policies: condition_reports
-- ------------------------------------------------------------------------------
-- Condition reports are visible to the requester, resource owner, and admins
CREATE POLICY "condition_reports_select_participants"
    ON public.condition_reports
    FOR SELECT
    TO authenticated
    USING (
        submitted_by = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = condition_reports.booking_id
            AND (b.requester_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- Only the booking requester or resource owner can submit condition reports
CREATE POLICY "condition_reports_insert_participants"
    ON public.condition_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (
        submitted_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = condition_reports.booking_id
            AND (b.requester_id = auth.uid() OR r.owner_id = auth.uid())
        )
    );

-- Condition reports are immutable audit documents; no user updates or deletes
CREATE POLICY "condition_reports_no_update"
    ON public.condition_reports
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "condition_reports_delete_admin"
    ON public.condition_reports
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- Policies: incidents
-- ------------------------------------------------------------------------------
-- Incidents viewable by reporter, associated resource owner, or admin
CREATE POLICY "incidents_select_policy"
    ON public.incidents
    FOR SELECT
    TO authenticated
    USING (
        reported_by = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = incidents.booking_id AND r.owner_id = auth.uid()
        )
    );

-- Any authenticated participant involved in a booking can log an incident
CREATE POLICY "incidents_insert_authenticated"
    ON public.incidents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reported_by = auth.uid()
    );

-- Only resource owners or admins can resolve or update incident statuses
CREATE POLICY "incidents_update_owners_admin"
    ON public.incidents
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = incidents.booking_id AND r.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = incidents.booking_id AND r.owner_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- Policies: notifications
-- ------------------------------------------------------------------------------
-- Users can only view their own notifications
CREATE POLICY "notifications_select_recipient"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can only mark their own notifications as read
CREATE POLICY "notifications_update_recipient"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_recipient"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Insert permitted via security definer triggers or authenticated system flows
CREATE POLICY "notifications_insert_system"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- Policies: audit_logs
-- ------------------------------------------------------------------------------
-- Audit logs are strictly readable only by administrators
CREATE POLICY "audit_logs_select_admin"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Authenticated users and triggers can record audit events
CREATE POLICY "audit_logs_insert_authenticated"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL OR public.is_admin());

-- Audit logs are IMMUTABLE: Updates and Deletions are strictly forbidden
CREATE POLICY "audit_logs_prevent_update"
    ON public.audit_logs
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "audit_logs_prevent_delete"
    ON public.audit_logs
    FOR DELETE
    TO authenticated
    USING (false);
