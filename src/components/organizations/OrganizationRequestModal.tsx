import React, { useEffect, useState } from 'react';
import { X, Building, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { getOrganizations } from '@/services/organizations';
import { useMyMembershipRequests } from '@/hooks/useOrganizationMembership';
import type { Organization, OrganizationMembershipRequest } from '@/types/domain';

interface Props {
  onClose: () => void;
}

/**
 * Modal that lets a seeker browse verified organizations and submit a membership request.
 * Also shows the status of any existing requests.
 */
export const OrganizationRequestModal: React.FC<Props> = ({ onClose }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { requests, loading: reqLoading, fetchMyRequests, submitRequest } = useMyMembershipRequests();

  // Load verified organizations and existing requests on mount
  useEffect(() => {
    setOrgsLoading(true);
    Promise.all([
      getOrganizations().then((orgs) =>
        orgs.filter((o) => o.verification_status === 'verified')
      ),
      fetchMyRequests(),
    ])
      .then(([verifiedOrgs]) => {
        setOrganizations(verifiedOrgs);
        if (verifiedOrgs.length > 0) setSelectedOrgId(verifiedOrgs[0].id);
      })
      .catch((err: unknown) => {
        setOrgsError(err instanceof Error ? err.message : 'Failed to load organizations');
      })
      .finally(() => setOrgsLoading(false));
  }, [fetchMyRequests]);

  const pendingRequest = requests.find((r) => r.status === 'pending');
  const approvedRequest = requests.find((r) => r.status === 'approved');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitRequest(selectedOrgId);
      setSubmitSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-navy-950">Request Organization Membership</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Already approved */}
          {approvedRequest && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">Membership approved</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You are affiliated with{' '}
                  <span className="font-semibold">
                    {approvedRequest.organization?.name || 'your organization'}
                  </span>
                  . You can now request resources.
                </p>
              </div>
            </div>
          )}

          {/* Pending request exists */}
          {pendingRequest && !approvedRequest && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Membership request pending</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your request to join{' '}
                  <span className="font-semibold">
                    {pendingRequest.organization?.name || 'the organization'}
                  </span>{' '}
                  is awaiting admin review. You will be able to reserve resources once approved.
                </p>
              </div>
            </div>
          )}

          {/* History of all requests */}
          {!reqLoading && requests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Your request history</p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {requests.map((req: OrganizationMembershipRequest) => (
                  <div key={req.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium text-navy-950 truncate">
                      {req.organization?.name || req.organization_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        req.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : req.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit new request — hide if already approved or pending */}
          {!approvedRequest && !pendingRequest && (
            <>
              {submitSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Request submitted</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      An admin will review your affiliation request. You will be notified on approval.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      To reserve institutional resources you must be affiliated with a participating
                      organization. Select a verified institution below and submit a membership request.
                      An administrator will review and approve your affiliation.
                    </p>
                  </div>

                  {orgsError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-rose-800">{orgsError}</p>
                    </div>
                  )}

                  {submitError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-rose-800">{submitError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Organization
                    </label>
                    {orgsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading verified institutions...</span>
                      </div>
                    ) : organizations.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No verified organizations found. Contact your administrator.
                      </p>
                    ) : (
                      <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-navy-900"
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} — {org.organization_type.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || orgsLoading || organizations.length === 0}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting request...</span>
                      </>
                    ) : (
                      <>
                        <Building className="w-4 h-4" />
                        <span>Submit Membership Request</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

