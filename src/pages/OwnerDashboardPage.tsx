import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  Activity,
  Clock,
  Award,
  Check,
  X,
  Plus,
  Wrench,
  ShieldCheck,
  Building,
  Info
} from 'lucide-react'
import { DEMO_OWNER_STATS, DEMO_BOOKINGS, DEMO_RESOURCES, UIBooking } from '@/utils/ui-fixtures'
import { StatCard } from '@/components/dashboard/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'

export const OwnerDashboardPage: React.FC = () => {
  const [approvalsQueue, setApprovalsQueue] = useState<UIBooking[]>(
    DEMO_BOOKINGS.filter((b) => b.status === 'pending')
  )

  const statIcons = [Layers, Activity, Clock, Award]

  const handleApprove = (id: string) => {
    setApprovalsQueue(approvalsQueue.filter((b) => b.id !== id))
  }

  const handleDecline = (id: string) => {
    setApprovalsQueue(approvalsQueue.filter((b) => b.id !== id))
  }

  return (
    <div className="space-y-8">
      {/* Visual disclaimer */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Lab Custodian Console Prototype:</strong> Displaying simulated facility metrics and pending reservation approval queue for visual workflow testing.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Lab Custodian Console</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Facility Owner
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Department of Advanced Materials & Instrumentation • Managing 12 catalogued apparatus
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('Add Asset dialog is available in subsequent release.')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-brand-400" />
            <span>Register New Asset</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEMO_OWNER_STATS.map((stat, idx) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            changeType={stat.changeType}
            icon={statIcons[idx]}
          />
        ))}
      </div>

      {/* Section 1: Pending Reservation Requests (Approvals Queue) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Pending Seeker Reservation Requests</h2>
            <p className="text-xs text-slate-500">Review research proposals and approve equipment release</p>
          </div>
          <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
            {approvalsQueue.length} Pending
          </span>
        </div>

        {approvalsQueue.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {approvalsQueue.map((req) => (
              <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-navy-950">{req.seekerName}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">{req.resourceTitle}</span>
                  </div>
                  <p className="text-xs text-slate-600 italic">"{req.purpose}"</p>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>Dates: {req.startDate} → {req.endDate}</span>
                    <span>Code: {req.checkInCode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDecline(req.id)}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5 text-rose-500" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize Access</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            All reservation requests have been processed. Queue is clear.
          </div>
        )}
      </div>

      {/* Section 2: Laboratory Inventory State */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Managed Laboratory Equipment</h2>
            <p className="text-xs text-slate-500">Live operational status and calibration schedules</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Asset Code</th>
                <th className="p-3">Equipment Name</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3">Condition</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DEMO_RESOURCES.slice(0, 4).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-mono font-semibold text-slate-700">{r.code}</td>
                  <td className="p-3 font-bold text-navy-950">{r.title}</td>
                  <td className="p-3 text-slate-500">{r.location}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 font-medium text-slate-700">{r.condition}</td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/resources/${r.id}`}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Manage Log
                    </Link>
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
