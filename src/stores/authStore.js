import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await get().fetchProfile(session.user.id)
    }
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        set({ user: session.user })
        await get().fetchProfile(session.user.id)
      } else {
        set({ user: null, profile: null })
      }
    })
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .eq('id', userId)
      .single()
    set({ user: { id: userId }, profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  // role helpers
  isAdmin:        () => get().profile?.role === 'admin',
  isAssetManager: () => ['admin', 'asset_manager'].includes(get().profile?.role),
  isDeptHead:     () => ['admin', 'asset_manager', 'department_head'].includes(get().profile?.role),
}))

export default useAuthStore
