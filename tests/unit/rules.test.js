import {
  HOURS, CLOSE_HOUR, STUDENT_WINDOW_DAYS, ADMIN_WINDOW_DAYS,
  STUDENT_MAX_HOURS, CANCEL_CUTOFF_HOURS, LOAN_AHEAD_DAYS, HEAT_WEEKS,
  MESSAGES, msg, windowEnd, isFree, slotState, dayStatus, toggleSlot,
  statusOf, canCancel, validateAdminCancel, isChulaEmail, validateSignUp,
  validateLoan, buildHeatMap,
} from '../../src/lib/rules.js'

const now = new Date('2026-11-10T06:20:00Z')
const courts = [{id:1,status:'open'},{id:2,status:'closed'}]

test('window', () => {
  expect(windowEnd('2026-11-10', 'student')).toBe('2026-11-24')
  expect(windowEnd('2026-11-10', 'admin')).toBe('2027-02-08')
})
test('13:00 slot today is past at 13:20', () => expect(slotState({ date:'2026-11-10', courtId:1, hour:13, now, courts, closedDays:{}, bookings:[], userId:'u1', selected:[] })).toBe('past'))
test('closed court', () => expect(slotState({ date:'2026-11-12', courtId:2, hour:18, now, courts, closedDays:{}, bookings:[], userId:'u1', selected:[] })).toBe('closed'))
test('mine vs booked', () => {
  const bookings = [{ courtId:1, date:'2026-11-12', start:18, end:20, status:'confirmed', userId:'u1' }]
  expect(slotState({ date:'2026-11-12', courtId:1, hour:19, now, courts, closedDays:{}, bookings, userId:'u1', selected:[] })).toBe('mine')
  expect(slotState({ date:'2026-11-12', courtId:1, hour:19, now, courts, closedDays:{}, bookings, userId:'u2', selected:[] })).toBe('booked')
})
test('day status', () => {
  expect(dayStatus({ date:'2026-11-25', now, role:'student', courts, closedDays:{}, bookings:[] })).toBe('out')
  expect(dayStatus({ date:'2026-11-25', now, role:'admin', courts, closedDays:{}, bookings:[] })).toBe('open')
  expect(dayStatus({ date:'2026-11-22', now, role:'student', courts, closedDays:{'2026-11-22':'x'}, bookings:[] })).toBe('closed')
})
test('student cap and adjacency', () => {
  expect(toggleSlot({ slots:[18], hour:19, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([18,19])
  expect(toggleSlot({ slots:[18,19], hour:20, state:'open', role:'student', hoursUsed:0 }).message).toBe('You can book up to 2 hours a day.')
  expect(toggleSlot({ slots:[18], hour:20, state:'open', role:'student', hoursUsed:1 }).message).toBe('You can book up to 2 hours a day.')
  expect(toggleSlot({ slots:[18], hour:15, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([15])
})
test('admin any length, never over a booking', () => {
  expect(toggleSlot({ slots:[8,9,10], hour:11, state:'open', role:'admin', hoursUsed:0 }).slots).toEqual([8,9,10,11])
  expect(toggleSlot({ slots:[8], hour:9, state:'booked', role:'admin', hoursUsed:0 })).toEqual({ slots:[8], message:null, blocked:true })
  expect(toggleSlot({ slots:[8,9,10], hour:9, state:'selected', role:'admin', hoursUsed:0 }).slots).toEqual([9])
})
test('21:00 is the last start', () => expect(HOURS.at(-1)).toBe(21))
test('cancel cutoff boundary', () => {
  const b = { date:'2026-11-10', start:16, end:17, status:'confirmed' } // 16:00 Bangkok = 09:00Z
  expect(canCancel(b, new Date('2026-11-10T07:00:00Z'))).toBe(true)   // exactly 2h before
  expect(canCancel(b, new Date('2026-11-10T07:01:00Z'))).toBe(false)
})
test('admin cancel validation', () => {
  expect(validateAdminCancel({ reason:null, note:'short', ack1:false, ack2:false, memberFirst:'Napat' }))
    .toEqual({ reason:'Pick a reason.', note:'Write at least a sentence so Napat knows why.', ack:'Tick both boxes to confirm.' })
  expect(validateAdminCancel({ reason:'Weather', note:'Rain all evening, court is flooded.', ack1:true, ack2:false, memberFirst:null })).toEqual({})
})
test('chula email', () => {
  expect(isChulaEmail(' 6638012321@Student.Chula.ac.th ')).toBe(true)
  expect(isChulaEmail('me@gmail.com')).toBe(false)
})
test('heat map shape', () => {
  const cols = buildHeatMap({ bookings:[{ userId:'u1', date:'2026-11-05', start:18, end:20, status:'confirmed' }], userId:'u1', now, weeks:12 })
  expect(cols).toHaveLength(12)
  expect(cols.flatMap(c => c.days).find(d => d.iso === '2026-11-05').cls).toBe('h2')
  expect(cols.flatMap(c => c.days).find(d => d.iso === '2026-11-10').cls).toContain('today')
})

const slot = {
  date:'2026-11-12', courtId:1, hour:18, now, courts, closedDays:{},
  bookings:[], userId:'u1', selected:[],
}
const booking = {
  courtId:1, date:'2026-11-12', start:18, end:20, status:'confirmed', userId:'u1',
}

test('availability uses half-open booking hours and ignores cancellations', () => {
  expect(isFree({ ...slot, bookings:[booking] })).toBe(false)
  expect(isFree({ ...slot, hour:20, bookings:[booking] })).toBe(true)
  expect(isFree({ ...slot, bookings:[{ ...booking, status:'cancelled' }] })).toBe(true)
  expect(isFree({ ...slot, courtId:2 })).toBe(false)
  expect(isFree({ ...slot, courtId:99 })).toBe(false)
  expect(isFree({ ...slot, hour:22 })).toBe(false)
  expect(isFree({ ...slot, hour:7 })).toBe(false)
  expect(isFree({ ...slot, now:new Date('2026-11-12T11:00:00Z') })).toBe(false)
})

test('closed days override selections and block availability', () => {
  const closed = { ...slot, closedDays:{'2026-11-12':'University event'}, selected:[18] }
  expect(isFree(closed)).toBe(false)
  expect(slotState(closed)).toBe('closed')
  expect(slotState({ ...slot, selected:[18] })).toBe('selected')
  expect(slotState({ ...slot, selected:[18], bookings:[booking] })).toBe('mine')
  expect(slotState({ ...slot, bookings:[{ ...booking, status:'cancelled' }] })).toBe('open')
})

test('calendar includes the window end and distinguishes past, full and closed days', () => {
  const day = { date:'2026-11-24', now, role:'student', courts, closedDays:{}, bookings:[] }
  expect(dayStatus(day)).toBe('open')
  expect(dayStatus({ ...day, date:'2026-11-09' })).toBe('past')
  expect(dayStatus({ ...day, courts:[{id:1,status:'closed'}] })).toBe('closed')
  expect(dayStatus({ ...day, bookings:[{ ...booking, date:day.date, start:8, end:22 }] })).toBe('full')
  expect(dayStatus({ ...day, date:'2026-11-10', now:new Date('2026-11-10T14:00:00Z') })).toBe('full')
})

test('student selection can remove hours without mutating its input', () => {
  const slots = Object.freeze([18,19])
  expect(toggleSlot({ slots, hour:18, state:'selected', role:'student', hoursUsed:0 }))
    .toEqual({ slots:[19], message:null, blocked:false })
  expect(slots).toEqual([18,19])
  expect(toggleSlot({ slots:[], hour:18, state:'open', role:'student', hoursUsed:2 }))
    .toEqual({ slots:[], message:'You can book up to 2 hours a day.', blocked:false })
  expect(toggleSlot({ slots:[20], hour:21, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([20,21])
  expect(toggleSlot({ slots:[21], hour:22, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([21])
})

test('admin trims both ends, extends backwards, replaces gaps and never mutates input', () => {
  const slots = Object.freeze([8,9,10])
  const select = (hour, state = 'selected') => toggleSlot({ slots, hour, state, role:'admin', hoursUsed:0 })
  expect(select(8).slots).toEqual([9,10])
  expect(select(10).slots).toEqual([8,9])
  expect(select(15, 'open').slots).toEqual([15])
  expect(select(9, 'mine')).toEqual({ slots:[8,9,10], message:null, blocked:true })
  expect(toggleSlot({ slots:[9,10], hour:8, state:'open', role:'admin', hoursUsed:0 }).slots).toEqual([8,9,10])
  expect(toggleSlot({ slots:[21], hour:22, state:'open', role:'admin', hoursUsed:0 }).slots).toEqual([21])
  expect(select(11, 'past').slots).toEqual([8,9,10])
})

test('booking status changes at exact start and end instants', () => {
  expect(statusOf(booking, new Date('2026-11-12T10:59:59Z'))).toBe('upcoming')
  expect(statusOf(booking, new Date('2026-11-12T11:00:00Z'))).toBe('live')
  expect(statusOf(booking, new Date('2026-11-12T13:00:00Z'))).toBe('played')
  expect(statusOf({ ...booking, status:'cancelled' }, now)).toBe('cancelled')
  expect(canCancel({ ...booking, status:'cancelled' }, now)).toBe(false)
  expect(canCancel(booking, new Date('2026-11-12T11:00:00Z'))).toBe(false)
})

test('admin notes are trimmed before the 15-character boundary and acknowledgements differ', () => {
  expect(validateAdminCancel({ reason:'Weather', note:'  12345678901234  ', ack1:true, ack2:true, memberFirst:null }))
    .toEqual({ note:'Write at least a sentence for the log.' })
  expect(validateAdminCancel({ reason:'Weather', note:'123456789012345', ack1:true, ack2:false, memberFirst:'Napat' }))
    .toEqual({ ack:'Tick both boxes to confirm.' })
  expect(validateAdminCancel({ reason:'Weather', note:'123456789012345', ack1:false, ack2:false, memberFirst:null }))
    .toEqual({ ack:'Tick the box to confirm.' })
})

test('message templates substitute all supported variables', () => {
  expect(msg('noteMember', { first:'Napat' })).toBe('Write at least a sentence so Napat knows why.')
  expect(msg('loanMax', { plural:'rackets' })).toBe('Up to 2 rackets a day.')
  expect(msg('loanFree', { n:0 })).toBe('Only 0 free that day.')
  expect(msg('loanDup', { date:'Thu 12 Nov' })).toBe('You already have equipment reserved for Thu 12 Nov.')
})

test('signup follows prototype field validation and sign-in skips name and ID', () => {
  const form = { fullName:' Napat ', studentId:' 6638012321 ', email:' Napat@Student.Chula.ac.th ', password:'12345678', mode:'up' }
  expect(validateSignUp(form)).toBe(null)
  expect(validateSignUp({ ...form, fullName:' ' })).toBe('Enter your full name and your 10-digit student ID.')
  expect(validateSignUp({ ...form, studentId:'123' })).toBe('Enter your full name and your 10-digit student ID.')
  expect(validateSignUp({ ...form, email:'me@gmail.com' })).toBe(MESSAGES.email)
  expect(validateSignUp({ ...form, password:'short' })).toBe('Your password needs at least 8 characters.')
  expect(validateSignUp({ ...form, fullName:'', studentId:'', mode:'in' })).toBe(null)
  expect(validateSignUp({ ...form, mode:'signup', fullName:'' })).toBe('Enter your full name and your 10-digit student ID.')
  expect(isChulaEmail('x@@student.chula.ac.th')).toBe(false)
  expect(isChulaEmail('x@student.chula.ac.th.evil.com')).toBe(false)
})

test('loan validation checks empty selection, per-item caps, availability and duplicate date', () => {
  const loan = {
    racket:1, balls:1, date:'2026-11-12', hasLoanThatDay:false,
    equipment:[{id:'racket',plural:'Rackets',max:2},{id:'balls',plural:'Cans of balls',max:2}],
    free:{racket:8,balls:12},
  }
  expect(validateLoan(loan)).toBe(null)
  expect(validateLoan({ ...loan, racket:0, balls:0 })).toBe('Choose a racket or a can of balls first.')
  expect(validateLoan({ ...loan, racket:3 })).toBe('Up to 2 rackets a day.')
  expect(validateLoan({ ...loan, balls:3 })).toBe('Up to 2 cans of balls a day.')
  expect(validateLoan({ ...loan, free:{racket:0,balls:12} })).toBe('Only 0 free that day.')
  expect(validateLoan({ ...loan, hasLoanThatDay:true })).toBe('You already have equipment reserved for Thu 12 Nov.')
  expect(validateLoan({ ...loan, racket:2, balls:2, equipment:loan.equipment.map(({ max, ...item }) => ({ ...item, maxPerDay:max })) })).toBe(null)
})

test('heat map uses Bangkok weeks, sums played hours and filters other users and cancellations', () => {
  const cols = buildHeatMap({ userId:'u1', now, weeks:2, bookings:[
    { ...booking, date:'2026-11-05', start:8, end:9 },
    { ...booking, date:'2026-11-05', start:9, end:10 },
    { ...booking, date:'2026-11-06', start:8, end:9 },
    { ...booking, date:'2026-11-07', status:'cancelled' },
    { ...booking, date:'2026-11-08', userId:'u2' },
    { ...booking, date:'2026-11-11' },
  ] })
  expect(cols[0].key).toBe('2026-11-02')
  expect(cols[0].month).toBe('Nov')
  expect(cols[1].month).toBe('')
  expect(cols.every(c => c.days.length === 7)).toBe(true)
  const days = cols.flatMap(c => c.days)
  expect(days.find(d => d.iso === '2026-11-05')).toEqual({ iso:'2026-11-05', cls:'h2', title:'Thu 5 Nov, 2 hours played' })
  expect(days.find(d => d.iso === '2026-11-06').cls).toBe('h1')
  expect(days.find(d => d.iso === '2026-11-07').title).toBe('Sat 7 Nov, no game')
  expect(days.find(d => d.iso === '2026-11-08').cls).toBe('')
  expect(days.find(d => d.iso === '2026-11-11')).toEqual({ iso:'2026-11-11', cls:'up', title:'Wed 11 Nov, 2 hours booked' })
  expect(days.find(d => d.iso === '2026-11-12').cls).toBe('fut')
  const midnight = buildHeatMap({ bookings:[], userId:'u1', now:new Date('2026-11-15T17:01:00Z'), weeks:1 })
  expect(midnight[0].key).toBe('2026-11-16')
  expect(midnight[0].days[0].cls).toContain('today')
})
