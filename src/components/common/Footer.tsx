import React from 'react'
import { Link } from 'react-router-dom'
import { Repeat, ShieldCheck, HeartHandshake, FileText, Globe } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <Repeat className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Resource<span className="text-brand-400">Loop</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Unlocking resources. Connecting possibilities. An enterprise institutional network enabling cross-departmental sharing of research instruments, fabrication tools, and computing infrastructure.
            </p>
            <div className="flex items-center gap-2 text-xs text-brand-400 bg-navy-900/80 px-3 py-1.5 rounded-md border border-navy-800 w-fit">
              <ShieldCheck className="w-4 h-4" />
              <span>Campus Verified Credentials & Institutional Escrow</span>
            </div>
          </div>

          {/* Column: Platform */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/resources" className="hover:text-white transition-colors">Catalog Directory</Link>
              </li>
              <li>
                <Link to="/impact" className="hover:text-white transition-colors">Impact & Sustainability</Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">Seeker Portal</Link>
              </li>
              <li>
                <Link to="/owner" className="hover:text-white transition-colors">Lab Custodian Console</Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors">Campus Governance</Link>
              </li>
            </ul>
          </div>

          {/* Column: Capabilities */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Capabilities</h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span>QR Custody Handoff</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span>Supervisor Workflows</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span>Security Deposit Escrow</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span>Carbon Footprint Audits</span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span>Calibration Tracking</span>
              </li>
            </ul>
          </div>

          {/* Column: Institutional Trust */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Compliance</h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Inter-Dept MoU Template</span>
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
                <HeartHandshake className="w-4 h-4 text-slate-400" />
                <span>Equipment Liability Policy</span>
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
                <Globe className="w-4 h-4 text-slate-400" />
                <span>Federated Campus SSO</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-navy-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} ResourceLoop Technologies. Built for Academic & Research Institutions.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Charter</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Custody</span>
            <span className="hover:text-slate-300 cursor-pointer">Lab Safety Protocols</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
