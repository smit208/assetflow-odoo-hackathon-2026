import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetch: async (userId) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const unread = data?.filter(n => !n.is_read).length || 0
    set({ notifications: data || [], unreadCount: unread })
  },

  markRead: async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }))
  },

  markAllRead: async (userId) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, is_read: true })),
      unreadCount: 0
    }))
  },

  addNotification: (notif) => {
    set(state => ({
      notifications: [notif, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }))
  }
}))

export default useNotificationStore
