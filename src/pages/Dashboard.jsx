import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import {
  Package, Users, Wrench, CalendarDays, ArrowLeftRight,
  Clock, AlertTriangle, Plus, CheckCircle2,
  Building2, UserCircle, Box, Shuffle, Sparkles, ChevronRight
} from 'lucide-react'

/* ─── count-up hook ─────────────────────────────────────────────────────── */
function useCountUp(target, duration = 600) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === 0) { setVal(0); return }
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(timer) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return val
}

/* ─── KPI card ──────────────────────────────────────────────────────────── */
function KPICard({ label, value, icon: Icon, color, subtext, onClick }) {
  const displayed = useCountUp(value)
  return (
    <div className="surface card-hover" onClick={onClick}
      style={{ padding: '20px 22px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="countup" style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{displayed}</div>
      {subtext && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{subtext}</div>}
    </div>
  )
}

/* ─── Onboarding Wizard ─────────────────────────────────────────────────── */
function OnboardingWizard({ onboardingData, navigate }) {
  const { deptCount, profileCount, assetCount } = onboardingData

  const steps = [
    {
      id: 1,
      label: 'Set up your departments',
      description: 'Create the organisational structure for your company',
      done: deptCount > 0,
      locked: false,
      icon: Building2,
      path: '/org-setup',
      cta: 'Go to Org Setup',
    },
    {
      id: 2,
      label: 'Add employee profiles',
      description: 'Import or create profiles so assets can be assigned',
      done: profileCount > 1,
      locked: false,
      icon: UserCircle,
      path: '/org-setup',
      cta: 'Go to Org Setup',
    },
    {
      id: 3,
      label: 'Register your first asset',
      description: 'Add hardware, devices or any trackable item',
      done: assetCount > 0,
      locked: false,
      icon: Box,
      path: '/assets',
      cta: 'Go to Asset Directory',
    },
    {
      id: 4,
      label: 'Make your first allocation',
      description: 'Assign an asset to an employee to start tracking',
      done: false,
      locked: assetCount === 0,
      icon: Shuffle,
      path: '/allocation',
      cta: 'Go to Allocations',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const pct = Math.round((completedCount / steps.length) * 100)

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)',
      border: '1px solid rgba(245,158,11,0.22)',
      borderRadius: 16,
      padding: '32px 36px',
      marginBottom: 28,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: 'linear-gradient(135deg,#f59e0b,#d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
        }}>
          <Sparkles size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            Welcome to AssetFlow
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Complete these steps to get started
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>complete</div>
        </div>
      </div>

      <div style={{
        height: 6, borderRadius: 99,
        background: 'rgba(245,158,11,0.15)',
        marginBottom: 28, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
          transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 0 8px rgba(245,158,11,0.5)',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step) => {
          const Icon = step.icon
          const isLocked = step.locked
          const isDone   = step.done

          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              borderRadius: 12,
              border: `1px solid ${isDone ? 'rgba(245,158,11,0.25)' : isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`,
              background: isDone
                ? 'rgba(245,158,11,0.07)'
                : isLocked
                  ? 'rgba(255,255,255,0.015)'
                  : 'rgba(255,255,255,0.03)',
              opacity: isLocked ? 0.5 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{ flexShrink: 0 }}>
                {isDone ? (
                  <CheckCircle2 size={22} style={{ color: '#f59e0b' }} />
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `2px solid ${isLocked ? 'rgba(255,255,255,0.12)' : 'rgba(245,158,11,0.4)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: isLocked ? 'var(--text-muted)' : '#f59e0b',
                  }}>
                    {step.id}
                  </div>
                )}
              </div>

              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: isDone ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={16} style={{ color: isDone ? '#f59e0b' : isLocked ? 'var(--text-muted)' : 'var(--text-secondary)' }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isDone ? '#f59e0b' : isLocked ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: isDone ? 'line-through' : 'none',
                  opacity: isDone ? 0.75 : 1,
                }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {step.description}
                </div>
              </div>

              {!isDone && !isLocked && (
                <button
                  onClick={() => navigate(step.path)}
                  style={{
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(245,158,11,0.4)',
                    background: 'rgba(245,158,11,0.1)',
                    color: '#f59e0b',
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(245,158,11,0.2)'
                    e.currentTarget.style.borderColor = 'rgba(245,158,11,0.7)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(245,158,11,0.1)'
                    e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'
                  }}
                >
                  {step.cta}
                  <ChevronRight size={13} />
                </button>
              )}

              {isDone && (
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, flexShrink: 0, opacity: 0.8 }}>
                  Done ✓
                </span>
              )}

              {isLocked && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  Complete step 3 first
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()

  const [kpis, setKpis] = useState({
    available: 0, allocated: 0, maintenance: 0,
    bookings: 0, transfers: 0, returns: 0,
  })
  const [onboardingData, setOnboardingData] = useState({
    deptCount: 0, profileCount: 0, assetCount: 0,
  })
  const [activity, setActivity]       = useState([])
  const [overdueList, setOverdueList] = useState([])
  const [loading, setLoading]         = useState(true)
  const [companyCode, setCompanyCode] = useState(null)
  const [codeCopied, setCodeCopied]   = useState(false)

  async function loadData() {
    const [
      { count: available },
      { count: allocated },
      { count: maintenance },
      { count: bookings },
      { count: transfers },
      { count: returns },
      { data: overdueAllocations },
      { data: recentActivity },
      { count: deptCount },
      { count: profileCount },
      { count: assetCount },
    ] = await Promise.all([
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'allocated'),
      supabase.from('maintenance_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'in_progress']),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'upcoming'),
      supabase.from('transfer_requests').select('*', { count: 'exact', head: true }).eq('status', 'requested'),
      supabase.from('allocations').select('*', { count: 'exact', head: true })
        .eq('status', 'active').lt('expected_return_date', new Date().toISOString().split('T')[0]).not('expected_return_date', 'is', null),
      supabase.from('allocations').select('*, assets(tag,name), profiles!to_user_id(name)')
        .eq('status', 'overdue').order('expected_return_date', { ascending: true }).limit(5),
      supabase.from('activity_log').select('*, profiles(name)').order('timestamp', { ascending: false }).limit(12),
      supabase.from('departments').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('assets').select('*', { count: 'exact', head: true }),
    ])

    setKpis({
      available:   available   || 0,
      allocated:   allocated   || 0,
      maintenance: maintenance || 0,
      bookings:    bookings    || 0,
      transfers:   transfers   || 0,
      returns:     returns     || 0,
    })
    setOnboardingData({
      deptCount:    deptCount    || 0,
      profileCount: profileCount || 0,
      assetCount:   assetCount   || 0,
    })
    setOverdueList(overdueAllocations || [])
    setActivity(recentActivity || [])

    // fetch company join code (admin only)
    if (profile?.role === 'admin') {
      const { data: cs } = await supabase.from('company_settings').select('join_code, company_name').eq('id', 1).single()
      setCompanyCode(cs || null)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, loadData)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const kpiCards = [
    { label: 'Assets Available',   value: kpis.available,   icon: Package,        color: '#22c55e', subtext: 'Ready to allocate',      path: '/assets?status=available' },
    { label: 'Assets Allocated',   value: kpis.allocated,   icon: Users,          color: '#3b82f6', subtext: 'Currently in use',       path: '/allocation' },
    { label: 'Maintenance Active', value: kpis.maintenance, icon: Wrench,         color: '#f97316', subtext: 'Approved or in progress', path: '/maintenance' },
    { label: 'Active Bookings',    value: kpis.bookings,    icon: CalendarDays,   color: '#a855f7', subtext: 'Upcoming slots',          path: '/bookings' },
    { label: 'Pending Transfers',  value: kpis.transfers,   icon: ArrowLeftRight, color: '#f59e0b', subtext: 'Awaiting approval',       path: '/allocation' },
    { label: 'Overdue Returns',    value: kpis.returns,     icon: Clock,          color: '#ef4444', subtext: 'Past return date',        path: '/allocation' },
  ]

  function formatAction(log) {
    const map = {
      ALLOCATE:             'allocated an asset',
      RETURN:               'returned an asset',
      TRANSFER_REQUEST:     'requested a transfer',
      TRANSFER_APPROVE:     'approved a transfer',
      RAISE_MAINTENANCE:    'raised a maintenance request',
      MAINTENANCE_APPROVED: 'approved maintenance',
      MAINTENANCE_RESOLVED: 'resolved maintenance',
      BOOK_RESOURCE:        'booked a resource',
      CANCEL_BOOKING:       'cancelled a booking',
      AUDIT_CYCLE_CLOSED:   'closed an audit cycle',
      ASSET_MARKED_LOST:    'asset marked as lost',
    }
    return map[log.action] || log.action.toLowerCase().replace(/_/g, ' ')
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const showWizard = !loading && onboardingData.assetCount === 0

  return (
    <div>
      {/* Company Join Code  admin only */}
      {profile?.role === 'admin' && companyCode && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(251,191,36,0.04) 100%)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 14,
          padding: '18px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap'
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={20} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Company Join Code</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.25em', color: '#f59e0b', fontFamily: 'monospace' }}>
                {companyCode.join_code}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(companyCode.join_code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000) }}
                style={{ padding: '4px 12px', background: codeCopied ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${codeCopied ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: codeCopied ? '#22c55e' : '#f59e0b', transition: 'all 200ms' }}>
                {codeCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.6 }}>
            Share this code with employees so they can register. They'll need it on the signup screen.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {profile?.name?.split(' ')[0] || 'there'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/assets')}><Plus size={14} /> Register Asset</button>
          <button className="btn btn-ghost" onClick={() => navigate('/bookings')}><CalendarDays size={14} /> Book Resource</button>
          <button className="btn btn-primary" onClick={() => navigate('/maintenance')}><Wrench size={14} /> Raise Request</button>
        </div>
      </div>

      {showWizard ? (
        <OnboardingWizard onboardingData={onboardingData} navigate={navigate} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
          {kpiCards.map(card => (
            <KPICard key={card.label} {...card} onClick={() => navigate(card.path)} />
          ))}
        </div>
      )}

      {!showWizard && overdueList.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#f87171', fontSize: 13, fontWeight: 600 }}>
            <AlertTriangle size={15} />
            {overdueList.length} overdue return{overdueList.length > 1 ? 's' : ''}  past expected date
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdueList.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{a.assets?.tag}  {a.assets?.name}</span>
                <span>held by {a.profiles?.name} · due {a.expected_return_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="surface" style={{ padding: '20px 22px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Recent Activity</h2>
        {activity.length === 0 && (
          <div className="empty-state">
            <Package size={32} />
            <p>No activity yet. Start by registering an asset.</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {activity.map((log, i) => (
            <div key={log.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: i < activity.length - 1 ? '1px solid rgba(46,51,71,0.4)' : 'none',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {log.profiles?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{log.profiles?.name || 'System'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> {formatAction(log)}</span>
                  {log.details?.tag && <span style={{ fontSize: 13, color: 'var(--accent)' }}> · {log.details.tag}</span>}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{timeAgo(log.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
