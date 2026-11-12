import { beforeEach, expect, test, vi } from 'vitest'

const fake = vi.hoisted(() => ({ calls: [], result: { data: [], error: null } }))
vi.mock('../../src/lib/supabase.js', () => {
  const query = new Proxy({}, { get: (_, key) => key === 'then'
    ? (resolve, reject) => Promise.resolve(fake.result).then(resolve, reject)
    : (...args) => { fake.calls.push([key, ...args]); return query } })
  return { supabase: {
    from: (...args) => { fake.calls.push(['from', ...args]); return query },
    rpc: (...args) => { fake.calls.push(['rpc', ...args]); return query },
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin' } }, error: null })) },
    channel: vi.fn(() => ({ on: vi.fn(function (...args) { fake.listener = args[2]; return this }), subscribe: vi.fn(function () { return this }) })),
    removeChannel: vi.fn(),
  } }
})

import * as api from '../../src/lib/api.js'
import { supabase } from '../../src/lib/supabase.js'

const booking = { id:'x', code:'ITC-1112-0001', user_id:'u', court_id:1, date:'2026-11-12', start_hour:18, end_hour:19, status:'confirmed', purpose:null, cancel_reason:null, cancel_note:null, cancelled_by:null, created_at:'2026-11-09T14:04:00Z' }
beforeEach(() => { fake.calls = []; fake.result = { data: [], error: null }; vi.clearAllMocks() })

