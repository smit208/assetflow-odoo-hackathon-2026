import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import useAuthStore from '../stores/authStore'
import useNotificationStore from '../stores/notificationStore'
import { supabase } from '../lib/supabase'
import { Clock, Mail, LogOut } from 'lucide-react'

export default function Layout() {
  const { user, profile, signOut } = useAuthStore()
  const { fetch, addNotification } = useNotificationStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) return
    fetch(user.id)

    const channel = supabase
      .channel('notifications-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        addNotification(payload.new)
        window.dispatchEvent(new CustomEvent('new-notification'))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id])

  // Pending approval screen  shown until admin activates the account
  if (profile && profile.status === 'pending') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72,
            background: 'rgba(245,158,11,0.1)',
            border: '2px solid rgba(245,158,11,0.3)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Clock size={32} style={{ color: '#f59e0b' }} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
            Account Pending Approval
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            Your account has been created successfully. A system administrator
            needs to approve your access and assign you to a department before
            you can use AssetFlow.
          </p>

          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
            textAlign: 'left'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Your account details
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Mail size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{profile.email}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>Pending approval</span>
            </div>
          </div>

          <div style={{
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10,
            padding: '14px 18px',
            fontSize: 13,
            color: '#60a5fa',
            marginBottom: 28,
            lineHeight: 1.6
          }}>
            💡 Contact your Asset Manager or System Admin to get your account approved.
            They can do this from <strong>Organization Setup → Employees</strong>.
          </div>

          <button
            onClick={signOut}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              padding: '10px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13
            }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <Outlet />
      </main>
    </div>
  )
}
