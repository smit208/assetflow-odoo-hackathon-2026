import { supabase } from '../lib/supabase'
import { logActivity } from './activityService'

export async function closeCycle(cycleId, closedBy) {
  const { data: cycle } = await supabase
    .from('audit_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()

  if (!cycle) throw new Error('Audit cycle not found')
  if (cycle.status === 'closed') throw new Error('Cycle already closed')

  // find all missing items in this cycle
  const { data: missingItems } = await supabase
    .from('audit_items')
    .select('*, assets(id, tag, name)')
    .eq('audit_cycle_id', cycleId)
    .eq('verification', 'missing')

  const damagedItems = await supabase
    .from('audit_items')
    .select('*, assets(id, tag, name)')
    .eq('audit_cycle_id', cycleId)
    .eq('verification', 'damaged')

  // update missing assets to lost
  if (missingItems?.length) {
    const missingAssetIds = missingItems.map(i => i.asset_id)
    await supabase
      .from('assets')
      .update({ status: 'lost', updated_at: new Date().toISOString() })
      .in('id', missingAssetIds)

    for (const item of missingItems) {
      await logActivity(closedBy, 'ASSET_MARKED_LOST', 'asset', item.asset_id, {
        cycleId,
        tag: item.assets?.tag,
        reason: 'audit_missing'
      })
    }
  }

  // lock the cycle
  await supabase
    .from('audit_cycles')
    .update({ status: 'closed' })
    .eq('id', cycleId)

  await logActivity(closedBy, 'AUDIT_CYCLE_CLOSED', 'audit_cycle', cycleId, {
    missingCount: missingItems?.length || 0,
    damagedCount: damagedItems?.data?.length || 0
  })

  return {
    cycleId,
    missingAssets: missingItems || [],
    damagedAssets: damagedItems?.data || [],
    closedAt: new Date().toISOString()
  }
}

export async function submitAuditItem(cycleId, assetId, verification, notes, auditorId) {
  const existing = await supabase
    .from('audit_items')
    .select('id')
    .eq('audit_cycle_id', cycleId)
    .eq('asset_id', assetId)
    .single()

  if (existing.data) {
    await supabase
      .from('audit_items')
      .update({ verification, notes, audited_at: new Date().toISOString() })
      .eq('id', existing.data.id)
  } else {
    await supabase.from('audit_items').insert({
      audit_cycle_id: cycleId,
      asset_id: assetId,
      verification,
      notes,
      audited_at: new Date().toISOString()
    })
  }

  if (verification !== 'verified') {
    await supabase.from('notifications').insert({
      user_id: auditorId,
      type: 'audit_discrepancy',
      message: `Audit discrepancy flagged  asset marked as ${verification}`,
      related_entity_id: assetId,
      related_entity_type: 'asset'
    })
  }
}
