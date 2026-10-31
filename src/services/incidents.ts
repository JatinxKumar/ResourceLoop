import { supabase } from '@/lib/supabase'
import type { Incident, CreateIncidentDTO, ResolveIncidentDTO } from '@/types/domain'

/**
 * Fetch all incidents accessible to the authenticated user.
 * RLS enforces: reporter = auth.uid() OR is_admin() OR asset owner.
 */
export async function fetchIncidents(): Promise<Incident[]> {
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email, avatar_url),
      booking:bookings(
        id,
        resource:resources(id, title, category, location, owner_id)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchIncidents] Error:', error.message)
    throw new Error(error.message)
  }

  return (data as Incident[]) || []
}

/**
 * Log an incident for a booking or asset.
 * Enforces authenticated reporter = auth.uid() per RLS.
 */
export async function reportIncident(dto: CreateIncidentDTO): Promise<Incident> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required to file an incident')

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      booking_id: dto.booking_id || null,
      reported_by: user.id,
      incident_type: dto.incident_type,
      description: dto.description.trim(),
      status: 'open',
    })
    .select(`
      *,
      reporter:profiles!incidents_reported_by_fkey(id, full_name, email),
      booking:bookings(id, resource:resources(title))
    `)
    .single()

  if (error) {
    console.error('[reportIncident] Error:', error.message)
    throw new Error(error.message)
  }

  return data as Incident
}

/**
 * Resolve an incident (restricted to asset owner or admin).
 */
export async function resolveIncident(
  incidentId: string,
  dto: ResolveIncidentDTO
): Promise<Incident> {
  const { data, error } = await supabase
    .from('incidents')
    .update({
      status: dto.status,
      resolution_notes: dto.resolution_notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId)
    .select()
    .single()

  if (error) {
    console.error('[resolveIncident] Error:', error.message)
    throw new Error(error.message)
  }

  return data as Incident
}
