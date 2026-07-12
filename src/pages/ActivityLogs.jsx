import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { verifyChain } from '../services/activityService'
import useAuthStore from '../stores/authStore'
import { Shield, ShieldAlert, Activity } from 'lucide-react'

const ACTION_LABELS = {
  ALLOCATE: 'Allocated asset',
  RETURN: 'Returned asset',
  TRANSFER_REQUEST: 'Transfer requested',
  TRANSFER_APPROVE: 'Transfer approved',
  RAISE_MAINTENANCE: 'Maintenance raised',
  MAINTENANCE_APPROVED: 'Maintenance approved',
  MAINTENANCE_RESOLVED: 'Maintenance resolved',
  BOOK_RESOURCE: 'Resource booked',
  CANCEL_BOOKING: 'Booking cancelled',
  AUDIT_CYCLE_CLOSED: 'Audit cycle closed',
  ASSET_MARKED_LOST: 'Asset marked Lost',
}

export default function ActivityLogs() {
  const { profile } = useAuthStore()
  const isManager = ['admin', 'asset_manager'].includes(profile?.role)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [chainStatus, setChainStatus] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  async function load() {
    setLoading(true)
    let q = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterAction) q = q.eq('action', filterAction)
    const { data: rawLogs } = await q

    // Resolve actor names via separate query (avoids ambiguous FK join)
    const actorIds = [...new Set((rawLogs || []).map(l => l.actor_id).filter(Boolean))]
    let pMap = {}
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('id', actorIds)
      ;(profs || []).forEach(p => { pMap[p.id] = p })
    }

    setLogs((rawLogs || []).map(l => ({ ...l, profiles: pMap[l.actor_id] || null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [page, filterAction])

  async function handleVerify() {
    setVerifying(true)
    const result = await verifyChain()
    setChainStatus(result)
    setVerifying(false)
  }

  function timeStr(ts) {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const actionColor = {
    ALLOCATE: '#3b82f6', RETURN: '#22c55e', TRANSFER_REQUEST: '#f59e0b', TRANSFER_APPROVE: '#22c55e',
    RAISE_MAINTENANCE: '#f97316', MAINTENANCE_APPROVED: '#3b82f6', MAINTENANCE_RESOLVED: '#22c55e',
    BOOK_RESOURCE: '#a855f7', CANCEL_BOOKING: '#ef4444', AUDIT_CYCLE_CLOSED: '#8b90a7', ASSET_MARKED_LOST: '#ef4444',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Activity Logs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Full tamper-evident audit trail  every action recorded</p>
        </div>
        {isManager && (
          <button className="btn btn-ghost" onClick={handleVerify} disabled={verifying}>
            <Shield size={13} /> {verifying ? 'Verifying...' : 'Verify Chain Integrity'}
          </button>
        )}
      </div>

      {chainStatus && (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 10, border: `1px solid ${chainStatus.intact ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, background: chainStatus.intact ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: chainStatus.intact ? '#4ade80' : '#f87171' }}>
            {chainStatus.intact ? <Shield size={14} /> : <ShieldAlert size={14} />}
            {chainStatus.intact ? 'Hash chain intact  no tampering detected' : `Chain broken at log entry ${chainStatus.brokenAt}`}
          </div>
          {chainStatus.intact && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Every log entry SHA-256 matches its previous hash. The audit trail is trustworthy.</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }} style={{ width: 220 }}>
          <option value="">All actions</option>
          {Object.keys(ACTION_LABELS).map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
        </select>
      </div>

      <div className="surface" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>}
        {!loading && logs.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No activity recorded yet</div>}
        {logs.map((log, i) => (
          <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px', borderBottom: i < logs.length - 1 ? '1px solid rgba(46,51,71,0.4)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
              {log.profiles?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                <span style={{ fontWeight: 600 }}>{log.profiles?.name || 'System'}</span>
                <span style={{ color: 'var(--text-muted)' }}>  </span>
                <span style={{ color: actionColor[log.action] || 'var(--text-muted)', fontWeight: 500 }}>{ACTION_LABELS[log.action] || log.action}</span>
                {log.details?.tag && <span style={{ color: 'var(--accent)', fontSize: 12 }}> · {log.details.tag}</span>}
              </div>
              {log.details && Object.keys(log.details).length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {Object.entries(log.details).filter(([k]) => k !== 'tag').map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeStr(log.timestamp)}</span>
              {isManager && log.row_hash && (
                <span style={{ fontSize: 9, color: 'rgba(139,144,167,0.5)', fontFamily: 'monospace', marginTop: 2 }}>{log.row_hash.slice(0, 12)}…</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ fontSize: 12 }}>← Previous</button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page + 1}</span>
        <button className="btn btn-ghost" onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE} style={{ fontSize: 12 }}>Next →</button>
      </div>
    </div>
  )
}
