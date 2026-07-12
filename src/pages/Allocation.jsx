import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { allocateAsset, returnAsset, createTransferRequest, approveTransfer } from '../services/allocationService'
import { ArrowLeftRight, RotateCcw, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

const TABS = ['Active Allocations', 'Overdue', 'Transfer Requests', 'History']

export default function Allocation() {
  const { profile } = useAuthStore()
  const isManager = ['admin', 'asset_manager', 'department_head'].includes(profile?.role)
  const [tab, setTab] = useState('Active Allocations')
  const [allocations, setAllocations] = useState([])
  const [transfers, setTransfers] = useState([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [assets, setAssets] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAllocate, setShowAllocate] = useState(false)
  const [form, setForm] = useState({ asset_id: '', to_user_id: '', expected_return_date: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  // conflict holds { message, holder: { id, name, email } } when ALREADY_ALLOCATED
  const [conflict, setConflict] = useState(null)
  const [transferSent, setTransferSent] = useState(false)
  const [transferSending, setTransferSending] = useState(false)
  const [profileMap, setProfileMap] = useState({}) // id → { name, email }

  async function loadAllocations() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (tab === 'Overdue') {
      // First auto-mark any active allocations past their return date as 'overdue' in DB
      await supabase
        .from('allocations')
        .update({ status: 'overdue' })
        .eq('status', 'active')
        .lt('expected_return_date', today)
        .not('expected_return_date', 'is', null)

      // Then fetch all overdue records (both just-marked and pre-existing)
      const { data } = await supabase
        .from('allocations')
        .select('id, asset_id, to_user_id, from_user_id, status, expected_return_date, created_at, returned_at, assets(id, tag, name)')
        .eq('status', 'overdue')
        .order('expected_return_date', { ascending: true })
      setAllocations(data || [])
    } else {
      const statusFilter = tab === 'History' ? ['returned'] : ['active']
      const { data } = await supabase
        .from('allocations')
        .select('id, asset_id, to_user_id, from_user_id, status, expected_return_date, created_at, returned_at, assets(id, tag, name)')
        .in('status', statusFilter)
        .order('created_at', { ascending: false })
      setAllocations(data || [])
    }
    setLoading(false)
  }

  async function loadTransfers() {
    const { data } = await supabase
      .from('transfer_requests')
      .select('id, asset_id, from_user_id, to_user_id, notes, status, created_at, assets(tag, name)')
      .eq('status', 'requested')
      .order('created_at', { ascending: false })
    setTransfers(data || [])
  }

  async function loadFormData() {
    const [{ data: a }, { data: u }] = await Promise.all([
      supabase.from('assets').select('id, tag, name').eq('status', 'available').order('name'),
      supabase.from('profiles').select('id, name, email').order('name')
    ])
    setAssets(a || [])
    setUsers((u || []).filter(p => p.name))
    // Build a quick id→profile lookup map
    const map = {}
    ;(u || []).forEach(p => { map[p.id] = p })
    setProfileMap(map)
  }

  // Count overdue records for badge on initial load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('allocations').select('id', { count: 'exact', head: true })
      .eq('status', 'active').lt('expected_return_date', today).not('expected_return_date', 'is', null)
      .then(({ count }) => setOverdueCount(count || 0))
  }, [])

  useEffect(() => {
    loadFormData()
  }, [])

  useEffect(() => {
    if (tab === 'Transfer Requests') loadTransfers()
    else loadAllocations()
  }, [tab])

  // Reset conflict/success whenever asset or user selection changes
  function handleFormChange(field, value) {
    setForm(p => ({ ...p, [field]: value }))
    setConflict(null)
    setTransferSent(false)
    setError(null)
  }

  async function handleAllocate(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setConflict(null)
    setTransferSent(false)
    try {
      await allocateAsset(form.asset_id, form.to_user_id, form.expected_return_date || null, profile.id)
      setShowAllocate(false)
      setForm({ asset_id: '', to_user_id: '', expected_return_date: '' })
      loadAllocations()
      loadFormData()
    } catch (err) {
      if (err.code === 'ALREADY_ALLOCATED') {
        setConflict(err) // { message, holder: { id, name, email } }
      } else {
        setError(err.message || 'Allocation failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRequestTransfer() {
    if (!conflict?.holder?.id || !form.asset_id || !form.to_user_id) return
    setTransferSending(true)
    try {
      // 1. Create transfer request
      await createTransferRequest(
        form.asset_id,
        conflict.holder.id,
        form.to_user_id,
        'Transfer requested from allocation screen'
      )

      // 2. Resolve asset tag + requester name for the notification message
      const selectedAsset = assets.find(a => a.id === form.asset_id)
      const requester = users.find(u => u.id === form.to_user_id)
      const assetTag = selectedAsset?.tag || form.asset_id
      const holderName = conflict.holder?.name || 'current holder'
      const requesterName = requester?.name || profile?.name || 'requester'

      // 3. Find an asset manager / admin to notify (use the first one found)
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['asset_manager', 'admin'])
        .limit(1)

      if (managers?.length) {
        await supabase.from('notifications').insert({
          user_id: managers[0].id,
          type: 'transfer_request',
          message: `Transfer requested for ${assetTag} from ${holderName} to ${requesterName}`,
          related_entity_id: form.asset_id,
          related_entity_type: 'asset'
        })
      }

      // 4. Show success, then auto-close the form
      setTransferSent(true)
      setConflict(null)
      setTimeout(() => {
        setShowAllocate(false)
        setForm({ asset_id: '', to_user_id: '', expected_return_date: '' })
        setTransferSent(false)
      }, 2800)
    } catch (err) {
      setError(err.message || 'Failed to send transfer request')
      setConflict(null)
    } finally {
      setTransferSending(false)
    }
  }

  async function handleReturn(allocationId) {
    const notes = prompt('Condition notes on return (optional):') || '-'
    await returnAsset(allocationId, notes, profile.id)
    loadAllocations()
  }

  async function handleApproveTransfer(transferId) {
    await approveTransfer(transferId, profile.id)
    loadTransfers()
  }

  function daysOverdue(date) {
    const diff = Date.now() - new Date(date).getTime()
    return Math.floor(diff / 86400000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Allocation &amp; Transfer</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Track who holds what and manage transfers</p>
        </div>
        {isManager && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowAllocate(!showAllocate)
              setConflict(null)
              setTransferSent(false)
              setError(null)
            }}
          >
            <ArrowLeftRight size={13} /> Allocate Asset
          </button>
        )}
      </div>

      {showAllocate && (
        <div className="surface" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Allocate Asset to User</div>
          <form onSubmit={handleAllocate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Asset (available only)</label>
                <select value={form.asset_id} onChange={e => handleFormChange('asset_id', e.target.value)} required>
                  <option value="">Choose asset</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.tag}  {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Assign to</label>
                <select value={form.to_user_id} onChange={e => handleFormChange('to_user_id', e.target.value)} required>
                  <option value="">Choose user</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Expected return (optional)</label>
                <input type="date" value={form.expected_return_date} onChange={e => handleFormChange('expected_return_date', e.target.value)} />
              </div>
            </div>

            {/* Generic error */}
            {error && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#f87171' }}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />{error}
              </div>
            )}

            {/* ALREADY_ALLOCATED conflict banner */}
            {conflict && !transferSent && (
              <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                  <AlertTriangle size={14} /> Currently held by {conflict.holder?.name}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 12px' }}>This asset is not available for direct allocation.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                  onClick={handleRequestTransfer}
                  disabled={transferSending}
                >
                  {transferSending ? 'Sending…' : '↗ Request Transfer'}
                </button>
              </div>
            )}

            {/* Transfer request success state */}
            {transferSent && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, fontSize: 13, color: '#4ade80', fontWeight: 500 }}>
                <CheckCircle size={15} />
                Transfer request sent. The asset manager has been notified.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowAllocate(false)
                  setConflict(null)
                  setTransferSent(false)
                  setError(null)
                }}
              >
                Cancel
              </button>
              {!conflict && !transferSent && (
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#0f1117' : 'var(--text-muted)', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {t}
            {t === 'Overdue' && overdueCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', lineHeight: 1.4 }}>
                {overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Transfer Requests' ? (
        <div className="surface" style={{ overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                {isManager && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No pending transfers</td></tr>
              )}
              {transfers.map(t => (
                <tr key={t.id}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{t.assets?.tag}</span>  {t.assets?.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{profileMap[t.from_user_id]?.name || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{profileMap[t.to_user_id]?.name || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.notes || '-'}</td>
                  {isManager && (
                    <td>
                      <button className="btn btn-success" style={{ fontSize: 11 }} onClick={() => handleApproveTransfer(t.id)}>Approve</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="surface" style={{ overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Holder</th>
                <th>Allocated by</th>
                <th>Status</th>
                <th>Return by</th>
                {tab === 'Active Allocations' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && allocations.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No records</td></tr>
              )}
              {allocations.map(a => {
                const overdue = a.status === 'overdue' || (a.expected_return_date && new Date(a.expected_return_date) < new Date())
                return (
                  <tr key={a.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{a.assets?.tag}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.assets?.name}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{profileMap[a.to_user_id]?.name || a.to_user_id?.slice(0,8) || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profileMap[a.from_user_id]?.name || '-'}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {a.expected_return_date ? (
                        <span style={{ fontSize: 12, color: overdue ? '#f87171' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {overdue && <Clock size={11} />} {a.expected_return_date} {overdue && `(${daysOverdue(a.expected_return_date)}d late)`}
                        </span>
                      ) : ''}
                    </td>
                    {tab === 'Active Allocations' && (
                      <td>
                        <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => handleReturn(a.id)}>
                          <RotateCcw size={11} /> Return
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
