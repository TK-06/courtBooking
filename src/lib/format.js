import { addDays, bangkokParts, weekdayIndex } from './time.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const pad = n => String(n).padStart(2, '0')

function dateText(iso, long) {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1]
  const weekday = WEEKDAYS[weekdayIndex(iso)]
  return `${long ? weekday : weekday.slice(0, 3)} ${Number(iso.slice(8, 10))} ${long ? month : month.slice(0, 3)}`
}

export function hh(h) {
  return `${pad(h)}:00`
}

export function range(b) {
  return `${hh(b.start)}–${hh(b.end)}`
}

export function fmtDate(iso) {
  return dateText(iso, false)
}

export function fmtLong(iso) {
  return dateText(iso, true)
}

export function hoursText(n) {
  return `${n} ${n === 1 ? 'hour' : 'hours'}`
}

export function itemsText(loan) {
  const parts = []
  if (loan.racket) parts.push(`${loan.racket} ${loan.racket > 1 ? 'rackets' : 'racket'}`)
  if (loan.balls) parts.push(`${loan.balls} ${loan.balls > 1 ? 'cans of balls' : 'can of balls'}`)
  return parts.join(' and ')
}

export function fmtStamp(date, now) {
  const { iso, hour, minute } = bangkokParts(date)
  const today = bangkokParts(now).iso
  const time = `${pad(hour)}:${pad(minute)}`
  if (iso === today) return `Today, ${time}`
  if (iso === addDays(today, -1)) return `Yesterday, ${time}`
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)}, ${time}`
}

export function fmtRel(date, now) {
  const minutes = Math.round((now - date) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}
