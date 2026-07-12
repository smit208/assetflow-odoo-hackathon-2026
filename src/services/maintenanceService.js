import { supabase } from '../lib/supabase'
import { logActivity } from './activityService'

// the only place maintenance status changes happen
// asset status updates are tied to these transitions exclusively

const VALID_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['technician_assigned', 'rejected'],
  technician_assigned: ['in_progress'],
  in_progress: ['resolved'],
}

export async function updateMaintenanceStatus(requestId, newStatus, actorId) {
  const { data: req } = await supabase
    .from('maintenance_requests')
    .select('*, assets(id, tag, name, status)')
    .eq('id', requestId)
    .single()

  if (!req) throw new Error('Maintenance request not found')

  const allowed = VALID_TRANSITIONS[req.status] || []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${req.status} to ${newStatus}`)
  }

  const updates = { status: newStatus, updated_at: new Date().toISOString() }
  if (newStatus === 'approved') updates.approved_by = actorId

  await supabase
    .from('maintenance_requests')
    .update(updates)
    .eq('id', requestId)

  // asset status tied to approval and resolution only
  if (newStatus === 'approved') {
    await supabase
      .from('assets')
      .update({ status: 'under_maintenance', updated_at: new Date().toISOString() })
      .eq('id', req.asset_id)
  }

  if (newStatus === 'resolved') {
    await supabase
      .from('assets')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', req.asset_id)
  }

  // notify the person who raised the request
  const msgMap = {
    approved: `Maintenance request for ${req.assets?.tag} has been approved`,
    rejected: `Maintenance request for ${req.assets?.tag} was rejected`,
    resolved: `${req.assets?.tag} maintenance is resolved and the asset is available again`,
    technician_assigned: `A technician has been assigned to ${req.assets?.tag}`,
    in_progress: `Maintenance work has started on ${req.assets?.tag}`,
  }

  await supabase.from('notifications').insert({
    user_id: req.raised_by,
    type: `maintenance_${newStatus}`,
    message: msgMap[newStatus] || `Maintenance status updated to ${newStatus}`,
    related_entity_id: requestId,
    related_entity_type: 'maintenance'
  })

  await logActivity(actorId, `MAINTENANCE_${newStatus.toUpperCase()}`, 'maintenance', requestId, {
    assetTag: req.assets?.tag,
    previousStatus: req.status
  })
}

export async function createMaintenanceRequest(assetId, raisedBy, issue, priority, photoUrl, technicianName) {
  const { data: asset } = await supabase
    .from('assets')
    .select('tag, name')
    .eq('id', assetId)
    .single()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert({
      asset_id: assetId,
      raised_by: raisedBy,
      issue,
      priority,
      photo_url: photoUrl || null,
      technician_name: technicianName || null,
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error

  await logActivity(raisedBy, 'RAISE_MAINTENANCE', 'maintenance', data.id, {
    assetTag: asset?.tag,
    priority,
    issue
  })

  return data
}
