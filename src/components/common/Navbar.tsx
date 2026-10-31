import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Repeat, ArrowRight, Menu, X, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, profile, role } = useAuth()

  const navLinks = [
    { name: 'Discover Resources', href: '/resources' },
    { name: 'Impact & Sustainability', href: '/impact' },
    { name: 'How It Works', href: '/#how-it-works' },
    { name: 'Institutional Trust', href: '/#trust-safety' },
  ]

  const getDashboardPath = () => {
    if (role === 'owner') return '/owner'
    if (role === 'admin') return '/admin'
    return '/dashboard'
  }

  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Portal'

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center text-white shadow-sm group-hover:bg-navy-800 transition-colors">
              <Repeat className="w-5 h-5 text-brand-400 group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-navy-950 font-sans">
                  Resource<span className="text-brand-600">Loop</span>
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.2 text-[10px] uppercase tracking-wider font-semibold bg-slate-100 text-slate-600 rounded">
                  EDU
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium tracking-tight -mt-1 hidden sm:block">
                Smart Institutional Resource Network
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isCurrent = location.pathname === link.href
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'text-brand-600 bg-brand-50/60 font-semibold'
                      : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100/70'
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to={getDashboardPath()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
              >
                <span>Enter Portal ({displayName})</span>
                <ArrowRight className="w-4 h-4 text-brand-400" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-navy-900 hover:bg-slate-100/70 rounded-lg transition-colors"
                >
                  Institutional Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-all shadow-brand-600/10 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Join Network</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-navy-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:text-navy-900 hover:bg-slate-50"
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {isAuthenticated ? (
              <Link
                to={getDashboardPath()}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg"
              >
                Enter Portal ({displayName})
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Institutional Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
                >
                  Join Network as Seeker
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
