import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { createMaintenanceRequest, updateMaintenanceStatus } from '../services/maintenanceService'
import { Wrench, Plus, ChevronRight } from 'lucide-react'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const COLUMNS = [
  { key: 'pending',             label: 'Pending',       color: '#f97316' },
  { key: 'approved',            label: 'Approved',      color: '#3b82f6' },
  { key: 'technician_assigned', label: 'Tech Assigned', color: '#a855f7' },
  { key: 'in_progress',         label: 'In Progress',   color: '#f59e0b' },
  { key: 'resolved',            label: 'Resolved',      color: '#22c55e' },
  { key: 'rejected',            label: 'Rejected',      color: '#ef4444' },
]

const PRIORITY_NEXT = {
  pending:             ['approved', 'rejected'],
  approved:            ['technician_assigned', 'rejected'],
  technician_assigned: ['in_progress'],
  in_progress:         ['resolved'],
}

export default function Maintenance() {
  const { profile } = useAuthStore()
  const isManager = ['admin', 'asset_manager'].includes(profile?.role)
  const [requests, setRequests] = useState([])
  const [assets, setAssets] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ asset_id: '', issue: '', priority: 'medium', technician_name: '', photo_url: '' })
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('maintenance_requests')
      .select('*, assets(id, tag, name), profiles!raised_by(name)')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  useEffect(() => {
    load()
    supabase.from('assets').select('id, tag, name').order('name').then(({ data }) => setAssets(data || []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await createMaintenanceRequest(form.asset_id, profile.id, form.issue, form.priority, form.photo_url || null, form.technician_name || null)
    setForm({ asset_id: '', issue: '', priority: 'medium', technician_name: '', photo_url: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function moveStatus(requestId, newStatus) {
    await updateMaintenanceStatus(requestId, newStatus, profile.id)
    load()
  }

  const byStatus = (status) => requests.filter(r => r.status === status)

  const priorityColor = { low: '#4ade80', medium: '#fb923c', high: '#f87171', critical: '#ef4444' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Maintenance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Track repair requests from submission to resolution</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={13} /> Raise Request</button>
      </div>

      {showForm && (
        <div className="surface" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>New Maintenance Request</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Asset *</label>
                <select value={form.asset_id} onChange={e => setForm(p => ({ ...p, asset_id: e.target.value }))} required>
                  <option value="">Select asset</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Issue Description *</label>
                <textarea value={form.issue} onChange={e => setForm(p => ({ ...p, issue: e.target.value }))} rows={3} placeholder="Describe the problem clearly..." required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Preferred Technician</label>
                <input value={form.technician_name} onChange={e => setForm(p => ({ ...p, technician_name: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Photo URL</label>
                <input value={form.photo_url} onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, overflowX: 'auto' }}>
        {COLUMNS.map(col => {
          const cards = byStatus(col.key)
          return (
            <div key={col.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${col.color}` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 99 }}>{cards.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cards.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>—</div>}
                {cards.map(r => (
                  <div key={r.id} className="card-hover" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, cursor: 'pointer' }} onClick={() => setSelected(r)}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', marginBottom: 4 }}>{r.assets?.tag}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>{r.issue?.slice(0, 60)}{r.issue?.length > 60 ? '...' : ''}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: priorityColor[r.priority] || 'var(--text-muted)', textTransform: 'uppercase' }}>{r.priority}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.profiles?.name}</span>
                    </div>
                    {isManager && PRIORITY_NEXT[r.status] && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                        {PRIORITY_NEXT[r.status].map(next => (
                          <button key={next} onClick={e => { e.stopPropagation(); moveStatus(r.id, next) }}
                            style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <ChevronRight size={9} /> {next.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setSelected(null)}>
          <div className="surface" style={{ padding: 28, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.assets?.tag} — {selected.assets?.name}</span>
              <StatusBadge status={selected.status} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <div><b style={{ color: 'var(--text-primary)' }}>Issue:</b> {selected.issue}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Priority:</b> <span style={{ color: priorityColor[selected.priority] }}>{selected.priority}</span></div>
              <div><b style={{ color: 'var(--text-primary)' }}>Raised by:</b> {selected.profiles?.name}</div>
              {selected.technician_name && <div><b style={{ color: 'var(--text-primary)' }}>Technician:</b> {selected.technician_name}</div>}
              {selected.condition_notes && <div><b style={{ color: 'var(--text-primary)' }}>Notes:</b> {selected.condition_notes}</div>}
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 20, width: '100%', justifyContent: 'center' }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
