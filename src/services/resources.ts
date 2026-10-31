/**
 * ResourceLoop - Resource Management Service
 * Handles institutional equipment and space catalogue, filtering, lifecycle mutations,
 * storage uploads, and eligibility verification.
 */

import { supabase } from '../lib/supabase';
import type {
  Resource,
  CreateResourceDTO,
  UpdateResourceDTO,
  ResourceFilters,
  ResourceAvailabilityInfo,
  ResourceEligibilityResult,
} from '../types/domain';
import { getCurrentProfile } from './profiles';

// Supported MIME types for resource image uploads
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Lists resources with optional multi-attribute search and filtering.
 * Expands associated organization and owner profile details.
 */
export async function listResources(filters: ResourceFilters = {}): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `);

  // Text search query across title, description, category, and location
  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%,location.ilike.%${q}%`);
  }

  // Category filter
  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  // Resource type filter ('equipment' | 'space')
  if (filters.resource_type) {
    query = query.eq('resource_type', filters.resource_type);
  }

  // Organization filter
  if (filters.organization_id) {
    query = query.eq('organization_id', filters.organization_id);
  }

  // Status / availability filter
  if (filters.available_only) {
    query = query.eq('status', 'available');
  } else if (filters.status) {
    query = query.eq('status', filters.status);
  }

  // Training requirement filter
  if (filters.training_required !== undefined) {
    query = query.eq('training_required', filters.training_required);
  }

  // Ordering and pagination
  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    const from = filters.offset || 0;
    const to = from + filters.limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[listResources] Query error:', error.message);
    throw new Error(`Failed to list resources: ${error.message}`);
  }

  return (data as Resource[]) || [];
}

/**
 * Retrieves a single resource by its unique UUID.
 */
export async function getResourceById(id: string): Promise<Resource | null> {
  if (!id) throw new Error('Resource ID is required');

  const { data, error } = await supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`[getResourceById] Error fetching resource ${id}:`, error.message);
    throw new Error(`Failed to retrieve resource: ${error.message}`);
  }

  return (data as Resource) || null;
}

/**
 * Creates a new resource entry for an organization.
 * Strictly verifies that the authenticated user has 'owner' or 'admin' privileges
 * and belongs to the designated organization.
 */
export async function createResource(input: CreateResourceDTO): Promise<Resource> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: You must be logged in to create a resource');
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    throw new Error('Forbidden: Only authorized institutional owners or administrators can register resources');
  }

  // Validate organizational alignment: Non-admin owners can only register resources for their own organization
  if (profile.role !== 'admin' && profile.organization_id !== input.organization_id) {
    throw new Error('Forbidden: You can only register resources for your affiliated organization');
  }

  const defaultAvailability: ResourceAvailabilityInfo = {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    hours: '09:00 - 18:00',
    slot_duration_minutes: 120,
  };

  const payload = {
    owner_id: profile.id,
    organization_id: input.organization_id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category.trim(),
    resource_type: input.resource_type,
    location: input.location.trim(),
    image_url: input.image_url || null,
    availability_info: input.availability_info || defaultAvailability,
    eligibility_requirements: input.eligibility_requirements?.trim() || null,
    training_required: Boolean(input.training_required),
    usage_limit_per_user: input.usage_limit_per_user || 1,
    status: input.status || 'available',
  };

  const { data, error } = await supabase
    .from('resources')
    .insert(payload)
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('[createResource] Database error:', error.message);
    throw new Error(`Failed to create resource: ${error.message}`);
  }

  return data as Resource;
}

/**
 * Updates an existing resource.
 * Enforces ownership or administrative rights.
 */
export async function updateResource(id: string, input: UpdateResourceDTO): Promise<Resource> {
  if (!id) throw new Error('Resource ID is required');

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: You must be logged in to update a resource');
  }

  // Fetch current resource to verify ownership
  const existing = await getResourceById(id);
  if (!existing) {
    throw new Error('Resource not found');
  }

  if (profile.role !== 'admin' && existing.owner_id !== profile.id) {
    throw new Error('Forbidden: You do not have permission to modify this resource');
  }

  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.category !== undefined) updates.category = input.category.trim();
  if (input.resource_type !== undefined) updates.resource_type = input.resource_type;
  if (input.location !== undefined) updates.location = input.location.trim();
  if (input.image_url !== undefined) updates.image_url = input.image_url;
  if (input.availability_info !== undefined) updates.availability_info = input.availability_info;
  if (input.eligibility_requirements !== undefined) updates.eligibility_requirements = input.eligibility_requirements?.trim() || null;
  if (input.training_required !== undefined) updates.training_required = input.training_required;
  if (input.usage_limit_per_user !== undefined) updates.usage_limit_per_user = input.usage_limit_per_user;
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabase
    .from('resources')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error(`[updateResource] Database error on ${id}:`, error.message);
    throw new Error(`Failed to update resource: ${error.message}`);
  }

  return data as Resource;
}

