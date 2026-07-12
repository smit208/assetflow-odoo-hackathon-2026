import { supabase } from '../lib/supabase'
import { logActivity } from './activityService'

// single source of truth for all allocation transitions
// nothing else in the app should directly mutate asset status for allocations

export async function allocateAsset(assetId, toUserId, expectedReturnDate, allocatedBy) {
  // check current status first
  const { data: asset, error: fetchErr } = await supabase
    .from('assets')
    .select('id, tag, name, status, current_holder_id, profiles!current_holder_id(name, email)')
    .eq('id', assetId)
    .single()

  if (fetchErr) throw fetchErr

  if (asset.status !== 'available') {
    const holder = asset.profiles
    throw {
      code: 'ALREADY_ALLOCATED',
      message: `${asset.name} is currently held by ${holder?.name || 'another user'}`,
      holder: { id: asset.current_holder_id, name: holder?.name, email: holder?.email }
    }
  }

  // do the allocation
  const { data: allocation, error: allocErr } = await supabase
    .from('allocations')
    .insert({
      asset_id: assetId,
      from_user_id: allocatedBy,
      to_user_id: toUserId,
      expected_return_date: expectedReturnDate || null,
      status: 'active'
    })
    .select()
    .single()

  if (allocErr) throw allocErr

  // update asset
  await supabase
    .from('assets')
    .update({ status: 'allocated', current_holder_id: toUserId, current_holder_type: 'user', updated_at: new Date().toISOString() })
    .eq('id', assetId)

  // notify recipient
  await supabase.from('notifications').insert({
    user_id: toUserId,
    type: 'asset_assigned',
    message: `Asset ${asset.tag}  ${asset.name} has been allocated to you`,
    related_entity_id: assetId,
    related_entity_type: 'asset'
  })

  await logActivity(allocatedBy, 'ALLOCATE', 'asset', assetId, { to: toUserId, tag: asset.tag })

  return allocation
}

export async function returnAsset(allocationId, conditionNotes, returnedBy) {
  const { data: alloc } = await supabase
    .from('allocations')
    .select('*, assets(tag, name)')
    .eq('id', allocationId)
    .single()

  if (!alloc) throw new Error('Allocation not found')

  await supabase
    .from('allocations')
    .update({ status: 'returned', returned_at: new Date().toISOString(), condition_notes: conditionNotes })
    .eq('id', allocationId)

  await supabase
    .from('assets')
    .update({ status: 'available', current_holder_id: null, current_holder_type: null, updated_at: new Date().toISOString() })
    .eq('id', alloc.asset_id)

  await logActivity(returnedBy, 'RETURN', 'asset', alloc.asset_id, { tag: alloc.assets?.tag, condition: conditionNotes })
}

export async function flagOverdueAllocations() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('allocations')
    .select('id')
    .eq('status', 'active')
    .lt('expected_return_date', today)
    .not('expected_return_date', 'is', null)

  if (!data?.length) return

  const ids = data.map(a => a.id)
  await supabase
    .from('allocations')
    .update({ status: 'overdue' })
    .in('id', ids)
}

export async function createTransferRequest(assetId, fromUserId, toUserId, reason) {
  const { data, error } = await supabase
    .from('transfer_requests')
    .insert({ asset_id: assetId, from_user_id: fromUserId, to_user_id: toUserId, reason, status: 'requested' })
    .select()
    .single()

  if (error) throw error

  await logActivity(fromUserId, 'TRANSFER_REQUEST', 'asset', assetId, { to: toUserId, reason })
  return data
}

export async function approveTransfer(transferId, approvedBy) {
  const { data: tr } = await supabase
    .from('transfer_requests')
    .select('*')
    .eq('id', transferId)
    .single()

  if (!tr) throw new Error('Transfer request not found')

  // close existing allocation
  await supabase
    .from('allocations')
    .update({ status: 'returned', returned_at: new Date().toISOString() })
    .eq('asset_id', tr.asset_id)
    .eq('status', 'active')

  // create new allocation
  await supabase.from('allocations').insert({
    asset_id: tr.asset_id,
    from_user_id: tr.from_user_id,
    to_user_id: tr.to_user_id,
    status: 'active'
  })

  await supabase
    .from('assets')
    .update({ current_holder_id: tr.to_user_id, updated_at: new Date().toISOString() })
    .eq('id', tr.asset_id)

  await supabase
    .from('transfer_requests')
    .update({ status: 'completed', approved_by: approvedBy })
    .eq('id', transferId)

  await logActivity(approvedBy, 'TRANSFER_APPROVE', 'asset', tr.asset_id, { to: tr.to_user_id })
}

// Overdue check runs automatically on tab open
