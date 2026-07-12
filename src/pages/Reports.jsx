import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, AlertTriangle } from 'lucide-react'

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#8b90a7']

// Risk Index = weighted formula:
// 40% utilization (allocated/total), 30% maintenance rate, 20% overdue rate, 10% lost rate
function calcRiskIndex(stats) {
  const total = stats.total || 1
  const util = (stats.allocated / total) * 40
  const maint = (stats.maintenance / total) * 30
  const overdue = (stats.overdue / total) * 20
  const lost = (stats.lost / total) * 10
  return Math.min(100, Math.round(util + maint + overdue + lost))
}

function riskColor(score) {
  if (score < 30) return '#22c55e'
  if (score < 60) return '#f59e0b'
  return '#ef4444'
}

export default function Reports() {
  const [statusDist, setStatusDist] = useState([])
  const [categoryDist, setCategoryDist] = useState([])
  const [monthlyActivity, setMonthlyActivity] = useState([])
  const [deptRisk, setDeptRisk] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    const [
      { data: assets },
      { data: byCategory },
      { data: actLogs },
      { data: departments },
    ] = await Promise.all([
      supabase.from('assets').select('status, department_id, departments(name)'),
      supabase.from('assets').select('asset_categories(name), status'),
      supabase.from('activity_log').select('timestamp, action').order('timestamp', { ascending: true }),
      supabase.from('departments').select('id, name'),
    ])

    // status distribution
    const statusMap = {}
    assets?.forEach(a => { statusMap[a.status] = (statusMap[a.status] || 0) + 1 })
    setStatusDist(Object.entries(statusMap).map(([name, value]) => ({ name, value })))

    // category distribution
    const catMap = {}
    byCategory?.forEach(a => {
      const cat = a.asset_categories?.name || 'Uncategorized'
      catMap[cat] = (catMap[cat] || 0) + 1
    })
    setCategoryDist(Object.entries(catMap).map(([name, value]) => ({ name, value })))

    // monthly activity (last 6 months)
    const months = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleString('default', { month: 'short' })
      months[key] = 0
    }
    actLogs?.forEach(log => {
      const d = new Date(log.timestamp)
      const key = d.toLocaleString('default', { month: 'short' })
      if (key in months) months[key]++
    })
    setMonthlyActivity(Object.entries(months).map(([month, actions]) => ({ month, actions })))

    // dept risk index
    const deptAssets = {}
    assets?.forEach(a => {
      const dname = a.departments?.name || 'Unassigned'
      if (!deptAssets[dname]) deptAssets[dname] = { total: 0, allocated: 0, maintenance: 0, overdue: 0, lost: 0 }
      deptAssets[dname].total++
      if (a.status === 'allocated') deptAssets[dname].allocated++
      if (a.status === 'under_maintenance') deptAssets[dname].maintenance++
      if (a.status === 'lost') deptAssets[dname].lost++
    })
    setDeptRisk(Object.entries(deptAssets).map(([dept, stats]) => ({
      dept,
      ...stats,
      risk: calcRiskIndex(stats)
    })).sort((a, b) => b.risk - a.risk))

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {payload.map(p => <div key={p.name} style={{ color: p.color || 'var(--text-primary)' }}>{p.name}: {p.value}</div>)}
      </div>
    )
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 40 }}>Loading reports...</div>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Reports & Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Operational insights and department risk scoring</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Monthly activity */}
        <div className="surface" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Activity  Last 6 Months</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyActivity}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8b90a7' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8b90a7' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="actions" stroke="#f59e0b" fill="url(#actGrad)" strokeWidth={2} name="actions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="surface" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Asset Status Distribution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={statusDist} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {statusDist.map((s, i) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.name.replace('_', ' ')}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, marginLeft: 'auto' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="surface" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Assets by Category</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categoryDist} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8b90a7' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#8b90a7' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="assets" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Risk Index */}
        <div className="surface" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Department Risk Index</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
            Score = 40% utilization + 30% maintenance rate + 20% overdue rate + 10% lost rate
          </div>
          {deptRisk.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No department data</div>}
          {deptRisk.map(d => (
            <div key={d.dept} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-primary)' }}>{d.dept}</span>
                <span style={{ fontWeight: 700, color: riskColor(d.risk) }}>{d.risk}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.risk}%`, background: riskColor(d.risk), borderRadius: 3, transition: 'width 600ms ease' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                {d.total} total · {d.allocated} allocated · {d.maintenance} in repair · {d.lost} lost
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Risk index: allocated*0.4 + maintenance*0.3 + overdue*0.2 + lost*0.1
