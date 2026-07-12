import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Building2, UserPlus, Zap, User, ShieldCheck } from 'lucide-react'

// Generate a random 6-char alphanumeric join code
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const DEMO_PASSWORD = 'assetflow2026'

// Auto-setup + one-click login for demo/evaluators
function QuickLoginButton({ label, email, role, onLogin }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const Icon = role === 'admin' ? ShieldCheck : User
  const isAdmin = role === 'admin'

  async function handleClick() {
    setStatus('loading')
    try {
      const name         = isAdmin ? 'Arjun Mehta' : 'Riya Sharma'
      const targetRole   = isAdmin ? 'admin' : 'employee'
      const targetStatus = 'active'

      // 1. Sign in (or create account if first time)
      let { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD })

      if (loginErr) {
        // Account doesn't exist  create it
        const { data: signupData, error: signupErr } = await supabase.auth.signUp({
          email,
          password: DEMO_PASSWORD,
          options: { data: { name, role: targetRole, status: targetStatus } }
        })
        if (signupErr || !signupData?.user) throw new Error(signupErr?.message || 'Signup failed')
        // Sign in immediately after signup
        const { data: loginData2, error: loginErr2 } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
        if (loginErr2) throw new Error(loginErr2.message)
        loginData = loginData2
      }

      // 2. Write role into auth user_metadata  NO RLS, always works, survives page reload
      await supabase.auth.updateUser({
        data: { role: targetRole, status: targetStatus, name }
      })

      // 3. Seed demo data if admin and DB is empty
      if (isAdmin) {
        const { data: assetCheck } = await supabase.from('assets').select('id').limit(1)
        if (!assetCheck?.length) {
          const { seedDemoData } = await import('../scripts/seed')
          await seedDemoData()
        }
      }

      setStatus('done')
      // Hard reload  authStore.init() re-runs, reads fresh session + metadata → correct role
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Quick login error:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const bg = isAdmin
    ? 'rgba(245,158,11,0.08)'
    : 'rgba(59,130,246,0.08)'
  const border = isAdmin
    ? 'rgba(245,158,11,0.3)'
    : 'rgba(59,130,246,0.3)'
  const color = isAdmin ? '#f59e0b' : '#60a5fa'

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading' || status === 'done'}
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 12px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        cursor: status === 'idle' ? 'pointer' : 'default',
        transition: 'all 200ms',
        opacity: status === 'loading' ? 0.7 : 1
      }}
      onMouseEnter={e => { if (status === 'idle') e.currentTarget.style.background = isAdmin ? 'rgba(245,158,11,0.14)' : 'rgba(59,130,246,0.14)' }}
      onMouseLeave={e => { e.currentTarget.style.background = bg }}
    >
      <Icon size={20} style={{ color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color }}>
        {status === 'loading' ? 'Setting up...' : status === 'done' ? 'Redirecting...' : status === 'error' ? 'Failed  retry' : label}
      </span>
      {status === 'idle' && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {isAdmin ? 'Full admin access' : 'Employee view'}
        </span>
      )}
      {status === 'loading' && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>First run may take a moment</span>
      )}
    </button>
  )
}