test('createBooking inserts snake_case row', async () => {
  fake.result.data = booking
  const result = await api.createBooking({ courtId:1, date:'2026-11-12', start:18, end:19, purpose:null })
  expect(fake.calls.find(c => c[0] === 'insert')[1]).toEqual({ court_id:1, date:'2026-11-12', start_hour:18, end_hour:19, purpose:null })
  expect(result).toEqual(api.toBooking(booking))
})
test('overlap maps to taken', () => expect(api.toMessage({ code:'23P01', message:'conflicting key value' })).toBe('Someone just took one of those hours. Pick again.'))
test('toBooking', () => {
  expect(api.toBooking(booking)).toEqual({ id:'x', code:'ITC-1112-0001', userId:'u', courtId:1, date:'2026-11-12', start:18, end:19, status:'confirmed', purpose:null, cancelReason:null, cancelNote:null, cancelledBy:null, createdAt:new Date(booking.created_at) })
})
test.each([
  [{ code:'P0001', message:'That court is closed.' }, 'That court is closed.'],
  [{ code:'23514', message:'internal constraint' }, 'That change is not allowed.'],
  [{ code:'42501', message:'internal policy' }, 'You do not have access to do that.'],
  [null, 'Something went wrong. Try again.'],
  [{ message:'internal failure' }, 'Something went wrong. Try again.'],
])('maps database error %j', (error, message) => expect(api.toMessage(error)).toBe(message))
test('maps loans, events, and nullable admin profiles', () => {
  expect(api.toLoan({ id:'l', user_id:'u', date:'2026-11-12', racket:1, balls:2, status:'reserved', created_at:booking.created_at })).toEqual({ id:'l', userId:'u', date:'2026-11-12', racket:1, balls:2, status:'reserved', createdAt:new Date(booking.created_at) })
  expect(api.toEvent({ id:1, booking_id:'x', loan_id:null, user_id:'u', kind:'booking.created', text:'Booked', source:'App', created_at:booking.created_at })).toEqual({ id:1, bookingId:'x', loanId:null, userId:'u', kind:'booking.created', text:'Booked', source:'App', createdAt:new Date(booking.created_at) })
  expect(api.toProfile({ id:'a', full_name:'Admin', student_id:null, program:null, year:null, role:'admin' })).toEqual({ id:'a', fullName:'Admin', studentId:null, faculty:null, program:null, year:null, role:'admin' })
})
test('toProfile maps faculty, and a row without one maps to null', () => {
  const row = { id:'u', full_name:'Napat', student_id:'6638012321', faculty:'Engineering', program:'ICE', year:3, role:'student' }
  expect(api.toProfile(row)).toEqual({ id:'u', fullName:'Napat', studentId:'6638012321', faculty:'Engineering', program:'ICE', year:3, role:'student' })
  const { faculty, ...withoutFaculty } = row
  expect(api.toProfile(withoutFaculty).faculty).toBeNull()
})
test('maps courts, closed days, equipment and RPC availability', async () => {
  fake.result.data = [{ id:1, name:'Court I', status:'open', note:'' }]
  expect(await api.fetchCourts()).toEqual(fake.result.data)
  fake.result.data = [{ date:'2026-11-22', message:'Closed' }]
  expect(await api.fetchClosedDays()).toEqual({ '2026-11-22':'Closed' })
  fake.result.data = [{ id:'racket', name:'Racket', plural:'Rackets', total:8, max_per_day:2 }]
  expect(await api.fetchEquipment()).toEqual([{ id:'racket', name:'Racket', plural:'Rackets', total:8, maxPerDay:2 }])
  fake.result.data = [{ id:'racket', free:3 }, { id:'balls', free:7 }]
  expect(await api.fetchAvailability('2026-11-12')).toEqual({ racket:3, balls:7 })
  expect(fake.calls).toContainEqual(['rpc', 'equipment_available', { p_date:'2026-11-12' }])
})
test('filters booking lists and maps rows', async () => {
  fake.result.data = [booking]
  expect(await api.fetchBookings({ from:'2026-11-10', to:'2026-11-24' })).toEqual([api.toBooking(booking)])
  expect(fake.calls).toContainEqual(['gte', 'date', '2026-11-10'])
  expect(fake.calls).toContainEqual(['lte', 'date', '2026-11-24'])
  await api.fetchMyBookings('u')
  expect(fake.calls).toContainEqual(['eq', 'user_id', 'u'])
})
test('cancellation sends only allowed columns', async () => {
  fake.result.data = booking
  await api.cancelBooking('x', { reason:'Weather', note:'Rain all evening.' })
  expect(fake.calls).toContainEqual(['update', { status:'cancelled', cancel_reason:'Weather', cancel_note:'Rain all evening.' }])
  expect(fake.calls).toContainEqual(['eq', 'id', 'x'])
})
test('loan calls use optional filters and allowed write columns', async () => {
  await api.fetchLoans({ userId:'u', date:'2026-11-12' })
  expect(fake.calls).toContainEqual(['eq', 'user_id', 'u'])
  expect(fake.calls).toContainEqual(['eq', 'date', '2026-11-12'])
  fake.result.data = { id:'l', created_at:booking.created_at }
  await api.createLoan({ date:'2026-11-12', racket:1, balls:0 })
  expect(fake.calls).toContainEqual(['insert', { date:'2026-11-12', racket:1, balls:0 }])
  await api.setLoanStatus('l', 'out')
  expect(fake.calls).toContainEqual(['update', { status:'out' }])
})
test('events and profiles return domain rows', async () => {
  await api.fetchEvents({ userId:'u', bookingId:'x', limit:12 })
  expect(fake.calls).toContainEqual(['eq', 'user_id', 'u'])
  expect(fake.calls).toContainEqual(['eq', 'booking_id', 'x'])
  expect(fake.calls).toContainEqual(['limit', 12])
  expect(fake.calls).toContainEqual(['order', 'created_at', { ascending:false }])
  fake.result.data = [{ id:'u', full_name:'Napat', role:'student' }]
  expect((await api.fetchProfiles())[0].fullName).toBe('Napat')
})
test.each(['open', 'closed'])('court %s update records the acting admin and App event', async status => {
  fake.result.data = { id:2, name:'Court II', status, note:'Resurfacing' }
  expect(await api.updateCourt(2, { status, note:'Resurfacing' })).toEqual(fake.result.data)
  expect(fake.calls).toContainEqual(['update', { status, note:'Resurfacing' }])
  expect(fake.calls).toContainEqual(['insert', { user_id:'admin', kind:status === 'open' ? 'court.opened' : 'court.closed', source:'App', text:status === 'open' ? 'Reopened Court II' : 'Closed Court II: Resurfacing' }])
})
test('query failures throw mapped Error objects', async () => {
  fake.result.error = { code:'23P01' }
  await expect(api.fetchCourts()).rejects.toThrow('Someone just took one of those hours. Pick again.')
})
test('realtime maps inserts and removes its channel on unsubscribe', () => {
  const callback = vi.fn()
  const unsubscribe = api.subscribeEvents(callback)
  fake.listener({ new:{ id:1, user_id:'u', created_at:booking.created_at } })
  expect(callback.mock.calls[0][0].createdAt).toBeInstanceOf(Date)
  unsubscribe()
  expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channel.mock.results[0].value)
})
