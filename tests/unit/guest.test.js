import { expect, test } from 'vitest'
import {
  GUEST_WEEK_HOURS, MESSAGES, toggleSlot, weekHoursUsed, validateGuestSignUp,
} from '../../src/lib/rules.js'

test('guests get 1 hour a week', () => {
  expect(GUEST_WEEK_HOURS).toBe(1)
  expect(MESSAGES.guestWeek).toBe('Guests can book 1 hour a week.')
})

test('weekHoursUsed counts my confirmed hours Monday to Sunday of that week', () => {
  const bookings = [
    { userId:'g', date:'2026-11-23', start:9, end:10, status:'confirmed' }, // Mon same week
    { userId:'g', date:'2026-11-29', start:9, end:10, status:'confirmed' }, // Sun same week
    { userId:'g', date:'2026-11-25', start:9, end:10, status:'cancelled' }, // cancelled
    { userId:'x', date:'2026-11-25', start:9, end:10, status:'confirmed' }, // someone else
    { userId:'g', date:'2026-11-30', start:9, end:10, status:'confirmed' }, // next Monday
    { userId:'g', date:'2026-11-22', start:9, end:10, status:'confirmed' }, // previous Sunday
  ]
  expect(weekHoursUsed({ bookings, userId:'g', date:'2026-11-26' })).toBe(2)
  expect(weekHoursUsed({ bookings, userId:'g', date:'2026-12-01' })).toBe(1)
  expect(weekHoursUsed({ bookings:[], userId:'g', date:'2026-11-26' })).toBe(0)
})

test('a guest can pick one hour and no more', () => {
  expect(toggleSlot({ slots:[], hour:18, state:'open', role:'guest', hoursUsed:0 }).slots).toEqual([18])
  expect(toggleSlot({ slots:[18], hour:19, state:'open', role:'guest', hoursUsed:0 }))
    .toEqual({ slots:[18], message:MESSAGES.guestWeek, blocked:false })
  expect(toggleSlot({ slots:[], hour:18, state:'open', role:'guest', hoursUsed:1 }))
    .toEqual({ slots:[], message:MESSAGES.guestWeek, blocked:false })
  expect(toggleSlot({ slots:[18], hour:18, state:'selected', role:'guest', hoursUsed:0 }).slots).toEqual([])
  // Students keep 2 hours a day.
  expect(toggleSlot({ slots:[18], hour:19, state:'open', role:'student', hoursUsed:0 }).slots).toEqual([18, 19])
})

test('guest sign-up needs a name, any valid email and an 8-character password', () => {
  const form = { fullName:' Jane Recruiter ', email:' jane@company.com ', password:'12345678' }
  expect(validateGuestSignUp(form)).toBe(null)
  expect(validateGuestSignUp({ ...form, fullName:'  ' })).toBe(MESSAGES.guestName)
  for (const bad of ['', 'jane', 'jane@', 'jane@company']) {
    expect(validateGuestSignUp({ ...form, email:bad })).toBe(MESSAGES.emailFormat)
  }
  expect(validateGuestSignUp({ ...form, password:'short' })).toBe(MESSAGES.password)
  expect(MESSAGES.guestName).toBe('Enter your name.')
})

test('a Chula address on the guest form is sent to the student form instead', () => {
  const form = { fullName:'Napat', email:'6638012321@student.chula.ac.th', password:'12345678' }
  expect(validateGuestSignUp(form)).toBe(MESSAGES.guestChula)
  expect(MESSAGES.guestChula).toBe('Chula students: choose Chula student above.')
})
