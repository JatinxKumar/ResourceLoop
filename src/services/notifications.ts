import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types/domain'

/**
 * Fetch notifications for current authenticated user.
 */
export async function fetchUserNotifications(): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[fetchUserNotifications] Error:', error.message)
    return []
  }

  return (data as Notification[]) || []
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('[markNotificationAsRead] Error:', error.message)
    throw new Error(error.message)
  }
}

/**
 * Mark all notifications for current user as read.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('[markAllNotificationsAsRead] Error:', error.message)
    throw new Error(error.message)
  }
}
