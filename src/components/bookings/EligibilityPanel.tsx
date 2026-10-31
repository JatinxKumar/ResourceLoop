import React from 'react';
import { Tag } from 'lucide-react';

type EligibilityPanelProps = {
  requirements?: string;
};

/**
 * Simple presentational panel that shows the eligibility conditions for a resource.
 * It is used in both the ResourceDetailPage and the OwnerBookingsPage.
 */
export const EligibilityPanel: React.FC<EligibilityPanelProps> = ({ requirements }) => {
  if (!requirements) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-slate-600" />
        <h3 className="text-sm font-medium text-slate-900">Eligibility Requirements</h3>
      </div>
      <p className="text-sm text-slate-700">{requirements}</p>
    </div>
  );
};
