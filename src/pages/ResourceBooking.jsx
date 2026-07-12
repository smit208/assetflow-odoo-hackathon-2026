import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'
import { createBooking, cancelBooking, getBookingsForResource } from '../services/bookingService'
import { CalendarDays, Clock, X, Info } from 'lucide-react'

// ─── Heatmap constants ────────────────────────────────────────────────────────
const HOUR_START = 8   // 08:00
const HOUR_END   = 20  // 20:00 (last slot starts at 19:00)
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

function get7Days() {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

function slotBooking(bookings, day, hour) {
  const slotStart = new Date(day)
  slotStart.setHours(hour, 0, 0, 0)
  const slotEnd = new Date(slotStart)
  slotEnd.setHours(hour + 1, 0, 0, 0)

  return bookings.find(b => {
    const bStart = new Date(b.start_time)
    const bEnd   = new Date(b.end_time)
    // overlap: slotStart < bEnd AND slotEnd > bStart
    return slotStart < bEnd && slotEnd > bStart
  }) || null
}

function fmtDayHeader(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
}
function fmtHour(h) {
  return `${String(h).padStart(2, '0')}:00`
}
function fmt(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function truncate(str = '', max = 10) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function Tooltip({ text, visible, x, y }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed',
      left: x + 12,
      top: y - 8,
      background: 'rgba(15,17,30,0.96)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      padding: '6px 10px',
      fontSize: 11,
      color: '#e2e8f0',
      pointerEvents: 'none',
      zIndex: 9999,
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {text}
    </div>
  )
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function BookingHeatmap({ bookings, conflictSlot, onSlotClick }) {
  const days = get7Days()
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0 })
  const today = new Date(); today.setHours(0, 0, 0, 0)

  function isConflict(day, hour) {
    if (!conflictSlot) return false
    const slotStart = new Date(day); slotStart.setHours(hour, 0, 0, 0)
    const slotEnd   = new Date(slotStart); slotEnd.setHours(hour + 1, 0, 0, 0)
    const cStart = new Date(conflictSlot.start)
    const cEnd   = new Date(conflictSlot.end)
    return slotStart < cEnd && slotEnd > cStart
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(135deg,#ef4444,#f97316)', display: 'inline-block' }} />
          Booked
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'inline-block' }} />
          Available
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(234,179,8,0.25)', border: '1px solid rgba(234,179,8,0.5)', display: 'inline-block' }} />
          Today
        </div>
      </div>

      {/* Grid wrapper */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `52px repeat(7, 1fr)`,
          gap: 2,
          minWidth: 560,
        }}>
          {/* Header row */}
          <div /> {/* empty corner */}
          {days.map((d, di) => {
            const isToday = d.getTime() === today.getTime()
            return (
              <div key={di} style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: isToday ? '#f59e0b' : 'var(--text-muted)',
                padding: '4px 2px',
                letterSpacing: '0.04em',
              }}>
                {fmtDayHeader(d)}
              </div>
            )
          })}

          {/* Hour rows */}
          {HOURS.map(hour => (
            <>
              {/* Hour label */}
              <div key={`lbl-${hour}`} style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 6,
                fontFamily: 'monospace',
                userSelect: 'none',
              }}>
                {fmtHour(hour)}
              </div>

              {/* Day cells */}
              {days.map((day, di) => {
                const booking = slotBooking(bookings, day, hour)
                const isPast = (() => {
                  const slotTime = new Date(day); slotTime.setHours(hour + 1, 0, 0, 0)
                  return slotTime < new Date()
                })()
                const conflict = isConflict(day, hour)
                const isToday  = day.getTime() === today.getTime()

                let bg, border, cursor
                if (conflict) {
                  bg = 'rgba(239,68,68,0.5)'; border = '1.5px solid #ef4444'; cursor = 'default'
                } else if (booking) {
                  bg = 'linear-gradient(135deg, rgba(239,68,68,0.75), rgba(249,115,22,0.65))'
                  border = '1px solid rgba(249,115,22,0.4)'
                  cursor = 'default'
                } else if (isPast) {
                  bg = 'rgba(255,255,255,0.02)'; border = '1px solid rgba(255,255,255,0.04)'; cursor = 'not-allowed'
                } else {
                  bg = isToday ? 'rgba(234,179,8,0.06)' : 'rgba(255,255,255,0.035)'
                  border = isToday ? '1px solid rgba(234,179,8,0.18)' : '1px solid rgba(255,255,255,0.06)'
                  cursor = 'pointer'
                }

                const tooltipText = booking
                  ? `Booked by ${booking.profiles?.name || 'Unknown'}`
                  : isPast ? 'Past slot'
                  : 'Available  Book this slot'

                return (
                  <div
                    key={`${di}-${hour}`}
                    className={conflict ? 'heatmap-conflict-flash' : ''}
                    style={{
                      height: 28,
                      borderRadius: 4,
                      background: bg,
                      border,
                      cursor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      transition: 'filter 0.15s, transform 0.1s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isPast) {
                        e.currentTarget.style.filter = 'brightness(1.3)'
                        e.currentTarget.style.transform = 'scale(1.04)'
                      }
                      setTooltip({ visible: true, text: tooltipText, x: e.clientX, y: e.clientY })
                    }}
                    onMouseMove={e => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                    onMouseLeave={e => {
                      e.currentTarget.style.filter = ''
                      e.currentTarget.style.transform = ''
                      setTooltip(t => ({ ...t, visible: false }))
                    }}
                    onClick={() => {
                      if (!booking && !isPast && !conflict && onSlotClick) {
                        onSlotClick(day, hour)
                      }
                    }}
                  >
                    {booking && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.9)',
                        padding: '0 3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                      }}>
                        {truncate(booking.profiles?.name || '?', 8)}
                      </span>
                    )}
                    {conflict && !booking && (
                      <span style={{ fontSize: 9, color: '#fca5a5', fontWeight: 700 }}>✕</span>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Overlap rule */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        padding: '6px 10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 6,
      }}>
        <Info size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          Overlap rule:&nbsp;
          <span style={{ color: '#f59e0b' }}>(NewStart &lt; ExistingEnd)</span>
          &nbsp;AND&nbsp;
          <span style={{ color: '#f59e0b' }}>(NewEnd &gt; ExistingStart)</span>
        </span>
      </div>

      <Tooltip {...tooltip} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResourceBooking() {
  const { profile } = useAuthStore()
  const [resources, setResources]     = useState([])
  const [selected, setSelected]       = useState(null)
  const [bookings, setBookings]       = useState([])
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState({ start_time: '', end_time: '' })
  const [error, setError]             = useState(null)
  const [saving, setSaving]           = useState(false)
  const [conflictSlot, setConflictSlot] = useState(null) // { start, end, bookedBy }

  useEffect(() => {
    supabase.from('assets').select('id, tag, name, location').eq('is_bookable', true).eq('status', 'available').order('name')
      .then(({ data }) => setResources(data || []))
  }, [])

  // also include reserved assets that might still show in list
  useEffect(() => {
    supabase.from('assets').select('id, tag, name, location').eq('is_bookable', true).order('name')
      .then(({ data }) => setResources(data || []))
  }, [])

  async function selectResource(r) {
    setSelected(r)
    setShowForm(false)
    setError(null)
    setConflictSlot(null)
    const data = await getBookingsForResource(r.id)
    setBookings(data)
  }

  async function handleBook(e) {
    e.preventDefault()
    if (!profile?.id) {
      setError('Session expired  please sign out and sign in again')
      return
    }
    setSaving(true)
    setError(null)
    setConflictSlot(null)
    try {
      await createBooking(selected.id, profile.id, form.start_time, form.end_time)
      setShowForm(false)
      setForm({ start_time: '', end_time: '' })
      const data = await getBookingsForResource(selected.id)
      setBookings(data)
    } catch (err) {
      if (err.code === 'OVERLAP') {
        const c = err.conflicting
        setConflictSlot(c)
        setError(
          `Conflict: ${c.bookedBy} already has this resource from ${fmt(c.start)} to ${fmt(c.end)}`
        )
        // Auto-clear conflict flash after 4s
        setTimeout(() => setConflictSlot(null), 4000)
      } else {
        setError(err.message || 'Booking failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(bookingId) {
    await cancelBooking(bookingId, profile.id)
    const data = await getBookingsForResource(selected.id)
    setBookings(data)
  }

  const formRef = useRef(null)

  function handleSlotClick(day, hour) {
    // Build datetime-local strings: YYYY-MM-DDTHH:mm
    const pad = n => String(n).padStart(2, '0')
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)
    const end = new Date(day)
    end.setHours(hour + 1, 0, 0, 0)

    const toLocal = d =>
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

    setForm({ start_time: toLocal(start), end_time: toLocal(end) })
    setShowForm(true)
    setError(null)
    setConflictSlot(null)
    // Scroll form into view after render
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }

  return (
    <div>
      {/* ── Inline styles for conflict flash animation ── */}
      <style>{`
        @keyframes conflictFlash {
          0%   { background: rgba(239,68,68,0.15); box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          25%  { background: rgba(239,68,68,0.55); box-shadow: 0 0 0 4px rgba(239,68,68,0.25); }
          50%  { background: rgba(239,68,68,0.15); box-shadow: 0 0 0 0 rgba(239,68,68,0.1); }
          75%  { background: rgba(239,68,68,0.55); box-shadow: 0 0 0 4px rgba(239,68,68,0.25); }
          100% { background: rgba(239,68,68,0.35); box-shadow: 0 0 0 0 rgba(239,68,68,0.1); }
        }
        .heatmap-conflict-flash {
          animation: conflictFlash 1.2s ease-in-out 3 !important;
          border: 1.5px solid #ef4444 !important;
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Resource Booking</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Book shared assets by time slot  conflicts automatically rejected</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>

        {/* ── Resource list ── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Bookable Resources
          </div>
          {resources.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>
              No bookable assets.<br />Mark an asset as bookable when registering.
            </div>
          )}
          {resources.map(r => (
            <div
              key={r.id}
              onClick={() => selectResource(r)}
              className="card-hover"
              style={{
                padding: '12px 14px',
                marginBottom: 8,
                background: selected?.id === r.id ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)',
                border: `1px solid ${selected?.id === r.id ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', marginTop: 2 }}>{r.tag}</div>
              {r.location && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.location}</div>}
            </div>
          ))}
        </div>

        {/* ── Booking panel ── */}
        <div>
          {!selected && (
            <div className="surface" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <CalendarDays size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13 }}>Select a resource to view its bookings</p>
            </div>
          )}

          {selected && (
            <>
              {/* ── Resource info header ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.location || 'No location specified'}</div>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setError(null); setConflictSlot(null) }}>
                  <CalendarDays size={13} /> Book Slot
                </button>
              </div>

              {/* ── Booking form  appears when slot clicked or Book Slot pressed ── */}
              {showForm && (
                <div ref={formRef} className="surface" style={{ padding: 20, marginBottom: 16, border: '1px solid rgba(245,158,11,0.25)' }}>
                  <form onSubmit={handleBook}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Start Date &amp; Time *</label>
                        <input type="datetime-local" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} required />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>End Date &amp; Time *</label>
                        <input type="datetime-local" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} required />
                      </div>
                    </div>
                    {error && (
                      <div style={{
                        marginTop: 10,
                        padding: '10px 14px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
                        {error}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setError(null); setConflictSlot(null) }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Checking conflicts…' : 'Confirm Booking'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── HEATMAP  click any available slot to auto-fill form ── */}
              <div className="surface" style={{ padding: 20, marginBottom: 16 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <CalendarDays size={14} style={{ color: 'var(--accent)' }} />
                  Availability  Next 7 Days
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                    (08:00 – 20:00)
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                    Click an available slot to book
                  </span>
                </div>
                <BookingHeatmap bookings={bookings} conflictSlot={conflictSlot} onSlotClick={handleSlotClick} />
              </div>

              {/* ── Upcoming bookings list ── */}
              <div className="surface" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Upcoming Bookings ({bookings.length})
                </div>
                {bookings.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No upcoming bookings  slot is open
                  </div>
                )}
                {bookings.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(46,51,71,0.4)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{b.profiles?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <Clock size={11} /> {fmt(b.start_time)} → {fmt(b.end_time)}
                      </div>
                    </div>
                    {b.booked_by_user_id === profile?.id && (
                      <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleCancel(b.id)}>
                        <X size={11} /> Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