/**
 * Deletes a resource by ID.
 * Restricted to the resource owner or an administrator.
 */
export async function deleteResource(id: string): Promise<void> {
  if (!id) throw new Error('Resource ID is required');

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error('Unauthorized: You must be logged in to delete a resource');
  }

  const existing = await getResourceById(id);
  if (!existing) {
    throw new Error('Resource not found');
  }

  if (profile.role !== 'admin' && existing.owner_id !== profile.id) {
    throw new Error('Forbidden: You do not have permission to delete this resource');
  }

  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`[deleteResource] Error deleting ${id}:`, error.message);
    throw new Error(`Failed to delete resource: ${error.message}`);
  }
}

/**
 * Retrieves all resources managed by the currently authenticated owner.
 */
export async function getOwnerResources(): Promise<Resource[]> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return [];
  }

  const { data, error } = await supabase
    .from('resources')
    .select(`
      *,
      organization:organizations(*),
      owner:profiles(id, full_name, email, avatar_url)
    `)
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getOwnerResources] Error fetching owner resources:', error.message);
    throw new Error(`Failed to retrieve your resources: ${error.message}`);
  }

  return (data as Resource[]) || [];
}

/**
 * Convenience helper: Retrieves all publicly available resources ready for reservation.
 */
export async function getAvailableResources(): Promise<Resource[]> {
  return listResources({ available_only: true });
}

/**
 * Uploads an equipment or laboratory image to the 'resource-images' Supabase Storage bucket.
 * Restricts uploads to verified owners or administrators and validates image format and size.
 *
 * @param file - The image file to upload
 * @param organizationId - The organization owning the resource asset
 * @returns The public HTTPS URL of the uploaded image
 */
export async function uploadResourceImage(file: File, organizationId: string): Promise<string> {
  if (!file) throw new Error('No file provided for upload');
  if (!organizationId) throw new Error('Organization ID is required');

  // Verify authentication and role
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'owner' && profile.role !== 'admin')) {
    throw new Error('Forbidden: Only authorized resource owners or administrators can upload images');
  }

  // Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Invalid file format "${file.type}". Allowed formats: JPEG, PNG, WebP, GIF, SVG`);
  }

  // Validate size
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB limit`);
  }

  // Generate unique and deterministic storage path: <org_id>/<timestamp>-<random>.<ext>
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanOrgId = organizationId.replace(/[^a-zA-Z0-9-]/g, '');
  const uniqueKey = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const filePath = `${cleanOrgId}/${uniqueKey}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('resource-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error('[uploadResourceImage] Upload error:', uploadError.message);
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  // Retrieve public URL
  const { data: urlData } = supabase.storage
    .from('resource-images')
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to generate public URL for uploaded image');
  }

  return urlData.publicUrl;
}

/**
 * Retrieves the availability schedule and operating hours for a resource.
 */
export async function getResourceAvailability(resourceId: string): Promise<ResourceAvailabilityInfo> {
  const resource = await getResourceById(resourceId);
  if (!resource) {
    throw new Error('Resource not found');
  }

  return resource.availability_info;
}

/**
 * Reusable eligibility validation function for reservation requests.
 * Evaluates operational status, prerequisite training requirements, and user affiliation.
 *
 * @param resourceId - Target resource ID
 * @param userId - Optional specific user ID (defaults to current authenticated user)
 */
export async function checkResourceEligibility(
  resourceId: string,
  userId?: string
): Promise<ResourceEligibilityResult> {
  const resource = await getResourceById(resourceId);
  if (!resource) {
    return {
      eligible: false,
      reasons: ['Resource does not exist or has been retired'],
      checks: {
        isActive: false,
        isAvailable: false,
        trainingRequired: false,
        hasOrganizationAffiliation: false,
      },
    };
  }

  const reasons: string[] = [];
  const isActive = resource.status !== 'unavailable';
  const isAvailable = resource.status === 'available';

  if (!isActive) {
    reasons.push('Resource is currently marked as unavailable');
  } else if (!isAvailable) {
    reasons.push(`Resource is currently under ${resource.status}`);
  }

  // Determine user context
  let hasOrganizationAffiliation = true;
  let targetProfile: Awaited<ReturnType<typeof getCurrentProfile>> = null;

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    targetProfile = profile;
  } else {
    targetProfile = await getCurrentProfile();
  }

  if (targetProfile) {
    if (!targetProfile.organization_id) {
      hasOrganizationAffiliation = false;
      reasons.push('User is not linked to a verified institution');
    }
  }

  if (resource.training_required) {
    reasons.push('Mandatory operator training / safety certification required prior to session');
  }

  // The resource is eligible if it is available and has no blocking status issues
  const eligible = isAvailable;

  return {
    eligible,
    reasons,
    checks: {
      isActive,
      isAvailable,
      trainingRequired: resource.training_required,
      hasOrganizationAffiliation,
    },
  };
}
