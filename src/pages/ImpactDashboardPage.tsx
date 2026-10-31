import React from 'react'
import {
  TrendingUp,
  Leaf,
  DollarSign,
  Clock,
  Building,
  Award,
  Download,
  Info
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts'
import { StatCard } from '@/components/dashboard/StatCard'

export const ImpactDashboardPage: React.FC = () => {
  const capexData = [
    { month: 'Jun', savings: 24000, bookings: 42 },
    { month: 'Jul', savings: 31000, bookings: 56 },
    { month: 'Aug', savings: 28000, bookings: 51 },
    { month: 'Sep', savings: 48000, bookings: 84 },
    { month: 'Oct', savings: 65000, bookings: 112 },
    { month: 'Nov (Proj)', savings: 74000, bookings: 130 },
  ]

  const utilizationData = [
    { department: 'Materials Sci.', rate: 84 },
    { department: 'Computer Sci.', rate: 92 },
    { department: 'Mechanical', rate: 76 },
    { department: 'Biomedical', rate: 81 },
    { department: 'Media Labs', rate: 68 },
    { department: 'Earth Sci.', rate: 64 },
  ]

  return (
    <div className="space-y-8">
      {/* Visual disclaimer */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Simulated Environmental & Fiscal Impact:</strong> Telemetry charts visualize institutional return-on-capital and sustainability metrics generated through cross-departmental sharing.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Institutional Impact & Sustainability</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Campus ESG Report
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quantifying avoided CapEx duplication, embodied carbon mitigation, and research velocity gains.
          </p>
        </div>

        <button
          onClick={() => alert('ESG Report export compiled successfully.')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-brand-400" />
          <span>Download ESG Summary</span>
        </button>
      </div>

      {/* Impact Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cumulative CapEx Avoidance"
          value="$342,000"
          change="+46% vs Prev Term"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          label="Embodied CO2 Saved"
          value="18.2 Tons"
          change="Equal to 420 trees"
          changeType="positive"
          icon={Leaf}
        />
        <StatCard
          label="Shared Instrument Hours"
          value="12,480 hrs"
          change="+34% equipment uptime"
          changeType="positive"
          icon={Clock}
        />
        <StatCard
          label="Cross-Discipline Grants"
          value="14 Funded"
          change="Multi-dept collaborations"
          changeType="positive"
          icon={Award}
        />
      </div>

      {/* Charts Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CapEx Savings Over Time */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-navy-950">Capital Expenditure Avoidance Velocity ($)</h2>
              <p className="text-xs text-slate-500">Monthly value saved by sharing rather than duplicate purchasing</p>
            </div>
            <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
              Total: $342k
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={capexData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'CapEx Saved']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="savings" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#savingsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization by Department */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-navy-950">Apparatus Utilization (%)</h2>
              <p className="text-xs text-slate-500">Active working hours vs available hours</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">Target: 75%+</span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Utilization Rate']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="rate" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
