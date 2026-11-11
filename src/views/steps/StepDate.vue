<script setup>
import { computed } from 'vue'
import { addDays, todayIso, weekdayIndex } from '../../lib/time.js'
import { fmtDate, fmtLong } from '../../lib/format.js'
import { dayStatus, MESSAGES, windowEnd } from '../../lib/rules.js'
const props = defineProps({
  date:String, role:{ type:String, default:'student' }, now:{ type:Date, default:() => new Date() },
  courts:{ type:Array, default:() => [] }, closedDays:{ type:Object, default:() => ({}) }, bookings:{ type:Array, default:() => [] },
})
const emit = defineEmits(['select', 'message'])
const today = computed(() => todayIso(props.now))
const admin = computed(() => props.role === 'admin')
const dows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const statusText = { open:'open', full:'fully booked', closed:'closed', past:'past', out:'not open for booking yet' }
const months = computed(() => {
  const start = new Date(`${today.value}T00:00:00Z`)
  const end = new Date(`${windowEnd(today.value, props.role)}T00:00:00Z`)
  const count = Math.max(2, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1)
  return Array.from({ length:count }, (_, k) => {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1))
    const iso = first.toISOString().slice(0,10)
    const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
    return {
      key:iso, label:fmtLong(iso).split(' ').slice(2).join(' ') + ' ' + first.getUTCFullYear(),
      offset:(weekdayIndex(iso) + 6) % 7,
      days:Array.from({ length }, (_, n) => {
        const date = addDays(iso, n)
        return { iso:date, n:n + 1, status:dayStatus({ ...props, date }) }
      }),
    }
  })
})
function pick(day) {
  if (day.status === 'past') return
  if (day.status === 'out') return emit('message', admin.value ? MESSAGES.windowAdmin : MESSAGES.windowStudent)
  if (day.status === 'closed') return emit('message', (props.closedDays[day.iso] || MESSAGES.dayClosed) + (admin.value ? ' Reopen it under Courts first.' : ''))
  if (day.status === 'full' && !admin.value) return emit('message', `Every hour on ${fmtDate(day.iso)} is taken. Try another day.`)
  emit('select', day.iso)
}
</script>
<template>
  <div class="step s1">
    <div class="legend"><span><i class="lg"></i>Open</span><span><i class="lg lg-sel"></i>Selected</span><span><i class="lg lg-full"></i>Full</span><span><i class="lg lg-closed"></i>Closed</span></div>
    <p class="muted center">{{ admin ? 'Club bookings can go up to 90 days ahead, at any length.' : 'You can book up to 14 days ahead.' }}</p>
    <div class="months">
      <div v-for="m in months" :key="m.key" class="month">
        <h2 class="month-name">{{ m.label }}</h2>
        <div class="dow"><span v-for="d in dows" :key="d">{{ d }}</span></div>
        <div class="days">
          <span v-for="n in m.offset" :key="'p' + n" class="day pad" aria-hidden="true"></span>
          <button v-for="d in m.days" :key="d.iso" class="day" :class="['s-' + d.status, { sel:date===d.iso, today:d.iso===today }]" :aria-label="fmtLong(d.iso) + ', ' + statusText[d.status]" :aria-pressed="date===d.iso" @click="pick(d)">{{ d.n }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