export default function Login() {
  // mode: 'login' | 'create_company' | 'join_company'
  const [mode, setMode]               = useState('login')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [name, setName]               = useState('')
  const [companyName, setCompanyName] = useState('')
  const [joinCode, setJoinCode]       = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [seeding, setSeeding]         = useState(false)
  const navigate = useNavigate()

  function switchMode(m) { setMode(m); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // ── LOGIN ──────────────────────────────────────────────
    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (err) { setError(err.message); return }
      navigate('/dashboard')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    // ── CREATE COMPANY (Admin registers new company) ───────
    if (mode === 'create_company') {
      if (!companyName.trim()) {
        setError('Enter your company name')
        setLoading(false)
        return
      }

      // Create the auth account
      const { data, error: signupErr } = await supabase.auth.signUp({
        email, password, options: { data: { name } }
      })

      if (signupErr) { setError(signupErr.message); setLoading(false); return }
      if (!data?.user) { setError('Signup failed. Please try again.'); setLoading(false); return }

      // Upsert company settings  overwrites if already exists
      const code = generateCode()
      await supabase.from('company_settings').upsert({
        id: 1,
        join_code: code,
        company_name: companyName.trim()
      }, { onConflict: 'id' })

      // Make this user admin + active
      await supabase.from('profiles').update({
        role: 'admin',
        status: 'active',
        name
      }).eq('id', data.user.id)

      setLoading(false)
      setMode('login')
      setPassword('')
      alert(`🎉 Company "${companyName}" created!\n\nYour join code is: ${code}\n\nShare this code with employees so they can register.\nSign in now to see it on your Dashboard.`)
      return
    }

    // ── JOIN COMPANY (Employee joins existing company) ─────
    if (mode === 'join_company') {
      if (!joinCode.trim()) {
        setError('Enter the company join code from your admin.')
        setLoading(false)
        return
      }

      // Validate join code
      const { data: settings, error: codeErr } = await supabase
        .from('company_settings')
        .select('join_code, company_name')
        .eq('id', 1)
        .single()

      if (codeErr || !settings) {
        setError('No company has been set up yet. Ask your admin to register the company first.')
        setLoading(false)
        return
      }

      if (joinCode.trim().toUpperCase() !== settings.join_code.toUpperCase()) {
        setError('Invalid company code. Ask your admin for the correct code.')
        setLoading(false)
        return
      }

      // Code valid  create account as pending employee
      const { data, error: signupErr } = await supabase.auth.signUp({
        email, password, options: { data: { name } }
      })

      if (signupErr) { setError(signupErr.message); setLoading(false); return }
      if (!data?.user) { setError('Signup failed. Please try again.'); setLoading(false); return }

      await supabase.from('profiles').update({ name }).eq('id', data.user.id)

      setLoading(false)
      setMode('login')
      setPassword('')
      setJoinCode('')
      alert(`Welcome to ${settings.company_name}!\n\nYour account is pending approval. An admin will activate your account from Org Setup → Employees.`)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const { seedDemoData } = await import('../scripts/seed')
      await seedDemoData()
      alert('✅ Demo data loaded!\n\nRefresh the page  all screens now have live data.')
    } catch (err) {
      alert('Seed error: ' + err.message)
    } finally {
      setSeeding(false)
    }
  }

  const isSignup = mode !== 'login'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#0f1117', marginBottom: 14 }}>AF</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>AssetFlow</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Enterprise Asset Management</p>
        </div>

        <div className="surface" style={{ padding: 28 }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, gap: 3 }}>
            {[
              { key: 'login',          label: 'Sign In' },
              { key: 'create_company', label: 'New Company' },
              { key: 'join_company',   label: 'Join Company' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => switchMode(key)}
                style={{
                  flex: 1, padding: '7px 4px', border: 'none', borderRadius: 6,
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: mode === key ? 'var(--bg-surface)' : 'transparent',
                  color: mode === key ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 150ms', whiteSpace: 'nowrap'
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Description banners */}
          {mode === 'create_company' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <Building2 size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#f59e0b' }}>
                <strong>Admin setup.</strong> Register your company  you'll become the system admin and receive a unique join code for employees.
              </div>
            </div>
          )}
          {mode === 'join_company' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <UserPlus size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#60a5fa' }}>
                <strong>Employee signup.</strong> Enter the join code your admin shared with you. Your account will be reviewed before access is granted.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Company name  only on create_company */}
            {mode === 'create_company' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Company Name</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" required />
              </div>
            )}

            {/* Full name  on both signup modes */}
            {isSignup && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Your Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required />
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Work Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Join code  only on join_company */}
            {mode === 'join_company' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Company Join Code <span style={{ color: '#f59e0b' }}>*</span>
                </label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AF2026"
                  maxLength={8}
                  required
                  style={{ letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace', fontSize: 15 }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Found on your admin's Dashboard → Company Join Code card.
                </p>
              </div>
            )}

            {error === 'COMPANY_EXISTS' ? (
              <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 12 }}>
                <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 6 }}>Company already registered</div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 10 }}>This system already has a company set up. Sign in with your existing account, or use the Join Company tab if you are a new employee.</div>
                <button type="button" onClick={() => switchMode('login')}
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#60a5fa', cursor: 'pointer', fontWeight: 500 }}>
                  Go to Sign In
                </button>
              </div>
            ) : error ? (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#f87171' }}>
                {error}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              disabled={loading}>
              {loading ? 'Please wait...'
                : mode === 'login'          ? 'Sign In'
                : mode === 'create_company' ? 'Register Company'
                : 'Request Access'}
            </button>
          </form>
        </div>

        {/* Quick demo access  for evaluators */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Demo Access</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <QuickLoginButton
              label="Admin Demo"
              email="demo.admin@assetflow.com"
              role="admin"
              onLogin={() => { window.location.href = '/dashboard' }}
            />
            <QuickLoginButton
              label="Employee Demo"
              email="demo.employee@assetflow.com"
              role="employee"
              onLogin={() => { window.location.href = '/dashboard' }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            One click  signs in with pre-seeded demo data
          </p>
        </div>
      </div>
    </div>
  )
}
