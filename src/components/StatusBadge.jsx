const STATUS_CONFIG = {
  available:         { dot: 'dot-available',    label: 'Available',         bg: 'rgba(34,197,94,0.1)',   color: '#4ade80' },
  allocated:         { dot: 'dot-allocated',    label: 'Allocated',         bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa' },
  reserved:          { dot: 'dot-reserved',     label: 'Reserved',          bg: 'rgba(168,85,247,0.1)', color: '#c084fc' },
  under_maintenance: { dot: 'dot-maintenance',  label: 'Under Maintenance', bg: 'rgba(249,115,22,0.1)', color: '#fb923c' },
  lost:              { dot: 'dot-lost',         label: 'Lost',              bg: 'rgba(239,68,68,0.1)',   color: '#f87171' },
  retired:           { dot: 'dot-retired',      label: 'Retired',           bg: 'rgba(139,144,167,0.1)', color: '#8b90a7' },
  disposed:          { dot: 'dot-disposed',     label: 'Disposed',          bg: 'rgba(75,85,99,0.1)',    color: '#6b7280' },
  // booking statuses
  upcoming:  { label: 'Upcoming',  bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa' },
  ongoing:   { label: 'Ongoing',   bg: 'rgba(34,197,94,0.1)',   color: '#4ade80' },
  completed: { label: 'Completed', bg: 'rgba(139,144,167,0.1)', color: '#8b90a7' },
  cancelled: { label: 'Cancelled', bg: 'rgba(239,68,68,0.1)',   color: '#f87171' },
  // maintenance statuses
  pending:             { label: 'Pending',             bg: 'rgba(249,115,22,0.1)', color: '#fb923c' },
  approved:            { label: 'Approved',            bg: 'rgba(34,197,94,0.1)',  color: '#4ade80' },
  rejected:            { label: 'Rejected',            bg: 'rgba(239,68,68,0.1)',  color: '#f87171' },
  technician_assigned: { label: 'Tech Assigned',       bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
  in_progress:         { label: 'In Progress',         bg: 'rgba(168,85,247,0.1)', color: '#c084fc' },
  resolved:            { label: 'Resolved',            bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  // audit
  open:         { label: 'Open',        bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa' },
  in_progress:  { label: 'In Progress', bg: 'rgba(249,115,22,0.1)',  color: '#fb923c' },
  closed:       { label: 'Closed',      bg: 'rgba(139,144,167,0.1)', color: '#8b90a7' },
  // allocation
  active:   { label: 'Active',   bg: 'rgba(34,197,94,0.1)',  color: '#4ade80' },
  returned: { label: 'Returned', bg: 'rgba(139,144,167,0.1)', color: '#8b90a7' },
  overdue:  { label: 'Overdue',  bg: 'rgba(239,68,68,0.1)',  color: '#f87171' },
}

export default function StatusBadge({ status, showDot = true }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'rgba(139,144,167,0.1)', color: '#8b90a7', dot: '' }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 500,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap'
    }}>
      {showDot && cfg.dot && <span className={`dot ${cfg.dot}`} style={{ width:6, height:6, marginRight:2 }} />}
      {cfg.label}
    </span>
  )
}
