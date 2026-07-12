import { supabase } from '../lib/supabase'

// computes sha256 of a string using the built-in Web Crypto API
// no external dependencies
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

let lastHash = null

// call this from every service after a state change
export async function logActivity(userId, action, entityType, entityId, details = {}) {
  // get the last hash to chain from
  if (!lastHash) {
    const { data } = await supabase
      .from('activity_log')
      .select('row_hash')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()
    lastHash = data?.row_hash || '0000000000000000'
  }

  const ts = new Date().toISOString()
  const rawStr = `${action}|${ts}|${entityId || '-'}|${lastHash}`
  const rowHash = await sha256(rawStr)

  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      timestamp: ts,
      details,
      prev_hash: lastHash,
      row_hash: rowHash
    })
    .select()
    .single()

  if (!error && data) {
    lastHash = rowHash
  }

  return data
}

// verifies the hash chain integrity  used on the Activity Logs screen
export async function verifyChain() {
  const { data: logs } = await supabase
    .from('activity_log')
    .select('*')
    .order('timestamp', { ascending: true })

  if (!logs || logs.length === 0) return { intact: true, brokenAt: null }

  let prevHash = '0000000000000000'
  for (const log of logs) {
    const rawStr = `${log.action}|${log.timestamp}|${log.entity_id || '-'}|${prevHash}`
    const expected = await sha256(rawStr)
    if (expected !== log.row_hash) {
      return { intact: false, brokenAt: log.id, timestamp: log.timestamp }
    }
    prevHash = log.row_hash
  }

  return { intact: true, brokenAt: null }
}
