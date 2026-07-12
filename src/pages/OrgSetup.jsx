import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import { Plus, Building2, Tag, Users, Pencil, Trash2, Check, X, ChevronRight } from 'lucide-react'

const TABS = ['Departments', 'Categories', 'Employees']

export default function OrgSetup() {
  const [tab, setTab] = useState('Departments')
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Organization Setup</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Manage departments, asset categories and team members</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 18px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#0f1117' : 'var(--text-muted)',
            transition: 'all 150ms'
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Departments' && <DepartmentsTab isAdmin={isAdmin} />}
      {tab === 'Categories' && <CategoriesTab isAdmin={isAdmin} />}
      {tab === 'Employees' && <EmployeesTab isAdmin={isAdmin} />}
    </div>
  )
}

/* ─────────────────────────────────────────────
   DEPARTMENTS TAB
───────────────────────────────────────────── */
const EMPTY_DEPT = { name: '', location: '', head_user_id: '', parent_department_id: '', is_active: true }

function DepartmentsTab({ isAdmin }) {
  const [departments, setDepartments] = useState([])
  const [profiles, setProfiles] = useState([])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_DEPT)

  async function load() {
    const [{ data: depts, error: deptsErr }, { data: profs }] = await Promise.all([
      supabase.from('departments').select('id, name, location, head_user_id, parent_department_id, is_active, status').order('name'),
      supabase.from('profiles').select('id, name, role, department_id').order('name')
    ])

    if (deptsErr) {
      // Fallback: minimal columns only (no optional columns)
      const { data: basicDepts } = await supabase.from('departments').select('id, name, location').order('name')
      setDepartments(basicDepts || [])
    } else {
      setDepartments(depts || [])
    }
    setProfiles(profs || [])
  }
  useEffect(() => { load() }, [])

  function startAdd() {
    setForm(EMPTY_DEPT)
    setEditId(null)
    setAdding(true)
  }

  function startEdit(d) {
    setForm({
      name: d.name || '-',
      location: d.location || '-',
      head_user_id: d.head_user_id || '-',
      parent_department_id: d.parent_department_id || '-',
      is_active: d.is_active !== false
    })
    setEditId(d.id)
    setAdding(false)
  }

  function cancelForm() {
    setAdding(false)
    setEditId(null)
    setForm(EMPTY_DEPT)
  }

  async function save() {
    if (!form.name.trim()) return

    // Base payload  columns that ALWAYS exist in departments table
    const base = {
      name: form.name.trim(),
      location: form.location.trim() || null,
    }

    // Extended payload  columns added by migration (may or may not exist)
    const extended = {
      ...base,
      head_user_id: form.head_user_id || null,
      parent_department_id: form.parent_department_id || null,
    }

    try {
      if (editId) {
        const { error } = await supabase.from('departments').update(extended).eq('id', editId)
        if (error) await supabase.from('departments').update(base).eq('id', editId)
      } else {
        const { error } = await supabase.from('departments').insert(extended)
        if (error) await supabase.from('departments').insert(base)
      }
    } catch {
      // Last resort  just name + location
      if (editId) await supabase.from('departments').update(base).eq('id', editId)
      else await supabase.from('departments').insert(base)
    }
    cancelForm()
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this department?')) return
    await supabase.from('departments').delete().eq('id', id)
    load()
  }

  async function toggleStatus(d) {
    await supabase.from('departments').update({ is_active: !d.is_active }).eq('id', d.id)
    load()
  }

  // Parent dept dropdown excludes the dept being edited
  const parentOptions = departments.filter(d => d.id !== editId)
  // Map id → name for display
  const deptById = Object.fromEntries(departments.map(d => [d.id, d.name]))
  const profById = Object.fromEntries(profiles.map(p => [p.id, p.name]))

  const showForm = adding || !!editId

  return (
    <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
          <Building2 size={15} style={{ color: 'var(--accent)' }} /> Departments
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={startAdd}>
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Department Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Engineering"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Location</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. HQ – Floor 2"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Department Head</label>
              <select
                value={form.head_user_id}
                onChange={e => setForm(f => ({ ...f, head_user_id: e.target.value }))}
              >
                <option value=""> None </option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role?.replace('_', ' ')})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Parent Department</label>
              <select
                value={form.parent_department_id}
                onChange={e => setForm(f => ({ ...f, parent_department_id: e.target.value }))}
              >
                <option value=""> None (top-level) </option>
                {parentOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status toggle + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
              <div
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                style={{
                  width: 36, height: 20, borderRadius: 10,
                  background: form.is_active ? 'var(--accent)' : 'var(--border)',
                  position: 'relative', cursor: 'pointer', transition: 'background 200ms', flexShrink: 0
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: form.is_active ? 18 : 3,
                  width: 14, height: 14, borderRadius: '50%',
                  background: form.is_active ? '#0f1117' : 'var(--text-muted)',
                  transition: 'left 200ms'
                }} />
              </div>
              {form.is_active ? 'Active' : 'Inactive'}
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-success" onClick={save}><Check size={13} /> {editId ? 'Update' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={cancelForm}><X size={13} /> Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Head</th>
            <th>Parent</th>
            <th>Status</th>
            <th>Members</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {departments.length === 0 && (
            <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No departments yet</td></tr>
          )}
          {departments.map(d => (
            <tr key={d.id}>
              <td style={{ fontWeight: 500 }}>{d.name}</td>
              <td style={{ color: 'var(--text-muted)' }}>{d.location || '-'}</td>
              <td style={{ color: 'var(--text-muted)' }}>
                {d.head_user_id ? (profById[d.head_user_id] || '-') : ''}
              </td>
              <td style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {d.parent_department_id ? (
                  <><ChevronRight size={11} style={{ opacity: 0.4 }} />{deptById[d.parent_department_id] || '-'}</>
                ) : ''}
              </td>
              <td>
                {isAdmin ? (
                  <button
                    onClick={() => toggleStatus(d)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', border: 'none', borderRadius: 20, cursor: 'pointer',
                      background: d.is_active !== false ? 'rgba(74,222,128,0.15)' : 'rgba(139,144,167,0.15)',
                      color: d.is_active !== false ? '#4ade80' : '#8b90a7'
                    }}
                  >
                    {d.is_active !== false ? 'Active' : 'Inactive'}
                  </button>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, color: d.is_active !== false ? '#4ade80' : '#8b90a7' }}>
                    ● {d.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                )}
              </td>
              <td style={{ color: 'var(--text-muted)' }}>
                {profiles.filter(p => p.department_id === d.id).length || 0}
              </td>
              {isAdmin && (
                <td style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '5px 8px' }}
                    onClick={() => startEdit(d)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '5px 8px' }}
                    onClick={() => remove(d.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────────────────────────────────────────
   CATEGORIES TAB
───────────────────────────────────────────── */
const EMPTY_CAT = { name: '', custom_field_name: '', custom_field_value: '' }

function CategoriesTab({ isAdmin }) {
  const [categories, setCategories] = useState([])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_CAT)

  async function load() {
    const { data } = await supabase.from('asset_categories').select('*').order('name')
    setCategories(data || [])
  }
  useEffect(() => { load() }, [])

  function startAdd() {
    setForm(EMPTY_CAT)
    setEditId(null)
    setAdding(true)
  }

  function startEdit(c) {
    setForm({
      name: c.name || '-',
      custom_field_name: c.custom_field_name || '-',
      custom_field_value: c.custom_field_value || '-'
    })
    setEditId(c.id)
    setAdding(false)
  }

  function cancelForm() {
    setAdding(false)
    setEditId(null)
    setForm(EMPTY_CAT)
  }

  async function save() {
    if (!form.name.trim()) return
    const extended = {
      name: form.name.trim(),
      custom_field_name: form.custom_field_name.trim() || null,
      custom_field_value: form.custom_field_value.trim() || null
    }
    const base = { name: form.name.trim() }
    try {
      if (editId) {
        const { error } = await supabase.from('asset_categories').update(extended).eq('id', editId)
        if (error) await supabase.from('asset_categories').update(base).eq('id', editId)
      } else {
        const { error } = await supabase.from('asset_categories').insert(extended)
        if (error) await supabase.from('asset_categories').insert(base)
      }
    } catch {
      if (editId) await supabase.from('asset_categories').update(base).eq('id', editId)
      else await supabase.from('asset_categories').insert(base)
    }
    cancelForm()
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this category?')) return
    await supabase.from('asset_categories').delete().eq('id', id)
    load()
  }

  const showForm = adding || !!editId

  return (
    <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
          <Tag size={15} style={{ color: 'var(--accent)' }} /> Asset Categories
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={startAdd}><Plus size={13} /> Add</button>}
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Category Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Electronics"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Custom Field Label</label>
              <input
                value={form.custom_field_name}
                onChange={e => setForm(f => ({ ...f, custom_field_name: e.target.value }))}
                placeholder="e.g. Warranty Period"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Custom Field Value</label>
              <input
                value={form.custom_field_value}
                onChange={e => setForm(f => ({ ...f, custom_field_value: e.target.value }))}
                placeholder="e.g. 2 years"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-success" onClick={save}><Check size={13} /> {editId ? 'Update' : 'Save'}</button>
            <button className="btn btn-ghost" onClick={cancelForm}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Custom Field Label</th>
            <th>Custom Field Value</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 && (
            <tr><td colSpan={isAdmin ? 4 : 3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No categories yet</td></tr>
          )}
          {categories.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td style={{ color: 'var(--text-muted)' }}>{c.custom_field_name || '-'}</td>
              <td style={{ color: 'var(--text-muted)' }}>{c.custom_field_value || '-'}</td>
              {isAdmin && (
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => startEdit(c)}><Pencil size={12} /></button>
                  <button className="btn btn-danger" style={{ padding: '5px 8px' }} onClick={() => remove(c.id)}><Trash2 size={12} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────────────────────────────────────────
   EMPLOYEES TAB  (unchanged logic, same UI)
───────────────────────────────────────────── */
function EmployeesTab({ isAdmin }) {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const ROLES = ['employee', 'department_head', 'asset_manager', 'admin']
  const roleColor = { admin: '#ef4444', asset_manager: '#f59e0b', department_head: '#3b82f6', employee: '#22c55e' }

  async function load() {
    const [{ data: emps }, { data: depts }] = await Promise.all([
      supabase.from('profiles').select('*, departments(name)').order('name'),
      supabase.from('departments').select('id, name').order('name')
    ])
    setEmployees(emps || [])
    setDepartments(depts || [])
  }
  useEffect(() => { load() }, [])

  async function updateRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  async function updateDept(id, department_id) {
    await supabase.from('profiles').update({ department_id: department_id || null }).eq('id', id)
    load()
  }

  return (
    <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
          <Users size={15} style={{ color: 'var(--accent)' }} /> Team Members ({employees.length})
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Department</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(e => (
            <tr key={e.id}>
              <td style={{ fontWeight: 500 }}>{e.name}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.email}</td>
              <td>
                {isAdmin ? (
                  <select value={e.department_id || '-'} onChange={ev => updateDept(e.id, ev.target.value)} style={{ padding: '4px 8px', fontSize: 12 }}>
                    <option value="">No dept</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (e.departments?.name || '-')}
              </td>
              <td>
                {isAdmin ? (
                  <select value={e.role} onChange={ev => updateRole(e.id, ev.target.value)} style={{ padding: '4px 8px', fontSize: 12, color: roleColor[e.role], background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6 }}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 500, color: roleColor[e.role], textTransform: 'capitalize' }}>{e.role?.replace('_', ' ')}</span>
                )}
              </td>
              <td><span style={{ fontSize: 11, color: e.status === 'active' ? '#4ade80' : '#8b90a7' }}>● {e.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
