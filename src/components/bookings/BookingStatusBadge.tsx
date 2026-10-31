import React from 'react';
import { StatusBadge, type BadgeVariant } from '@/components/common/StatusBadge';
import type { Booking } from '@/types/domain';

type BookingStatusBadgeProps = {
  status: Booking['status'];
  className?: string;
};

/** Presentation component that forwards a booking status to the existing StatusBadge */
export const BookingStatusBadge: React.FC<BookingStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  return <StatusBadge status={status as BadgeVariant} className={className} />;
};
