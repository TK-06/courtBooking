import { addDays, mondayOf, slotInstant, todayIso } from './time.js'
import { fmtDate, hoursText } from './format.js'

export const CLOSE_HOUR = 22
export const HOURS = Object.freeze(Array.from({ length:CLOSE_HOUR - 8 }, (_, i) => i + 8))
export const STUDENT_WINDOW_DAYS = 14
export const ADMIN_WINDOW_DAYS = 90
export const STUDENT_MAX_HOURS = 2
export const CANCEL_CUTOFF_HOURS = 2
export const LOAN_AHEAD_DAYS = 6
export const HEAT_WEEKS = 12

export const MESSAGES = Object.freeze({
  past: 'That hour has already started.',
  windowStudent: 'You can book up to 14 days ahead.',
  windowAdmin: 'Club bookings can go up to 90 days ahead.',
  maxHours: 'You can book up to 2 hours a day.',
  adjacent: 'Hours on the same day have to be back to back.',
  courtClosed: 'That court is closed.',
  dayClosed: 'The courts are closed that day.',
  taken: 'Someone just took one of those hours. Pick again.',
  cutoff: 'Cancelling closed 2 hours before the start time.',
  purpose: 'Add a short title, such as Club training or Inter-faculty match.',
  reason: 'Pick a reason.',
  noteMember: 'Write at least a sentence so {first} knows why.',
  noteClub: 'Write at least a sentence for the log.',
  ackBoth: 'Tick both boxes to confirm.',
  ackOne: 'Tick the box to confirm.',
  email: 'Use your Chula student email, the one ending in @student.chula.ac.th.',
  loanNone: 'Choose a racket or a can of balls first.',
  loanMax: 'Up to 2 {plural} a day.',
  loanFree: 'Only {n} free that day.',
  loanDup: 'You already have equipment reserved for {date}.',
  // Additional validation copy from the prototype, kept in the same table.
  mine: 'You already have this hour.',
  nameAndId: 'Enter your full name and your 10-digit student ID.',
  password: 'Your password needs at least 8 characters.',
})

export function msg(key, vars = {}) {
  return MESSAGES[key].replace(/\{(\w+)\}/g, (placeholder, name) => vars[name] ?? placeholder)
}

export function windowEnd(today, role) {
  return addDays(today, role === 'admin' ? ADMIN_WINDOW_DAYS : STUDENT_WINDOW_DAYS)
}

function bookingAt({ date, courtId, hour, bookings }) {
  return bookings.find(b => b.date === date && b.courtId === courtId &&
    b.status !== 'cancelled' && hour >= b.start && hour < b.end)
}

export function isFree({ date, courtId, hour, now, courts, closedDays, bookings }) {
  const court = courts.find(c => c.id === courtId)
  if (!HOURS.includes(hour) || !court || court.status !== 'open' || Object.hasOwn(closedDays, date)) return false
  if (slotInstant(date, hour) <= now) return false
  return !bookingAt({ date, courtId, hour, bookings })
}

export function slotState({ date, courtId, hour, now, courts, closedDays, bookings, userId, selected }) {
  const court = courts.find(c => c.id === courtId)
  if (!HOURS.includes(hour) || !court || court.status !== 'open' || Object.hasOwn(closedDays, date)) return 'closed'
  if (slotInstant(date, hour) <= now) return 'past'
  const booking = bookingAt({ date, courtId, hour, bookings })
  if (booking) return booking.userId === userId ? 'mine' : 'booked'
  return selected.includes(hour) ? 'selected' : 'open'
}

export function dayStatus({ date, now, role, courts, closedDays, bookings }) {
  const today = todayIso(now)
  if (date < today) return 'past'
  if (date > windowEnd(today, role)) return 'out'
  if (Object.hasOwn(closedDays, date) || !courts.some(c => c.status === 'open')) return 'closed'
  const hasFreeHour = courts.some(c => HOURS.some(hour =>
    isFree({ date, courtId:c.id, hour, now, courts, closedDays, bookings })))
  return hasFreeHour ? 'open' : 'full'
}

