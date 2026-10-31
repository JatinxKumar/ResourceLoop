/**
 * ResourceLoop - Notification Service
 * Manages user alerts, booking status changes, reminders, and unread counts.
 */

import { supabase } from '../lib/supabase';
import type { Notification } from '../types/domain';
import { getCurrentProfile } from './profiles';

/**
 * Retrieves notifications for the authenticated user (or specified user).
 */
export async function getUserNotifications(
  userId?: string,
  limit: number = 30
): Promise<Notification[]> {
  let targetUserId = userId;
  if (!targetUserId) {
    const profile = await getCurrentProfile();
    if (!profile) return [];
    targetUserId = profile.id;
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getUserNotifications] Error fetching notifications:', error.message);
    throw new Error(`Failed to retrieve notifications: ${error.message}`);
  }

  return (data as Notification[]) || [];
}

/**
 * Retrieves the count of unread notifications for navigation badges.
 */
export async function getUnreadNotificationCount(userId?: string): Promise<number> {
  let targetUserId = userId;
  if (!targetUserId) {
    const profile = await getCurrentProfile();
    if (!profile) return 0;
    targetUserId = profile.id;
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', targetUserId)
    .eq('is_read', false);

  if (error) {
    console.error('[getUnreadNotificationCount] Error fetching count:', error.message);
    return 0;
  }

  return count || 0;
}

/**
 * Marks an individual notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!notificationId) throw new Error('Notification ID is required');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error(`[markNotificationAsRead] Error marking ${notificationId} as read:`, error.message);
    throw new Error(`Failed to update notification: ${error.message}`);
  }
}

/**
 * Marks all notifications as read for the user.
 */
export async function markAllNotificationsAsRead(userId?: string): Promise<void> {
  let targetUserId = userId;
  if (!targetUserId) {
    const profile = await getCurrentProfile();
    if (!profile) return;
    targetUserId = profile.id;
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', targetUserId)
    .eq('is_read', false);

  if (error) {
    console.error('[markAllNotificationsAsRead] Error marking all as read:', error.message);
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}

/**
 * Directly provisions a notification for a user.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  linkUrl?: string
): Promise<Notification> {
  if (!userId) throw new Error('User ID is required');

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: title.trim(),
      message: message.trim(),
      link_url: linkUrl?.trim() || null,
      is_read: false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[createNotification] Insert error:', error.message);
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as Notification;
}

/**
 * Deletes a notification by ID.
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  if (!notificationId) throw new Error('Notification ID is required');

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error(`[deleteNotification] Error deleting ${notificationId}:`, error.message);
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
}
