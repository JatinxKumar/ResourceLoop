import React, { useState, useEffect } from 'react'
import {
  Server,
  Users,
  Repeat,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Building,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/dashboard/StatCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { Organization, Profile, Resource, Booking } from '@/types/domain'

export const AdminDashboardPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [totalResources, setTotalResources] = useState<number>(0)
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [totalBookings, setTotalBookings] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAdminTelemetry = async () => {
    setLoading(true)
    setError(null)
    try {
      const [orgsRes, resCountRes, usersCountRes, bookingsCountRes] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('resources').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true })
      ])

      if (orgsRes.data) setOrganizations(orgsRes.data as Organization[])
      setTotalResources(resCountRes.count || 0)
      setTotalUsers(usersCountRes.count || 0)
      setTotalBookings(bookingsCountRes.count || 0)
    } catch (err: unknown) {
      console.error('Error fetching admin telemetry:', err)
      setError('Could not query complete institutional telemetry from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdminTelemetry()
  }, [])

  if (loading) {
    return <LoadingSpinner fullPage label="Retrieving campus governance telemetry from Supabase..." />
  }

  return (
    <div className="space-y-8">
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
            Central Research Oversight • Live PostgreSQL database telemetry and organizational compliance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAdminTelemetry}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh Database Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Live Admin Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Catalog Assets"
          value={totalResources}
          change="Across all labs"
          changeType="positive"
          icon={Server}
        />
        <StatCard
          label="Institutional Members"
          value={totalUsers}
          change="Profiles registered"
          changeType="positive"
          icon={Users}
        />
        <StatCard
          label="Cross-Dept Reservations"
          value={totalBookings}
          change="Total logged"
          changeType="positive"
          icon={Repeat}
        />
        <StatCard
          label="Participating Institutions"
          value={organizations.length}
          change="Verified partners"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      {/* Participating Institutions & Organizations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Participating Institutional Entities</h2>
            <p className="text-xs text-slate-500">Live organization registry and verification status in Supabase</p>
          </div>
          <span className="text-xs text-slate-500">{organizations.length} Organizations Enrolled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Organization Name</th>
                <th className="p-3">Classification</th>
                <th className="p-3">Campus Address / Location</th>
                <th className="p-3">Verification Status</th>
                <th className="p-3 text-right">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.map((org) => (
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
                  <td className="p-3 text-right text-slate-400 font-mono text-[11px]">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
