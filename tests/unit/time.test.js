import { bangkokParts, todayIso, slotInstant, addDays, weekdayIndex, mondayOf } from '../../src/lib/time.js'

test('device clock in UTC still yields Bangkok date', () => {
  expect(bangkokParts(new Date('2026-11-10T18:30:00Z'))).toEqual({ iso: '2026-11-11', hour: 1, minute: 30 })
})
test('slotInstant is UTC minus 7', () => {
  expect(slotInstant('2026-11-12', 18).toISOString()).toBe('2026-11-12T11:00:00.000Z')
})
test('addDays crosses months', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'))
test('mondayOf', () => expect(mondayOf('2026-11-10')).toBe('2026-11-09'))

test('Bangkok midnight and year rollover use UTC arithmetic', () => {
  expect(todayIso(new Date('2026-12-31T16:59:59Z'))).toBe('2026-12-31')
  expect(bangkokParts(new Date('2026-12-31T17:00:00Z')))
    .toEqual({ iso:'2027-01-01', hour:0, minute:0 })
  expect(slotInstant('2027-01-01', 0).toISOString()).toBe('2026-12-31T17:00:00.000Z')
  expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
})

test('week starts on Monday even for Sunday or Monday', () => {
  expect(weekdayIndex('2026-11-15')).toBe(0)
  expect(weekdayIndex('2026-11-16')).toBe(1)
  expect(mondayOf('2026-11-15')).toBe('2026-11-09')
  expect(mondayOf('2026-11-16')).toBe('2026-11-16')
})
