/**
 * ResourceLoop - Organization Service
 * Handles queries for institutional partners, laboratories, and universities.
 */

import { supabase } from '../lib/supabase';
import type { Organization } from '../types/domain';

/**
 * Retrieves all verified participating organizations, ordered alphabetically by name.
 */
export async function getOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getOrganizations] Error fetching organizations:', error.message);
    throw new Error(`Failed to retrieve organizations: ${error.message}`);
  }

  return (data as Organization[]) || [];
}

/**
 * Retrieves an organization by its unique ID.
 * Returns null if the organization is not found.
 */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (!id) {
    throw new Error('Organization ID is required');
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`[getOrganizationById] Error fetching organization ${id}:`, error.message);
    throw new Error(`Failed to retrieve organization: ${error.message}`);
  }

  return (data as Organization) || null;
}
