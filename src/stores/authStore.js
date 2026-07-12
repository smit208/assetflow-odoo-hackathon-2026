import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await get().fetchProfile(session.user)
    }
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await get().fetchProfile(session.user)
      } else {
        set({ user: null, profile: null })
      }
    })
  },

  fetchProfile: async (authUser) => {
    // Support both calling with a full user object or just a userId string
    let userId, userMeta
    if (typeof authUser === 'string') {
      userId = authUser
      const { data: { user } } = await supabase.auth.getUser()
      userMeta = user?.user_metadata || {}
    } else {
      userId = authUser.id
      userMeta = authUser.user_metadata || {}
    }

    const { data: dbProfile } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .eq('id', userId)
      .single()

    // user_metadata.role always wins  set by QuickLoginButton via updateUser (no RLS issues)
    const role   = userMeta.role   || dbProfile?.role   || 'employee'
    const status = userMeta.status || dbProfile?.status || 'pending'
    const name   = userMeta.name   || dbProfile?.name   || '-'

    const profile = dbProfile
      ? { ...dbProfile, role, status, name }
      : { id: userId, role, status, name, email: authUser?.email || '-' }

    set({ user: { id: userId }, profile })
  },

  signOut: async () => {
    // Clear metadata on sign out
    await supabase.auth.updateUser({ data: { role: null, status: null } }).catch(() => {})
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  // role helpers
  isAdmin:        () => get().profile?.role === 'admin',
  isAssetManager: () => ['admin', 'asset_manager'].includes(get().profile?.role),
  isDeptHead:     () => ['admin', 'asset_manager', 'department_head'].includes(get().profile?.role),
}))

export default useAuthStore

// Role escalation only via admin in OrgSetup