export function toggleSlot({ slots, hour, state, role, hoursUsed }) {
  const next = [...slots].sort((a, b) => a - b)
  const result = (selection = next, message = null, blocked = false) => ({ slots:selection, message, blocked })
  if (!HOURS.includes(hour)) return result()
  if (role === 'admin' && (state === 'booked' || state === 'mine')) return result(next, null, true)
  if (role !== 'admin' && state === 'mine') return result(next, msg('mine'))
  if (state !== 'open' && state !== 'selected') return result()

  const index = next.indexOf(hour)
  if (role === 'admin') {
    if (index !== -1) {
      if (index === 0 || index === next.length - 1) return result(next.filter(h => h !== hour))
      return result([hour])
    }
    if (next.length && (hour === next[0] - 1 || hour === next.at(-1) + 1)) {
      return result([...next, hour].sort((a, b) => a - b))
    }
    return result([hour])
  }

  if (index !== -1) return result(next.filter(h => h !== hour))
  const cap = STUDENT_MAX_HOURS - hoursUsed
  if (cap <= 0 || next.length >= cap) return result(next, msg('maxHours'))
  if (!next.length) return result([hour])
  if (Math.abs(next[0] - hour) === 1) return result([...next, hour].sort((a, b) => a - b))
  return result([hour])
}

export function statusOf(booking, now) {
  if (booking.status === 'cancelled') return 'cancelled'
  if (slotInstant(booking.date, booking.end) <= now) return 'played'
  if (slotInstant(booking.date, booking.start) <= now) return 'live'
  return 'upcoming'
}

export function canCancel(booking, now) {
  return statusOf(booking, now) === 'upcoming' &&
    slotInstant(booking.date, booking.start) - now >= CANCEL_CUTOFF_HOURS * 3600000
}

export function validateAdminCancel({ reason, note, ack1, ack2, memberFirst }) {
  const errors = {}
  if (!reason?.trim()) errors.reason = msg('reason')
  if ((note || '').trim().length < 15) {
    errors.note = memberFirst ? msg('noteMember', { first:memberFirst }) : msg('noteClub')
  }
  if (!ack1 || (memberFirst && !ack2)) errors.ack = msg(memberFirst ? 'ackBoth' : 'ackOne')
  return errors
}

export function isChulaEmail(raw) {
  return /^[^@\s]+@student\.chula\.ac\.th$/.test(raw.trim().toLowerCase())
}

export function validateSignUp({ fullName, studentId, email, password, mode }) {
  // The prototype calls the create-account tab "up"; "signup" is its descriptive alias.
  if ((mode === 'up' || mode === 'signup') && (!fullName.trim() || !/^\d{10}$/.test(studentId.trim()))) {
    return msg('nameAndId')
  }
  if (!isChulaEmail(email)) return msg('email')
  if (password.length < 8) return msg('password')
  return null
}

export function validateLoan({ racket, balls, equipment, free, hasLoanThatDay, date }) {
  if (!racket && !balls) return msg('loanNone')
  const quantities = { racket, balls }
  for (const item of equipment) {
    // Accept the prototype's `max` and the domain's camelCase `maxPerDay`.
    if (quantities[item.id] > (item.maxPerDay ?? item.max)) {
      return msg('loanMax', { plural:item.plural.toLowerCase() })
    }
    if (quantities[item.id] > free[item.id]) return msg('loanFree', { n:free[item.id] })
  }
  if (hasLoanThatDay) return msg('loanDup', { date:fmtDate(date) })
  return null
}

export function buildHeatMap({ bookings, userId, now, weeks = HEAT_WEEKS }) {
  const today = todayIso(now)
  const start = addDays(mondayOf(today), -7 * (weeks - 1))
  const played = {}
  const booked = {}
  for (const booking of bookings) {
    if (booking.userId !== userId) continue
    const status = statusOf(booking, now)
    const hours = booking.end - booking.start
    if (status === 'played') played[booking.date] = (played[booking.date] || 0) + hours
    if (status === 'upcoming' || status === 'live') booked[booking.date] = (booked[booking.date] || 0) + hours
  }

  const columns = []
  let lastMonth = ''
  for (let week = 0; week < weeks; week++) {
    const key = addDays(start, 7 * week)
    const days = []
    for (let day = 0; day < 7; day++) {
      const iso = addDays(key, day)
      const hours = played[iso] || 0
      const upcoming = booked[iso] || 0
      let cls = hours >= 2 ? 'h2' : hours === 1 ? 'h1' : ''
      if (iso > today) cls = upcoming ? 'up' : 'fut'
      if (iso === today) cls += ' today'
      const detail = hours ? `, ${hoursText(hours)} played`
        : upcoming ? `, ${hoursText(upcoming)} booked` : iso > today ? '' : ', no game'
      days.push({ iso, cls, title:fmtDate(iso) + detail })
    }
    const month = key.slice(0, 7)
    columns.push({ key, month:month !== lastMonth ? fmtDate(key).slice(-3) : '', days })
    lastMonth = month
  }
  return columns
}
