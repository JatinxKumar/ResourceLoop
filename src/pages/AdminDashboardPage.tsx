import React from 'react'
import {
  Server,
  Users,
  Repeat,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Building,
  FileSpreadsheet,
  Info
} from 'lucide-react'
import { DEMO_ADMIN_STATS } from '@/utils/ui-fixtures'
import { StatCard } from '@/components/dashboard/StatCard'

export const AdminDashboardPage: React.FC = () => {
  const statIcons = [Server, Users, Repeat, TrendingUp]

  const departmentsData = [
    { name: 'Materials Science & NanoTech', assets: 114, activeLoans: 42, trustScore: '99.4%', status: 'Compliant' },
    { name: 'School of Computer Science & AI', assets: 68, activeLoans: 58, trustScore: '98.8%', status: 'Compliant' },
    { name: 'Mechanical & Robotics Foundry', assets: 92, activeLoans: 31, trustScore: '97.2%', status: 'Compliant' },
    { name: 'Biomedical & Life Sciences', assets: 120, activeLoans: 49, trustScore: '99.1%', status: 'Compliant' },
    { name: 'Film, Media & Communications', assets: 45, activeLoans: 22, trustScore: '96.5%', status: 'Review Flag' },
    { name: 'Earth & Environmental Sciences', assets: 47, activeLoans: 18, trustScore: '98.0%', status: 'Compliant' },
  ]

  const complianceAlerts = [
    {
      id: 'al-1',
      title: 'Periodic Sensor Calibration Due',
      dept: 'Electrical & Computer Engineering',
      resource: 'Keysight Oscilloscope (LAB-ECE-630)',
      severity: 'Medium',
      action: 'Notify Lab Manager'
    },
    {
      id: 'al-2',
      title: 'Inter-Departmental Escrow Settlement',
      dept: 'Materials vs Biomedical',
      resource: 'Monthly reciprocal credit balance clearance ($4,250)',
      severity: 'Low',
      action: 'Process Ledger'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Visual disclaimer */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Campus Governance View:</strong> Administrative overview of institution-wide sharing metrics, department compliance scores, and audit flags.
        </p>
      </div>

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
            Central Research Oversight Office • Comprehensive campus telemetry and liability ledger
          </p>
        </div>

        <button
          onClick={() => alert('Campus Audit Export is scheduled for periodic archiving.')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Audit Report</span>
        </button>
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEMO_ADMIN_STATS.map((stat, idx) => (
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

      {/* Departmental Reciprocity & Governance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-navy-950">Departmental Compliance & Utilization</h2>
            <p className="text-xs text-slate-500">Cross-department equipment sharing and safety compliance ratings</p>
          </div>
          <span className="text-xs text-slate-500">6 Faculties Participating</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Department Name</th>
                <th className="p-3">Cataloged Units</th>
                <th className="p-3">Active Cross-Loans</th>
                <th className="p-3">Safety & Trust Score</th>
                <th className="p-3">Governance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentsData.map((d) => (
                <tr key={d.name} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-bold text-navy-950 flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{d.name}</span>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{d.assets} assets</td>
                  <td className="p-3 font-semibold text-brand-600">{d.activeLoans} active</td>
                  <td className="p-3 font-mono font-semibold text-navy-900">{d.trustScore}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        d.status === 'Compliant'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {d.status === 'Compliant' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                      )}
                      <span>{d.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance & Audit Alerts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Operational Safety & Audit Flags</span>
        </h2>

        <div className="space-y-3">
          {complianceAlerts.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy-950">{item.title}</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    {item.severity}
                  </span>
                </div>
                <p className="text-slate-600">{item.dept} • {item.resource}</p>
              </div>

              <button
                onClick={() => window.alert(`Triggered: ${item.action}`)}
                className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold self-start sm:self-auto transition-colors"
              >
                {item.action}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
