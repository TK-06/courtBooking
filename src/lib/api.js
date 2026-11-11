import { supabase } from './supabase.js'
import { MESSAGES } from './rules.js'

export function toBooking(row) {
  return {
    id:row.id, code:row.code, userId:row.user_id, courtId:row.court_id,
    date:row.date, start:row.start_hour, end:row.end_hour, status:row.status,
    purpose:row.purpose, cancelReason:row.cancel_reason, cancelNote:row.cancel_note,
    cancelledBy:row.cancelled_by, createdAt:new Date(row.created_at),
  }
}

export function toLoan(row) {
  return { id:row.id, userId:row.user_id, date:row.date, racket:row.racket,
    balls:row.balls, status:row.status, createdAt:new Date(row.created_at) }
}

export function toEvent(row) {
  return { id:row.id, bookingId:row.booking_id, loanId:row.loan_id, userId:row.user_id,
    kind:row.kind, text:row.text, source:row.source, createdAt:new Date(row.created_at) }
}

export function toProfile(row) {
  return { id:row.id, fullName:row.full_name, studentId:row.student_id,
    program:row.program, year:row.year, role:row.role }
}

export function toMessage(error) {
  if (error?.code === '23P01') return MESSAGES.taken
  if (error?.code === 'P0001' && error.message) return error.message
  if (error?.code === '23514') return 'That change is not allowed.'
  if (error?.code === '42501') return 'You do not have access to do that.'
  return 'Something went wrong. Try again.'
}

async function request(query) {
  let result
  try { result = await query } catch (error) { throw new Error(toMessage(error)) }
  if (result.error) throw new Error(toMessage(result.error))
  return result.data
}

export async function fetchCourts() {
  return request(supabase.from('courts').select('*').order('id'))
}

export async function fetchClosedDays() {
  const rows = await request(supabase.from('closed_days').select('*').order('date'))
  return Object.fromEntries(rows.map(row => [row.date, row.message]))
}

export async function fetchEquipment() {
  const rows = await request(supabase.from('equipment').select('*').order('id', { ascending:false }))
  return rows.map(row => ({ id:row.id, name:row.name, plural:row.plural, total:row.total, maxPerDay:row.max_per_day }))
}

export async function fetchBookings({ from, to }) {
  return (await request(supabase.from('bookings').select('*').gte('date', from).lte('date', to)
    .order('date').order('start_hour'))).map(toBooking)
}

export async function fetchMyBookings(userId) {
  return (await request(supabase.from('bookings').select('*').eq('user_id', userId)
    .order('date').order('start_hour'))).map(toBooking)
}

export async function createBooking({ courtId, date, start, end, purpose = null }) {
  return toBooking(await request(supabase.from('bookings').insert({
    court_id:courtId, date, start_hour:start, end_hour:end, purpose,
  }).select('*').single()))
}

export async function cancelBooking(id, { reason = null, note = null } = {}) {
  return toBooking(await request(supabase.from('bookings').update({
    status:'cancelled', cancel_reason:reason, cancel_note:note,
  }).eq('id', id).select('*').single()))
}

export async function fetchLoans({ userId, date } = {}) {
  let query = supabase.from('loans').select('*')
  if (userId) query = query.eq('user_id', userId)
  if (date) query = query.eq('date', date)
  return (await request(query.order('date'))).map(toLoan)
}

export async function fetchAvailability(date) {
  const rows = await request(supabase.rpc('equipment_available', { p_date:date }))
  return Object.fromEntries(rows.map(row => [row.id, row.free]))
}

export async function createLoan({ date, racket, balls }) {
  return toLoan(await request(supabase.from('loans').insert({ date, racket, balls }).select('*').single()))
}

export async function setLoanStatus(id, status) {
  return toLoan(await request(supabase.from('loans').update({ status }).eq('id', id).select('*').single()))
}

export async function updateCourt(id, { status, note }) {
  const { user } = await request(supabase.auth.getUser())
  const court = await request(supabase.from('courts').update({ status, note }).eq('id', id).select('*').single())
  await request(supabase.from('booking_events').insert({
    user_id:user.id, kind:status === 'open' ? 'court.opened' : 'court.closed', source:'App',
    text:status === 'open' ? `Reopened ${court.name}` : `Closed ${court.name}: ${court.note}`,
  }))
  return court
}

export async function fetchEvents({ userId, bookingId, limit = 50 } = {}) {
  let query = supabase.from('booking_events').select('*')
  if (userId) query = query.eq('user_id', userId)
  if (bookingId) query = query.eq('booking_id', bookingId)
  return (await request(query.order('created_at', { ascending:false }).limit(limit))).map(toEvent)
}

export async function fetchProfiles() {
  return (await request(supabase.from('profiles').select('*').order('full_name'))).map(toProfile)
}

export function subscribeEvents(onInsert) {
  const channel = supabase.channel('events').on('postgres_changes', {
    event:'INSERT', schema:'public', table:'booking_events',
  }, payload => onInsert(toEvent(payload.new))).subscribe()
  return () => supabase.removeChannel(channel)
}
