import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard, Building2, Package, ArrowLeftRight,
  CalendarDays, Wrench, ClipboardList, BarChart3,
  Bell, Activity, LogOut, ChevronLeft, ChevronRight, CheckCheck, X
} from 'lucide-react'
import useAuthStore from '../stores/authStore'
import useNotificationStore from '../stores/notificationStore'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',            icon: LayoutDashboard, roles: ['admin','asset_manager','department_head','employee'] },
  { to: '/org-setup',   label: 'Organization',         icon: Building2,       roles: ['admin'] },
  { to: '/assets',      label: 'Assets',               icon: Package,         roles: ['admin','asset_manager','department_head','employee'] },
  { to: '/allocation',  label: 'Allocation & Transfer', icon: ArrowLeftRight, roles: ['admin','asset_manager','department_head','employee'] },
  { to: '/bookings',    label: 'Resource Booking',     icon: CalendarDays,    roles: ['admin','asset_manager','department_head','employee'] },
  { to: '/maintenance', label: 'Maintenance',          icon: Wrench,          roles: ['admin','asset_manager','department_head','employee'] },
  { to: '/audit',       label: 'Audit',                icon: ClipboardList,   roles: ['admin','asset_manager'] },
  { to: '/reports',     label: 'Reports',              icon: BarChart3,       roles: ['admin','asset_manager','department_head'] },
  { to: '/logs',        label: 'Activity Logs',        icon: Activity,        roles: ['admin','asset_manager'] },
]

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function NotificationPanel({ onClose }) {
  const { user } = useAuthStore()
  const { notifications, unreadCount, markRead, markAllRead, fetch } = useNotificationStore()
  const panelRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={panelRef} style={{
      position: 'fixed',
      bottom: 80,
      left: 228,
      width: 320,
      maxHeight: 420,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--accent)', color: '#0f1117',
              fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 10,
            }}>{unreadCount}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead(user?.id)}
              title="Mark all as read"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', border: '1px solid var(--border)',
                background: 'transparent', borderRadius: 6,
                color: 'var(--accent)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <CheckCheck size={11} /> Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No notifications yet
          </div>
        )}
        {notifications.map(n => {
          const isUnread = !n.read && !n.is_read
          return (
            <div
              key={n.id}
              onClick={() => { if (isUnread) markRead(n.id) }}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(46,51,71,0.5)',
                background: isUnread ? 'rgba(245,158,11,0.04)' : 'transparent',
                cursor: isUnread ? 'pointer' : 'default',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => { if (isUnread) e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = isUnread ? 'rgba(245,158,11,0.04)' : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {isUnread && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: isUnread ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const { profile, signOut } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()

  const role = profile?.role || 'employee'
  const visible = navItems.filter(n => n.roles.includes(role))

  const roleBadgeColor = {
    admin: '#ef4444',
    asset_manager: '#f59e0b',
    department_head: '#3b82f6',
    employee: '#22c55e'
  }[role] || '#8b90a7'

  return (
    <aside style={{
      width: collapsed ? 60 : 220,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 200ms ease',
      flexShrink: 0,
      overflow: 'hidden',
      zIndex: 100,
    }}>
      {/* Logo / collapse toggle */}
      <div style={{
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '14px 0' : '16px 14px',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={{ width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:700, fontSize:13, color:'#0f1117' }}>AF</div>
            <span style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', whiteSpace:'nowrap' }}>AssetFlow</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
            transition: 'all 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* nav */}
      <nav style={{ flex:1, padding:'10px 0', overflowY:'auto' }}>
        {visible.map(item => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding: collapsed ? '10px 0' : '10px 16px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              background: isActive ? 'rgba(245,158,11,0.07)' : 'transparent',
              textDecoration:'none',
              fontSize:13,
              fontWeight: isActive ? 600 : 400,
              transition:'all 120ms',
              whiteSpace:'nowrap',
              overflow:'hidden'
            })}>
              <Icon size={16} style={{ flexShrink:0 }} />
              {!collapsed && item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Notification bell button */}
      <div style={{ padding: collapsed ? '8px 0' : '0 10px 8px' }}>
        <button
          onClick={() => setShowNotifs(v => !v)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: collapsed ? '8px 0' : '8px 12px',
            background: showNotifs ? 'rgba(245,158,11,0.1)' : 'transparent',
            border: '1px solid',
            borderColor: unreadCount > 0 ? 'rgba(245,158,11,0.3)' : 'transparent',
            borderRadius: 8,
            cursor: 'pointer',
            color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
            position: 'relative',
            transition: 'all 150ms',
          }}
        >
          <Bell size={14} style={{ flexShrink: 0 }} />
          {!collapsed && (unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''}` : 'Notifications')}
          {unreadCount > 0 && collapsed && (
            <span style={{
              position: 'absolute', top: 4, right: 8,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)',
            }} />
          )}
        </button>
      </div>

      {showNotifs && !collapsed && (
        <NotificationPanel onClose={() => setShowNotifs(false)} />
      )}

      {/* user info */}
      <div style={{ padding: collapsed ? '12px 0' : '12px 14px', borderTop:'1px solid var(--border)' }}>
        {!collapsed && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'var(--text-primary)', flexShrink:0 }}>
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.name || 'User'}</div>
              <div style={{ fontSize:10, fontWeight:500, color: roleBadgeColor, textTransform:'capitalize' }}>{role.replace('_',' ')}</div>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          style={{ display:'flex', alignItems:'center', gap:6, padding: collapsed ? '8px 0' : '7px 10px', width:'100%', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:12, justifyContent: collapsed ? 'center' : 'flex-start', borderRadius:6, transition:'all 120ms' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <LogOut size={14} />
          {!collapsed && 'Sign out'}
        </button>
      </div>


    </aside>
  )
}

// Active route highlighted on nav

// Final nav polish before submission
