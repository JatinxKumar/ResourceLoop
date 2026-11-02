# ResourceLoop — Migration 005: Organization Membership Request Backend Handoff

**Branch**: `fix/seeker-organization-eligibility`
**Status**: Frontend implementation complete. Backend migration 005 required. Do not create or apply without explicit approval.

---

## 1. Required Table: `organization_membership_requests`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | PRIMARY KEY |
| `user_id` | UUID | NO | — | `REFERENCES public.profiles(id) ON DELETE CASCADE` |
| `organization_id` | UUID | NO | — | `REFERENCES public.organizations(id) ON DELETE CASCADE` |
| `status` | TEXT | NO | — | `CHECK (status IN ('pending', 'approved', 'rejected'))` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Unique Constraint**: A user may only have **one pending request per organization**. This is enforced at the application/backend level (see section 7).

**Index Recommendations**:
- `idx_org_membership_user_id` ON `public.organization_membership_requests(user_id)` — for `fetchMyMembershipRequests()`
- `idx_org_membership_org_id` ON `public.organization_membership_requests(organization_id)` — for admin filtering
- `idx_org_membership_status` ON `public.organization_membership_requests(status)` — for status-based queries

---

## 2. Required RPC: `request_organization_membership(p_org_id)`

### Signature
```sql
CREATE OR REPLACE FUNCTION public.request_organization_membership(
    p_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    -- Validate that the organization exists and is verified
    IF NOT EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = p_org_id AND verification_status = 'verified'
    ) THEN
        RAISE EXCEPTION 'Organization not found or not verified: %', p_org_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Validate that the caller is authenticated (handled by Supabase RLS)
    -- Insert a pending membership request, ignoring if one already exists
    INSERT INTO public.organization_membership_requests (user_id, organization_id, status)
    VALUES (auth.uid(), p_org_id, 'pending')
    ON CONFLICT (user_id, organization_id) DO NOTHING;
END;
$$;
```

### Frontend Call
```typescript
// From src/services/organizations.ts
supabase.rpc('request_organization_membership', { p_org_id: orgId });
```
- **Argument**: `{ p_org_id: string }` — the UUID of the verified organization
- **Response**: `void` (no return value)
- **Error handling**: Frontend throws if RPC returns an error (e.g., organization not verified)

---

## 3. Required RPC: `approve_organization_membership(p_request_id, p_status)`

### Signature
```sql
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
    v_request public.organization_membership_requests%ROWTYPE;
    v_user_profile public.profiles%ROWTYPE;
    v_org public.organizations%ROWTYPE;
BEGIN
    -- Fetch the request row
    SELECT * INTO v_request
    FROM public.organization_membership_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership request not found: %', p_request_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Authorization: Only admins can approve/reject
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve membership requests'
        USING ERRCODE = '42501';
    END IF;

    -- Update request status
    UPDATE public.organization_membership_requests
    SET status = p_status,
        updated_at = now()
    WHERE id = p_request_id;

    -- On approval, assign the user's profile organization_id
    IF p_status = 'approved' THEN
        SELECT * INTO v_user_profile
        FROM public.profiles
        WHERE id = v_request.user_id;

        UPDATE public.profiles
        SET organization_id = v_request.organization_id,
            updated_at = now()
        WHERE id = v_request.user_id;
    END IF;
END;
$$;
```

### Frontend Call
```typescript
// From src/services/organizations.ts
supabase.rpc('approve_organization_membership', {
    p_request_id: requestId,
    p_status: newStatus,  // 'approved' | 'rejected'
});
```
- **Arguments**: 
  - `{ p_request_id: string }` — the UUID of the membership request
  - `{ p_status: 'approved' | 'rejected' }` — the new status
- **Response**: `void` (no return value)
- **Error handling**: Frontend throws if RPC returns an error

---

## 4. Required RLS Policies

### Policy: Users can SELECT their own requests
```sql
CREATE POLICY "users_select_own_membership_requests"
    ON public.organization_membership_requests
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
```

### Policy: Admins can SELECT/INSERT/UPDATE/DELETE all requests
```sql
CREATE POLICY "admins_manage_membership_requests"
    ON public.organization_membership_requests
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
```

### Policy: Organizations can be viewed by verified users + members
No change needed — existing `organizations_select_authenticated` policy already handles this.

---

## 5. How Approval Updates User Affiliation

When an admin approves a membership request (`p_status = 'approved'`):

1. The `organization_membership_requests` row status is updated to `'approved'`
2. The user's `profiles.organization_id` is set to the requested organization's ID
3. The `profiles.updated_at` timestamp is updated

This enables:
- The user to immediately access organization-affiliated resources
- RLS policies to recognize the user's organization membership
- The UI to show the user as affiliated (e.g., "Welcome, [Org Name]" in the dashboard)

---

## 6. Duplicate Requests & Already-Approved Memberships

### Duplicate Prevention (in `request_organization_membership`)
The RPC uses `ON CONFLICT (user_id, organization_id) DO NOTHING` to prevent a user from submitting multiple pending requests for the same organization. If a request already exists (pending, approved, or rejected), the INSERT is silently skipped.

### Frontend Behavior
- `OrganizationRequestModal` checks `useMyMembershipRequests()` on mount
- If an **approved** request exists: show "Membership approved" badge and enable resource booking
- If a **pending** request exists: show "Pending review" status and disable new request submission
- If a **rejected** request exists: show "Rejected" status; user may submit a new request if desired

### Admin View
- `AdminDashboardPage` shows all requests via `fetchAllMembershipRequests()`
- Admins can approve/reject any request regardless of current status

---

## 7. Frontend RPC Argument and Response Expectations

| RPC | Frontend Call | Argument | Response | Error Handling |
|-----|--------------|----------|----------|----------------|
| `request_organization_membership` | `requestOrganizationMembership(orgId)` | `{ p_org_id: string }` (org UUID) | `void` | Throw on RPC error; show error message to user |
| `approve_organization_membership` | `updateMembershipRequest(requestId, newStatus)` | `{ p_request_id: string, p_status: 'approved' \| 'rejected' }` | `void` | Throw on RPC error; show success/error message; refresh request list |

### Expected UI Flow

**Seeker submits membership request**:
1. User clicks "Request Organization Membership" in dashboard or resource detail page
2. `OrganizationRequestModal` opens with verified organizations list
3. User selects an organization and submits
4. `requestOrganizationMembership(orgId)` is called
5. Modal refreshes to show "Pending request" status
6. Admin reviews and approves/rejects via AdminDashboardPage
7. Upon approval, user's profile is updated and modal shows "Membership approved"

**Admin approves/rejects request**:
1. Admin navigates to AdminDashboardPage → Membership Requests tab
2. Sees table of all requests with applicant, email, organization, requested date, status, and action buttons
3. Clicks "Approve" or "Reject"
4. `updateMembershipRequest(requestId, 'approved')` or `updateMembershipRequest(requestId, 'rejected')` is called
5. Success message displayed; request list refreshes

---

## 8. Backend Verification Checklist

Before applying migration 005, verify:

- [ ] `organization_membership_requests` table created with correct schema
- [ ] `request_organization_membership()` RPC created and tested
- [ ] `approve_organization_membership()` RPC created and tested
- [ ] RLS policies enabled on `organization_membership_requests` table
- [ ] `profiles.organization_id` column exists and has proper FK to `organizations.id`
- [ ] No existing data violates the unique (user_id, organization_id) constraint
- [ ] Supabase JWT `role` claim is properly checked in `is_admin()` for admin authorization
- [ ] Frontend RPC arguments match the expected signatures exactly

---