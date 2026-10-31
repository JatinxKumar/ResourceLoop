/**
 * ResourceLoop - Profile Service
 * Handles user profile retrieval and updates backed by Supabase.
 * Role escalation is strictly prevented at both application and database trigger levels.
 */

import { supabase } from '../lib/supabase';
import type { Profile, UpdateProfileDTO } from '../types/domain';

/**
 * Retrieves the profile of the currently authenticated user.
 * Expands associated organization metadata if available.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[getCurrentProfile] Error fetching profile:', error.message);
    throw new Error(`Failed to retrieve profile: ${error.message}`);
  }

  // Graceful fallback: If the profile record hasn't been created yet by the auth trigger,
  // provision a safe default 'seeker' profile.
  if (!data) {
    const defaultProfile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
      email: user.email || '',
      role: 'seeker' as const, // Strict enforcement: Normal signups are always 'seeker'
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert(defaultProfile)
      .select(`*, organization:organizations(*)`)
      .single();

    if (createError) {
      console.error('[getCurrentProfile] Fallback profile creation failed:', createError.message);
      throw new Error(`Profile creation failed: ${createError.message}`);
    }

    return created as Profile;
  }

  return data as Profile;
}

/**
 * Retrieves a user profile by user ID.
 * Returns null if the profile does not exist.
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error(`[getProfileById] Error fetching profile for ${userId}:`, error.message);
    throw new Error(`Failed to retrieve profile: ${error.message}`);
  }

  return (data as Profile) || null;
}

/**
 * Updates the current user's profile details.
 * Strictly prevents self-promotion: Role cannot be modified through this function.
 */
export async function updateCurrentProfile(input: UpdateProfileDTO): Promise<Profile> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: User must be authenticated to update their profile');
  }

  // Sanitize payload to whitelist only safe fields (no role escalation)
  const safePayload: Record<string, unknown> = {};

  if (input.full_name !== undefined) {
    safePayload.full_name = input.full_name.trim();
  }
  if (input.avatar_url !== undefined) {
    safePayload.avatar_url = input.avatar_url;
  }
  if (input.organization_id !== undefined) {
    safePayload.organization_id = input.organization_id || null;
  }

  if (Object.keys(safePayload).length === 0) {
    const current = await getCurrentProfile();
    if (!current) throw new Error('Profile not found');
    return current;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(safePayload)
    .eq('id', user.id)
    .select(`
      *,
      organization:organizations(*)
    `)
    .single();

  if (error) {
    console.error('[updateCurrentProfile] Error updating profile:', error.message);
    throw new Error(`Profile update failed: ${error.message}`);
  }

  return data as Profile;
}
