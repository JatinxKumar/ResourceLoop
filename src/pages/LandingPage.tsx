import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ShieldCheck,
  Repeat,
  Microscope,
  FileCheck2,
  Lock,
  Building,
  TrendingDown,
  CheckCircle2,
  QrCode
} from 'lucide-react'
import { getAvailableResources } from '@/hooks/useResources'
import { ResourceCard } from '@/components/resources/ResourceCard'
import type { Resource } from '@/types/domain'

export const LandingPage: React.FC = () => {
  const [featuredResources, setFeaturedResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAvailableResources()
      .then((data) => setFeaturedResources(data.slice(0, 3)))
      .catch(() => setFeaturedResources([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden bg-gradient-to-b from-slate-100/80 via-white to-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <span>Next-Gen Institutional Resource Sharing</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-950 tracking-tight leading-[1.12]">
                Unlocking resources. <br />
                <span className="text-brand-600">Connecting possibilities.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                ResourceLoop eliminates research bottlenecks by enabling cross-departmental sharing of advanced laboratory instruments, supercomputing clusters, and prototyping facilities.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  to="/resources"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-navy-900 text-white font-semibold text-sm shadow-md hover:bg-navy-800 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-900"
                >
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-4 h-4 text-brand-400" />
                </Link>

                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-navy-900 font-semibold text-sm border border-slate-200 hover:bg-slate-50 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
                >
                  <span>Open Seeker Portal</span>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 border-t border-slate-200/70 flex flex-wrap items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  <span>Verified Academic Credentials</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand-600" />
                  <span>Institutional Escrow</span>
                </div>
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-brand-600" />
                  <span>Digital Custody Logs</span>
                </div>
              </div>
            </div>

            {/* Right Column: Key Metric Snapshot */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                      Prototype Analytics
                    </span>
                    <h3 className="text-lg font-bold text-navy-950 mt-0.5">Projected Campus Efficiency</h3>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Model Projection
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">Utilized Hours</span>
                    <div className="text-2xl font-bold text-navy-950 mt-1">12,480 hrs</div>
                    <span className="text-[11px] text-emerald-600 font-medium">+38% YoY</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">CapEx Avoidance</span>
                    <div className="text-2xl font-bold text-navy-950 mt-1">$342,000</div>
                    <span className="text-[11px] text-emerald-600 font-medium">Shared Budget</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">Shared Catalog</span>
                    <div className="text-2xl font-bold text-navy-950 mt-1">Live Database</div>
                    <span className="text-[11px] text-slate-500 font-medium">Multi-Institutional</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">Custody Audit</span>
                    <div className="text-2xl font-bold text-navy-950 mt-1">100%</div>
                    <span className="text-[11px] text-emerald-600 font-medium">Verified Handoff</span>
                  </div>
                </div>

                <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-3.5 flex items-start gap-3">
                  <Building className="w-5 h-5 text-brand-700 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-brand-900 leading-relaxed">
                    <strong>Inter-departmental reciprocity:</strong> Research groups earn equipment credits whenever external teams utilize their certified apparatus.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Institutional Problem & Solution */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <h2 className="text-xs font-bold text-brand-600 tracking-wider uppercase">
            The Institutional Challenge
          </h2>
          <p className="text-3xl font-extrabold text-navy-950 tracking-tight">
            Advanced equipment sits idle while neighboring researchers wait months.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Universities invest millions in specialized apparatus that run at under 35% utilization due to department silos, scheduling friction, and liability fears. ResourceLoop solves this.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover transition-all space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy-950">Underutilized Capital</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Expensive equipment like electron microscopes and high-end oscilloscopes remain dark outside specific semester classes or grant phases.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover transition-all space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Repeat className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy-950">Redundant Procurement</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Departments purchase identical $80,000 tools simply because inter-departmental borrowing lacked standardized trust and insurance policies.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover transition-all space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy-950">Accountability Deficit</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Informal lending risks damaged sensors, missing components, and uncalibrated setups. ResourceLoop introduces QR custody handoffs and automated condition checks.
            </p>
          </div>
        </div>
      </section>

      {/* How ResourceLoop Lifecycle Works */}
      <section id="how-it-works" className="bg-slate-100/80 py-20 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <h2 className="text-xs font-bold text-brand-600 tracking-wider uppercase">
              The Resource Lifecycle
            </h2>
            <p className="text-3xl font-extrabold text-navy-950 tracking-tight">
              A 4-step verified workflow from discovery to return.
            </p>
            <p className="text-sm text-slate-600">
              Structured protocols ensure equipment safety, custodian peace of mind, and researcher productivity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
              <span className="text-3xl font-black text-slate-200 absolute top-4 right-4">01</span>
              <div className="w-10 h-10 rounded-lg bg-navy-900 text-brand-400 flex items-center justify-center mb-4">
                <Microscope className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-navy-950 mb-1">Catalog Listing</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Lab custodians register instruments with required operator training levels and maintenance windows.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
              <span className="text-3xl font-black text-slate-200 absolute top-4 right-4">02</span>
              <div className="w-10 h-10 rounded-lg bg-navy-900 text-brand-400 flex items-center justify-center mb-4">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-navy-950 mb-1">Approval & Escrow</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Researchers submit reservations with project descriptions; faculty supervisors electronically sign off.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
              <span className="text-3xl font-black text-slate-200 absolute top-4 right-4">03</span>
              <div className="w-10 h-10 rounded-lg bg-navy-900 text-brand-400 flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-navy-950 mb-1">QR Custody Handoff</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Physical check-out requires scanning dynamic cryptographic QR codes, recording initial condition state.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
              <span className="text-3xl font-black text-slate-200 absolute top-4 right-4">04</span>
              <div className="w-10 h-10 rounded-lg bg-navy-900 text-brand-400 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-navy-950 mb-1">Return & Trust Score</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Post-use inspection releases security holds and increments institutional reputation credits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Catalog Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-xs font-bold text-brand-600 tracking-wider uppercase">
              Live Campus Catalog
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight mt-1">
              Featured High-Impact Assets
            </p>
          </div>
          <Link
            to="/resources"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            <span>View all catalog items</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading catalog...</div>
        ) : featuredResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : (
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
            No resources cataloged yet. Lab owners can list apparatus from the Custodian Console.
          </div>
        )}
      </section>

      {/* Trust & Safety Section */}
      <section id="trust-safety" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-navy-950 rounded-2xl p-8 sm:p-12 text-white border border-navy-900">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Campus Governance & Safety Charter</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Enterprise security tailored for academic integrity.
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every loan is governed by mutual departmental liability agreements. Integrated Single Sign-On (SSO) confirms enrollment, lab certifications, and faculty sponsorship.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10 pt-8 border-t border-navy-800">
            <div>
              <div className="text-brand-400 font-bold text-lg mb-1">100% Insured</div>
              <p className="text-xs text-slate-400">Institutional micro-escrow protects against accidental damage or loss.</p>
            </div>
            <div>
              <div className="text-brand-400 font-bold text-lg mb-1">Chain of Custody</div>
              <p className="text-xs text-slate-400">Time-stamped QR handoffs record possession transitions instantaneously.</p>
            </div>
            <div>
              <div className="text-brand-400 font-bold text-lg mb-1">Department Credits</div>
              <p className="text-xs text-slate-400">Lending labs earn internal credits for consumable reagents and maintenance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 shadow-lg space-y-6 max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-navy-950 tracking-tight">
            Ready to optimize your institutional resource utilization?
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Join hundreds of research laboratories, engineering shops, and academic centers already sharing infrastructure.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-md transition-colors"
            >
              Register as Seeker
            </Link>
            <Link
              to="/resources"
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-navy-950 font-semibold text-sm rounded-xl transition-colors"
            >
              Browse Catalog
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
