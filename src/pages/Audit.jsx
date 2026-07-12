import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { submitAuditItem, closeCycle } from '../services/auditService'
import { Plus, ClipboardList, Lock, AlertTriangle } from 'lucide-react'

export default function Audit() {
  const { profile } = useAuthStore()
  const isManager = ['admin', 'asset_manager'].includes(profile?.role)
  const [cycles, setCycles] = useState([])
  const [departments, setDepartments] = useState([])
  const [assets, setAssets] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [activeCycle, setActiveCycle] = useState(null)
  const [auditItems, setAuditItems] = useState([])
  const [form, setForm] = useState({ name: '', scope_department_id: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)
  const [closeResult, setCloseResult] = useState(null)

  async function loadCycles() {
    const { data } = await supabase.from('audit_cycles').select('*, departments(name)').order('created_at', { ascending: false })
    setCycles(data || [])
  }

  async function loadAuditItems(cycleId) {
    const { data } = await supabase.from('audit_items').select('*, assets(id, tag, name, status)').eq('audit_cycle_id', cycleId)
    setAuditItems(data || [])
  }

  async function loadAssets(deptId) {
    let q = supabase.from('assets').select('id, tag, name, status, departments(name)')
    if (deptId) q = q.eq('department_id', deptId)
    const { data } = await q.order('name')
    setAssets(data || [])
  }

  useEffect(() => {
    loadCycles()
    supabase.from('departments').select('id, name').order('name').then(({ data }) => setDepartments(data || []))
  }, [])

  async function createCycle(e) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase.from('audit_cycles').insert({ ...form, created_by: profile.id, status: 'open', scope_department_id: form.scope_department_id || null }).select().single()
    setSaving(false)
    setShowForm(false)
    setForm({ name: '', scope_department_id: '', start_date: '', end_date: '' })
    loadCycles()
  }

  async function openCycle(cycle) {
    setActiveCycle(cycle)
    await loadAssets(cycle.scope_department_id)
    await loadAuditItems(cycle.id)
  }

  async function markItem(assetId, verification) {
    const notes = verification !== 'verified' ? (prompt(`Notes for ${verification} item:`) || '-') : ''
    await submitAuditItem(activeCycle.id, assetId, verification, notes, profile.id)
    loadAuditItems(activeCycle.id)
  }

  async function handleCloseCycle() {
    if (!confirm(`Close audit cycle "${activeCycle.name}"? This will lock the cycle and mark missing assets as Lost.`)) return
    const result = await closeCycle(activeCycle.id, profile.id)
    setCloseResult(result)
    setActiveCycle(null)
    loadCycles()
  }

  const verificationOf = (assetId) => auditItems.find(i => i.asset_id === assetId)?.verification
  const verColor = { verified: '#4ade80', missing: '#f87171', damaged: '#fb923c' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Asset Audit</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Run structured verification cycles</p>
        </div>
        {isManager && !activeCycle && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={13} /> New Cycle</button>}
        {activeCycle && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setActiveCycle(null)}>← Back to cycles</button>
            {isManager && activeCycle.status !== 'closed' && <button className="btn btn-danger" onClick={handleCloseCycle}><Lock size={13} /> Close Cycle</button>}
          </div>
        )}
      </div>

      {closeResult && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
          <div style={{ fontWeight: 600, color: '#f87171', fontSize: 13, marginBottom: 8 }}><AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />Cycle closed  Discrepancy Report</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{closeResult.missingAssets.length} assets marked Lost · {closeResult.damagedAssets.length} assets flagged as Damaged</div>
          {closeResult.missingAssets.map(a => <div key={a.asset_id} style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>✗ {a.assets?.tag}  {a.assets?.name} → marked Lost</div>)}
          <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 11 }} onClick={() => setCloseResult(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="surface" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Create Audit Cycle</div>
          <form onSubmit={createCycle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Cycle Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Q3 2026 Audit" required /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Scope Department</label>
                <select value={form.scope_department_id} onChange={e => setForm(p => ({ ...p, scope_department_id: e.target.value }))}>
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>End Date</label><input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}><ClipboardList size={13} /> {saving ? 'Creating...' : 'Create Cycle'}</button>
            </div>
          </form>
        </div>
      )}

      {!activeCycle ? (
        <div className="surface" style={{ overflow: 'hidden' }}>
          <table>
            <thead><tr><th>Cycle Name</th><th>Scope</th><th>Status</th><th>Start</th><th>End</th><th></th></tr></thead>
            <tbody>
              {cycles.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No audit cycles yet</td></tr>}
              {cycles.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.departments?.name || 'All departments'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.start_date || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.end_date || '-'}</td>
                  <td>{c.status !== 'closed' && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => openCycle(c)}>Open Checklist →</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="surface" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeCycle.name}  {assets.length} assets in scope
            <span style={{ float: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
              Verified: {auditItems.filter(i => i.verification === 'verified').length} · Missing: {auditItems.filter(i => i.verification === 'missing').length} · Damaged: {auditItems.filter(i => i.verification === 'damaged').length}
            </span>
          </div>
          <table>
            <thead><tr><th>Tag</th><th>Name</th><th>Status</th><th>Verification</th><th>Action</th></tr></thead>
            <tbody>
              {assets.map(a => {
                const v = verificationOf(a.id)
                return (
                  <tr key={a.id}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{a.tag}</span></td>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {v ? <span style={{ fontSize: 11, fontWeight: 600, color: verColor[v], textTransform: 'capitalize' }}>● {v}</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not checked</span>}
                    </td>
                    <td>
                      {activeCycle.status !== 'closed' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['verified', 'missing', 'damaged'].map(opt => (
                            <button key={opt} onClick={() => markItem(a.id, opt)}
                              style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: `1px solid ${verColor[opt]}`, background: v === opt ? verColor[opt] + '22' : 'transparent', color: verColor[opt], cursor: 'pointer', fontWeight: 500 }}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
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
