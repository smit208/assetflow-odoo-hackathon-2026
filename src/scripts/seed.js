import { supabase } from '../lib/supabase'

// ============================================================
// SEED DEMO DATA
// Uses the currently logged-in user as the admin reference.
// Run this AFTER signing up and being logged in.
// ============================================================

export async function seedDemoData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in before loading demo data')

  const adminId = user.id

  // Make sure current user is admin
  await supabase.from('profiles').update({ role: 'admin', name: 'Arjun Mehta (Admin)' }).eq('id', adminId)

  // ── 1. Departments ──────────────────────────────────────
  const { data: depts } = await supabase
    .from('departments')
    .upsert([
      { name: 'Engineering', location: 'Floor 3', status: 'active' },
      { name: 'Finance', location: 'Floor 2', status: 'active' },
      { name: 'Operations', location: 'Floor 1', status: 'active' },
      { name: 'HR', location: 'Floor 2', status: 'active' },
    ], { onConflict: 'name' })
    .select()

  const deptMap = {}
  depts?.forEach(d => { deptMap[d.name] = d.id })

  // ── 2. Asset Categories ─────────────────────────────────
  const { data: cats } = await supabase
    .from('asset_categories')
    .upsert([
      { name: 'Laptop', default_depreciation_rate: 25, custom_field_name: 'Warranty Period', custom_field_value: '3 years' },
      { name: 'Monitor', default_depreciation_rate: 20, custom_field_name: 'Panel Type', custom_field_value: 'IPS' },
      { name: 'Chair', default_depreciation_rate: 10, custom_field_name: 'Material', custom_field_value: 'Mesh' },
      { name: 'Projector', default_depreciation_rate: 15, custom_field_name: 'Resolution', custom_field_value: '1080p' },
      { name: 'Phone', default_depreciation_rate: 33, custom_field_name: 'OS', custom_field_value: 'iOS 17' },
    ], { onConflict: 'name' })
    .select()

  const catMap = {}
  cats?.forEach(c => { catMap[c.name] = c.id })

  // ── 3. Assets ───────────────────────────────────────────
  // First batch: available assets (no holder)
  const { data: createdAssets } = await supabase
    .from('assets')
    .upsert([
      {
        tag: 'LAP-2026-1001', name: 'Dell Latitude 7420',
        category_id: catMap['Laptop'], department_id: deptMap['Engineering'],
        status: 'available', purchase_cost: 85000, condition: 'good',
        serial_number: 'DLSN-00112', purchase_date: '2025-01-15', is_bookable: false
      },
      {
        tag: 'LAP-2026-1002', name: 'MacBook Pro 14"',
        category_id: catMap['Laptop'], department_id: deptMap['Finance'],
        status: 'available', purchase_cost: 175000, condition: 'new',
        serial_number: 'MCSN-00448', purchase_date: '2026-03-10', is_bookable: false
      },
      {
        tag: 'MON-2026-2001', name: 'LG UltraWide 34"',
        category_id: catMap['Monitor'], department_id: deptMap['Engineering'],
        status: 'available', purchase_cost: 35000, condition: 'good', is_bookable: false
      },
      {
        tag: 'PRJ-2026-3001', name: 'Epson EB-X51 Projector',
        category_id: catMap['Projector'], department_id: deptMap['Operations'],
        status: 'available', purchase_cost: 45000, condition: 'good',
        location: 'Conference Room A', is_bookable: true
      },
      {
        tag: 'LAP-2026-1003', name: 'HP EliteBook 850',
        category_id: catMap['Laptop'], department_id: deptMap['HR'],
        status: 'under_maintenance', purchase_cost: 72000, condition: 'fair',
        serial_number: 'HPSN-00891', purchase_date: '2024-06-01', is_bookable: false
      },
      {
        tag: 'PHN-2026-4001', name: 'iPhone 15 Pro',
        category_id: catMap['Phone'], department_id: deptMap['Operations'],
        status: 'lost', purchase_cost: 130000, condition: 'good', is_bookable: false
      },
      {
        tag: 'CHR-2026-5001', name: 'Herman Miller Aeron',
        category_id: catMap['Chair'], department_id: deptMap['Engineering'],
        status: 'available', purchase_cost: 95000, condition: 'good', is_bookable: false
      },
    ], { onConflict: 'tag' })
    .select()

  const assetMap = {}
  createdAssets?.forEach(a => { assetMap[a.tag] = a.id })

  // ── 4. Allocate LAP-2026-1001 to the current admin ─────
  // This ensures Directory and Allocation screen are CONSISTENT
  if (assetMap['LAP-2026-1001']) {
    // Create the allocation record
    const { data: allocData } = await supabase
      .from('allocations')
      .insert({
        asset_id: assetMap['LAP-2026-1001'],
        from_user_id: adminId,
        to_user_id: adminId,
        status: 'active',
        expected_return_date: '2026-12-31'
      })
      .select()
      .single()

    // Update the asset to reflect allocation
    await supabase
      .from('assets')
      .update({
        status: 'allocated',
        current_holder_id: adminId,
        current_holder_type: 'user'
      })
      .eq('id', assetMap['LAP-2026-1001'])
  }

  // ── 5. Maintenance request for HP laptop ────────────────
  if (assetMap['LAP-2026-1003']) {
    const existing = await supabase.from('maintenance_requests')
      .select('id').eq('asset_id', assetMap['LAP-2026-1003']).limit(1)
    if (!existing.data?.length) {
      await supabase.from('maintenance_requests').insert({
        asset_id: assetMap['LAP-2026-1003'],
        raised_by: adminId,
        issue: 'Keyboard keys not responding  keys D, F, G stuck after liquid spill near workstation',
        priority: 'high',
        status: 'approved',
        approved_by: adminId,
        technician_name: 'Ramesh Kumar'
      })
    }
  }

  // Also one pending maintenance for the projector (to show kanban Pending column)
  if (assetMap['PRJ-2026-3001']) {
    const existing = await supabase.from('maintenance_requests')
      .select('id').eq('asset_id', assetMap['PRJ-2026-3001']).limit(1)
    if (!existing.data?.length) {
      await supabase.from('maintenance_requests').insert({
        asset_id: assetMap['PRJ-2026-3001'],
        raised_by: adminId,
        issue: 'Intermittent flickering during presentations  suspected bulb wear',
        priority: 'medium',
        status: 'pending'
      })
    }
  }

  // ── 6. Resource bookings for projector ──────────────────
  // Booking 1: Tomorrow 10:00–12:00 (will succeed)
  // Booking 2: Tomorrow 09:30–11:00 (overlaps  demonstrates conflict rejection)
  if (assetMap['PRJ-2026-3001']) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const b1Start = new Date(tomorrow); b1Start.setHours(10, 0, 0, 0)
    const b1End   = new Date(tomorrow); b1End.setHours(12, 0, 0, 0)

    await supabase.from('bookings').upsert({
      resource_asset_id: assetMap['PRJ-2026-3001'],
      booked_by_user_id: adminId,
      start_time: b1Start.toISOString(),
      end_time:   b1End.toISOString(),
      status: 'upcoming'
    }, { onConflict: 'id' })
  }

  // ── 7. Audit cycle ──────────────────────────────────────
  const existingCycles = await supabase.from('audit_cycles').select('id').limit(1)
  if (!existingCycles.data?.length) {
    const { data: cycle } = await supabase.from('audit_cycles').insert({
      name: 'Q2 2026 Engineering Audit',
      scope_department_id: deptMap['Engineering'],
      start_date: '2026-07-01',
      end_date: '2026-07-15',
      status: 'open',
      created_by: adminId
    }).select().single()

    // Pre-seed one verified and one missing audit item
    if (cycle && assetMap['LAP-2026-1001'] && assetMap['MON-2026-2001']) {
      await supabase.from('audit_items').insert([
        { audit_cycle_id: cycle.id, asset_id: assetMap['LAP-2026-1001'], verification: 'verified', notes: 'Physically located at workstation 3A' },
        { audit_cycle_id: cycle.id, asset_id: assetMap['MON-2026-2001'], verification: 'missing', notes: 'Not found at expected location  may have been moved to storage' },
      ])
    }
  }

  // ── 8. Activity log entries ─────────────────────────────
  await supabase.from('activity_log').insert([
    { user_id: adminId, action: 'ALLOCATE', entity_type: 'asset', details: { tag: 'LAP-2026-1001', to: adminId } },
    { user_id: adminId, action: 'RAISE_MAINTENANCE', entity_type: 'asset', details: { tag: 'LAP-2026-1003', issue: 'Keyboard stuck' } },
    { user_id: adminId, action: 'MAINTENANCE_APPROVED', entity_type: 'asset', details: { tag: 'LAP-2026-1003' } },
  ])

  console.log('✅ Seed complete. Refresh the page and explore all screens.')
  return { success: true }
}
