import { supabase } from '../lib/supabase'
import { logActivity } from './activityService'

export async function createBooking(resourceId, userId, startTime, endTime) {
  // Overlap rule: StartA < EndB AND EndA > StartB
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('*')
    .eq('resource_asset_id', resourceId)
    .eq('status', 'upcoming')
    .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)

  if (conflicts && conflicts.length > 0) {
    const c = conflicts[0]
    // Fetch booker name separately
    const { data: bookerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', c.booked_by_user_id)
      .single()

    throw {
      code: 'OVERLAP',
      message: 'Time slot already booked',
      conflicting: {
        start: c.start_time,
        end: c.end_time,
        bookedBy: bookerProfile?.name || 'Someone'
      }
    }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      resource_asset_id: resourceId,
      booked_by_user_id: userId,
      start_time: startTime,
      end_time: endTime,
      status: 'upcoming'
    })
    .select()
    .single()

  if (error) throw error

  // update asset status to reserved
  await supabase
    .from('assets')
    .update({ status: 'reserved' })
    .eq('id', resourceId)
    .eq('status', 'available')

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'booking_confirmed',
    message: `Your booking is confirmed for ${new Date(startTime).toLocaleString()}`,
    related_entity_id: data.id,
    related_entity_type: 'booking'
  })

  await logActivity(userId, 'BOOK_RESOURCE', 'booking', data.id, { resourceId, startTime, endTime })
  return data
}

export async function cancelBooking(bookingId, userId) {
  await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'booking_cancelled',
    message: 'Your booking has been cancelled',
    related_entity_id: bookingId,
    related_entity_type: 'booking'
  })

  await logActivity(userId, 'CANCEL_BOOKING', 'booking', bookingId, {})
}

export async function getBookingsForResource(resourceId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, resource_asset_id, booked_by_user_id, start_time, end_time, status, created_at')
    .eq('resource_asset_id', resourceId)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  if (error) throw error

  // Enrich with profile names via separate query
  const userIds = [...new Set((data || []).map(b => b.booked_by_user_id).filter(Boolean))]
  let profileMap = {}
  if (userIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', userIds)
    ;(profs || []).forEach(p => { profileMap[p.id] = p })
  }

  return (data || []).map(b => ({
    ...b,
    profiles: profileMap[b.booked_by_user_id] || null
  }))
}
