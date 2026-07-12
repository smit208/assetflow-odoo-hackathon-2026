import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { Plus, Search, Filter, QrCode, ChevronDown, ChevronUp, X, Check } from 'lucide-react'
import QRCode from 'qrcode'

const STATUSES = ['available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed']
const CONDITIONS = ['new', 'good', 'fair', 'poor']

async function generateSequentialTag(supabase) {
  // Fetch the highest existing AF-XXXX number
  const { data } = await supabase
    .from('assets')
    .select('tag')
    .like('tag', 'AF-%')
    .order('tag', { ascending: false })
    .limit(1)

  let next = 1
  if (data?.length) {
    const parts = data[0].tag.split('-')
    const num = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(num)) next = num + 1
  }
  return `AF-${String(next).padStart(4, '0')}`  // AF-0001, AF-0002 ...
}

export default function AssetDirectory() {
  const { profile } = useAuthStore()
  const isManager = ['admin', 'asset_manager'].includes(profile?.role)
  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState({ name: '', category_id: '', department_id: '', serial_number: '', purchase_date: '', purchase_cost: '', condition: 'good', location: '', description: '', is_bookable: false, photo_url: '' })
  const [qrPreview, setQrPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  // Edit asset state
  const [editAsset, setEditAsset] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('assets').select('id, tag, name, status, category_id, department_id, current_holder_id, location, serial_number, purchase_cost, purchase_date, condition, description, qr_code_url, is_bookable, asset_categories(name), departments(name)').order('created_at', { ascending: false })
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterCat) q = q.eq('category_id', filterCat)
    if (search) q = q.or(`name.ilike.%${search}%,tag.ilike.%${search}%,serial_number.ilike.%${search}%`)
    const { data } = await q
    setAssets(data || [])
    setLoading(false)
  }

  useEffect(() => {
    Promise.all([
      supabase.from('asset_categories').select('id, name, custom_field_name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('profiles').select('id, name').order('name')
    ]).then(([{ data: cats }, { data: depts }, { data: profs }]) => {
      setCategories(cats || [])
      setDepartments(depts || [])
      const map = {}
      ;(profs || []).forEach(p => { map[p.id] = p })
      setProfileMap(map)
    })
  }, [])

  useEffect(() => { load() }, [search, filterStatus, filterCat])

  // Pre-fill editForm when editAsset changes
  useEffect(() => {
    if (editAsset) setEditForm({
      name: editAsset.name || '',
      status: editAsset.status || 'available',
      condition: editAsset.condition || 'good',
      location: editAsset.location || '',
      purchase_cost: editAsset.purchase_cost || '',
      purchase_date: editAsset.purchase_date || '',
      serial_number: editAsset.serial_number || '',
      description: editAsset.description || '',
      is_bookable: editAsset.is_bookable || false
    })
  }, [editAsset])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!profile?.id) { setSaving(false); return }
    setSaving(true)
    const tag = await generateSequentialTag(supabase)

    const { data: asset, error } = await supabase.from('assets').insert({
      ...form,
      tag,
      status: 'available',
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      category_id: form.category_id || null,
      department_id: form.department_id || null,
    }).select().single()

    if (!error && asset) {
      const qr = await QRCode.toDataURL(`assetflow:asset:${asset.id}:${asset.tag}`, { width: 200, margin: 1, color: { dark: '#f0f2f8', light: '#1a1d27' } })
      await supabase.from('assets').update({ qr_code_url: qr }).eq('id', asset.id)
      setQrPreview({ tag, qr, name: form.name })
    }

    setForm({ name: '', category_id: '', department_id: '', serial_number: '', purchase_date: '', purchase_cost: '', condition: 'good', location: '', description: '', is_bookable: false, photo_url: '', custom_field_value: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditSaving(true)
    const { error } = await supabase.from('assets').update({
      name: editForm.name,
      status: editForm.status,
      condition: editForm.condition,
      location: editForm.location,
      purchase_cost: editForm.purchase_cost ? parseFloat(editForm.purchase_cost) : null,
      purchase_date: editForm.purchase_date || null,
      serial_number: editForm.serial_number || null,
      description: editForm.description || null,
      is_bookable: editForm.is_bookable,
      updated_at: new Date().toISOString()
    }).eq('id', editAsset.id)
    setEditSaving(false)
    if (!error) { setEditAsset(null); load() }
  }

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })) }
  function updateEditForm(k, v) { setEditForm(p => ({ ...p, [k]: v })) }

  const permanentlyInactive = ['lost', 'retired'].includes(editForm.status)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Asset Directory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{assets.length} assets tracked</p>
        </div>
        {isManager && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={13} /> Register Asset</button>}
      </div>

      {/* QR Success popup */}
      {qrPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="surface" style={{ padding: 32, textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{qrPreview.name}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 16 }}>{qrPreview.tag}</div>
            <img src={qrPreview.qr} alt="QR" style={{ width: 160, height: 160, borderRadius: 8 }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, marginBottom: 16 }}>Asset registered. Print or screenshot this QR code.</p>
            <button className="btn btn-primary" onClick={() => setQrPreview(null)} style={{ width: '100%', justifyContent: 'center' }}>Done</button>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editAsset && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) setEditAsset(null) }}
        >
          <div className="surface" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Asset</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', marginTop: 2 }}>{editAsset.tag}</div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={() => setEditAsset(null)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Asset Name */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Asset Name *</label>
                  <input
                    value={editForm.name}
                    onChange={e => updateEditForm('name', e.target.value)}
                    placeholder="e.g. Dell Latitude 7420"
                    required
                  />
                </div>

                {/* Status */}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Status</label>
                  <select value={editForm.status} onChange={e => updateEditForm('status', e.target.value)}>
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  {permanentlyInactive && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '5px 9px', lineHeight: 1.5 }}>
                      ⚠ This will mark the asset as permanently inactive.
                    </div>
                  )}
                </div>

                {/* Condition */}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Condition</label>
                  <select value={editForm.condition} onChange={e => updateEditForm('condition', e.target.value)}>
                    {CONDITIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Location</label>
                  <input
                    value={editForm.location}
                    onChange={e => updateEditForm('location', e.target.value)}
                    placeholder="Room / Floor"
                  />
                </div>

                {/* Purchase Cost */}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Purchase Cost (₹)</label>
                  <input
                    type="number"
                    value={editForm.purchase_cost}
                    onChange={e => updateEditForm('purchase_cost', e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Purchase Date */}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Purchase Date</label>
                  <input
                    type="date"
                    value={editForm.purchase_date}
                    onChange={e => updateEditForm('purchase_date', e.target.value)}
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Serial Number</label>
                  <input
                    value={editForm.serial_number}
                    onChange={e => updateEditForm('serial_number', e.target.value)}
                    placeholder="SN-XXXXXXX"
                  />
                </div>

                {/* Description */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => updateEditForm('description', e.target.value)}
                    rows={3}
                    placeholder="Optional notes"
                  />
                </div>

                {/* Is Bookable */}
                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="edit-bookable"
                    checked={editForm.is_bookable}
                    onChange={e => updateEditForm('is_bookable', e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="edit-bookable" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Allow booking (shared/bookable resource) — appears in Resource Booking calendar
                  </label>
                </div>

              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditAsset(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  <Check size={13} /> {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register form */}
      {showForm && (
        <div className="surface" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 18 }}>Register New Asset</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Asset Name *</label><input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="e.g. Dell Latitude 7420" required /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Category</label>
                <select value={form.category_id} onChange={e => updateForm('category_id', e.target.value)}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Department</label>
                <select value={form.department_id} onChange={e => updateForm('department_id', e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Serial Number</label><input value={form.serial_number} onChange={e => updateForm('serial_number', e.target.value)} placeholder="SN-XXXXXXX" /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Purchase Date</label><input type="date" value={form.purchase_date} onChange={e => updateForm('purchase_date', e.target.value)} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Purchase Cost (₹)</label><input type="number" value={form.purchase_cost} onChange={e => updateForm('purchase_cost', e.target.value)} placeholder="0" /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Condition</label>
                <select value={form.condition} onChange={e => updateForm('condition', e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Location</label><input value={form.location} onChange={e => updateForm('location', e.target.value)} placeholder="Room / Floor" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Photo URL</label><input value={form.photo_url} onChange={e => updateForm('photo_url', e.target.value)} placeholder="https://..." /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Description</label><textarea value={form.description} onChange={e => updateForm('description', e.target.value)} rows={2} placeholder="Optional notes" /></div>
              {/* Category-specific dynamic field */}
              {form.category_id && categories.find(c => c.id === form.category_id)?.custom_field_name && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, color: 'var(--accent)', display: 'block', marginBottom: 5 }}>
                    {categories.find(c => c.id === form.category_id).custom_field_name}
                  </label>
                  <input
                    value={form.custom_field_value || '-'}
                    onChange={e => updateForm('custom_field_value', e.target.value)}
                    placeholder={`Enter ${categories.find(c => c.id === form.category_id).custom_field_name}`}
                  />
                </div>
              )}
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="bookable" checked={form.is_bookable} onChange={e => updateForm('is_bookable', e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="bookable" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>Allow booking (shared/bookable resource)  appears in Resource Booking calendar</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}><QrCode size={13} /> {saving ? 'Saving...' : 'Register & Generate QR'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, tag or serial..." style={{ paddingLeft: 32 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="surface" style={{ overflow: 'hidden' }}>
        <table>
          <thead><tr><th>Tag</th><th>Name</th><th>Category</th><th>Status</th><th>Holder</th><th>Location</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading...</td></tr>}
            {!loading && assets.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No assets found</td></tr>}
            {assets.map(a => (
              <React.Fragment key={a.id}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{a.tag}</span></td>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.asset_categories?.name || '-'}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{profileMap[a.current_holder_id]?.name || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.location || '-'}</td>
                  <td>{expandedId === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                </tr>
                {expandedId === a.id && (
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--bg-elevated)', padding: '14px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12 }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Serial</span><br /><span>{a.serial_number || '-'}</span></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Purchase Cost</span><br /><span>{a.purchase_cost ? `₹${a.purchase_cost.toLocaleString()}` : ''}</span></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Purchase Date</span><br /><span>{a.purchase_date || '-'}</span></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Condition</span><br /><span style={{ textTransform: 'capitalize' }}>{a.condition || '-'}</span></div>
                        {a.description && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-muted)' }}>Notes</span><br /><span>{a.description}</span></div>}
                        {a.qr_code_url && <div><span style={{ color: 'var(--text-muted)' }}>QR Code</span><br /><img src={a.qr_code_url} alt="QR" style={{ width: 80, height: 80, marginTop: 4, borderRadius: 4 }} /></div>}
                        {isManager && (
                          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={e => { e.stopPropagation(); setEditAsset(a) }}>
                              Edit Asset
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
