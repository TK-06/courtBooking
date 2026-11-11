import { hh, range, fmtDate, fmtLong, hoursText, itemsText, fmtStamp, fmtRel } from '../../src/lib/format.js'

test('formats', () => {
  expect(fmtDate('2026-11-12')).toBe('Thu 12 Nov')
  expect(fmtLong('2026-11-12')).toBe('Thursday 12 November')
  expect(range({ start: 18, end: 20 })).toBe('18:00–20:00')
  expect(itemsText({ racket: 1, balls: 2 })).toBe('1 racket and 2 cans of balls')
  const now = new Date('2026-11-10T06:20:00Z') // 13:20 Bangkok
  expect(fmtStamp(new Date('2026-11-10T06:21:00Z'), now)).toBe('Today, 13:21')
  expect(fmtStamp(new Date('2026-11-09T14:04:00Z'), now)).toBe('Yesterday, 21:04')
})

test('hour and equipment labels handle singular, plural and empty loans', () => {
  expect(hh(8)).toBe('08:00')
  expect(hh(22)).toBe('22:00')
  expect(hoursText(1)).toBe('1 hour')
  expect(hoursText(2)).toBe('2 hours')
  expect(itemsText({ racket:2, balls:0 })).toBe('2 rackets')
  expect(itemsText({ racket:0, balls:1 })).toBe('1 can of balls')
  expect(itemsText({ racket:0, balls:0 })).toBe('')
})

test('timestamps compare calendar dates in Bangkok across midnight', () => {
  const now = new Date('2026-11-10T17:01:00Z')
  expect(fmtStamp(new Date('2026-11-10T17:00:00Z'), now)).toBe('Today, 00:00')
  expect(fmtStamp(new Date('2026-11-10T16:59:00Z'), now)).toBe('Yesterday, 23:59')
  expect(fmtStamp(new Date('2026-11-09T14:04:00Z'), now)).toBe('9 Nov, 21:04')
})

test.each([
  ['2026-11-10T06:20:00Z', 'Just now'],
  ['2026-11-10T06:21:00Z', 'Just now'],
  ['2026-11-10T06:15:00Z', '5 min ago'],
  ['2026-11-10T03:20:00Z', '3 h ago'],
  ['2026-11-09T06:20:00Z', 'Yesterday'],
  ['2026-11-06T06:20:00Z', '4 days ago'],
])('relative time for %s is %s', (date, expected) => {
  expect(fmtRel(new Date(date), new Date('2026-11-10T06:20:00Z'))).toBe(expected)
})
