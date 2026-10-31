import React, { useState, useEffect } from 'react'
import {
  Server,
  Users,
  Repeat,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Building,
  AlertCircle,
  RefreshCw,
  FileText,
  AlertTriangle,
  Check,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { Organization, Profile, Incident, AuditLog } from '@/types/domain'
import {
  getAdminPlatformTelemetry,
  fetchAdminAuditLogs,
  fetchAdminUsers,
  updateOrganizationVerification,
  type PlatformTelemetry,
} from '@/services/admin'
import { fetchIncidents, resolveIncident } from '@/services/incidents'

export const AdminDashboardPage: React.FC = () => {
  const [telemetry, setTelemetry] = useState<PlatformTelemetry | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'audit' | 'users'>('overview')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Incident resolution modal state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'closed'>('resolved')

  const loadAllAdminData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [tel, logs, incs, userList] = await Promise.all([
        getAdminPlatformTelemetry(),
        fetchAdminAuditLogs(30),
        fetchIncidents().catch(() => [] as Incident[]),
        fetchAdminUsers().catch(() => [] as Profile[]),
      ])
      setTelemetry(tel)
      setAuditLogs(logs)
      setIncidents(incs)
      setUsers(userList)
    } catch (err: unknown) {
      console.error('Error fetching admin data:', err)
      setError('Could not query complete institutional telemetry from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllAdminData()
  }, [])

  const handleOrgVerification = async (orgId: string, status: 'verified' | 'rejected' | 'pending') => {
    setActionLoading(true)
    try {
      await updateOrganizationVerification(orgId, status)
      setSuccessMsg(`Organization status successfully marked as ${status}.`)
      await loadAllAdminData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update organization status.'
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIncident) return
    setActionLoading(true)
    try {
      await resolveIncident(selectedIncident.id, {
        status: resolutionStatus,
        resolution_notes: resolutionNotes.trim() || 'Reviewed and confirmed by administrator oversight.',
      })
      setSuccessMsg(`Incident #${selectedIncident.id.substring(0, 8)} marked as ${resolutionStatus}.`)
      setSelectedIncident(null)
      setResolutionNotes('')
      await loadAllAdminData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve incident.'
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullPage label="Retrieving campus governance telemetry from Supabase..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Campus Governance & Audit</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-navy-900 text-white">
              Institutional Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Central Research Oversight • Live PostgreSQL database telemetry, incident oversight & immutable audit logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllAdminData}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh Database Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p>{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p>{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Live Admin Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Catalog Assets"
          value={telemetry?.totalResources || 0}
          change="Across all labs"
          changeType="positive"
          icon={Server}
        />
        <StatCard
          label="Profiles"
          value={telemetry?.totalUsers || 0}
          change="Registered seekers/owners"
          changeType="positive"
          icon={Users}
        />
        <StatCard
          label="Reservations"
          value={telemetry?.totalBookings || 0}
          change="Logged platform-wide"
          changeType="positive"
          icon={Repeat}
        />
        <StatCard
          label="Reported Incidents"
          value={telemetry?.totalIncidents || 0}
          change="Damage & safety flags"
          changeType={telemetry?.totalIncidents ? 'negative' : 'neutral'}
          icon={AlertTriangle}
        />
        <StatCard
          label="Audit Log Entries"
          value={telemetry?.totalAuditLogs || 0}
          change="Immutable compliance records"
          changeType="neutral"
          icon={FileText}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Institutions ({telemetry?.organizations.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'incidents'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Incidents</span>
          {incidents.filter((i) => i.status === 'open').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'audit'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Audit Log ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'users'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Institutional Members ({users.length})
        </button>
      </div>

      {/* TAB 1: Organizations */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-navy-950">Participating Institutional Entities</h2>
              <p className="text-xs text-slate-500">Live organization registry and verification status in Supabase</p>
            </div>
            <span className="text-xs text-slate-500">{telemetry?.organizations.length || 0} Organizations Enrolled</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Organization Name</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Campus Address / Location</th>
                  <th className="p-3">Verification Status</th>
                  <th className="p-3 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetry?.organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-navy-950 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{org.name}</span>
                    </td>
                    <td className="p-3 capitalize font-medium text-slate-600">
                      {org.organization_type.replace('_', ' ')}
                    </td>
                    <td className="p-3 text-slate-500 truncate max-w-xs">{org.address || 'Campus Network'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          org.verification_status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {org.verification_status === 'verified' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                        )}
                        <span className="capitalize">{org.verification_status}</span>
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {org.verification_status !== 'verified' ? (
                        <button
                          onClick={() => handleOrgVerification(org.id, 'verified')}
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                        >
                          Verify Org
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOrgVerification(org.id, 'pending')}
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Incidents */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-navy-950">Campus Equipment Incidents & Damage Reports</h2>
              <p className="text-xs text-slate-500">Human-in-the-loop dispute review and custodian incident triage</p>
            </div>
            <span className="text-xs text-slate-500">{incidents.length} Logged Incidents</span>
          </div>

          {incidents.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-1">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-navy-950">No Active Incidents</p>
              <p className="text-slate-400">All equipment has been returned in healthy operating condition.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Incident ID</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Reported By</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Oversight Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-500">#{inc.id.substring(0, 8)}</td>
                      <td className="p-3 capitalize font-bold text-navy-950">{inc.incident_type}</td>
                      <td className="p-3 text-slate-700 max-w-sm">
                        <p className="line-clamp-2 leading-relaxed">{inc.description}</p>
                        {inc.resolution_notes && (
                          <p className="text-[10px] text-emerald-700 bg-emerald-50 p-1.5 rounded mt-1">
                            Resolution: {inc.resolution_notes}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {inc.reporter?.full_name || inc.reporter?.email || 'Custodian'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            inc.status === 'open'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : inc.status === 'investigating'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {inc.status !== 'resolved' && inc.status !== 'closed' ? (
                          <button
                            onClick={() => setSelectedIncident(inc)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 transition-colors"
                          >
                            Review &amp; Resolve
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-navy-950">Immutable PostgreSQL Audit Trail</h2>
              <p className="text-xs text-slate-500">Append-only compliance logs recording state transitions and custody handshakes</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{auditLogs.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-bold text-navy-950 text-[11px]">{log.action}</td>
                    <td className="p-3 uppercase text-[10px] tracking-wider text-slate-500 font-semibold">
                      {log.entity_type}
                    </td>
                    <td className="p-3 text-slate-600 truncate max-w-[150px]">
                      {log.actor?.full_name || log.actor?.email || 'System Routine'}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-600 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-navy-950">Institutional Member Profiles</h2>
              <p className="text-xs text-slate-500">Registered seekers, lab owners and campus administrators</p>
            </div>
            <span className="text-xs text-slate-500">{users.length} Enrolled Members</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Institutional Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Affiliated Organization</th>
                  <th className="p-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-navy-950">{u.full_name || 'Anonymous User'}</td>
                    <td className="p-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          u.role === 'admin'
                            ? 'bg-navy-900 text-white'
                            : u.role === 'owner'
                            ? 'bg-brand-50 text-brand-800 border border-brand-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{u.organization?.name || 'Unassigned'}</td>
                    <td className="p-3 text-right font-mono text-[10px] text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incident Review Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Administrative Incident Oversight</h3>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-semibold text-navy-950 block capitalize">
                  {selectedIncident.incident_type} Incident
                </span>
                <p className="text-slate-600 mt-1 leading-relaxed">{selectedIncident.description}</p>
              </div>
            </div>

            <form onSubmit={handleResolveIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Decision</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as 'resolved' | 'closed')}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="resolved">Mark Resolved (Human Reviewed)</option>
                  <option value="closed">Close Case (No Penalty / Repaired)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution &amp; Oversight Notes
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Summarize human administrative findings, calibration checks, or repair disposition..."
                  rows={3}
                  required
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-lg"
                >
                  Commit Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
