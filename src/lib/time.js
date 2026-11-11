const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const BANGKOK_OFFSET_MS = 7 * HOUR_MS

function calendarDate(iso) {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function bangkokParts(now) {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS)
  return {
    iso: local.toISOString().slice(0, 10),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  }
}

export function todayIso(now) {
  return bangkokParts(now).iso
}

export function addDays(iso, n) {
  return new Date(calendarDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

export function weekdayIndex(iso) {
  return calendarDate(iso).getUTCDay()
}

export function slotInstant(iso, hour) {
  return new Date(calendarDate(iso).getTime() + hour * HOUR_MS - BANGKOK_OFFSET_MS)
}

export function mondayOf(iso) {
  return addDays(iso, -((weekdayIndex(iso) + 6) % 7))
}
