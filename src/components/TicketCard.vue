<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { addDays, todayIso } from '../lib/time.js'
import { fmtDate, fmtLong, hoursText, range } from '../lib/format.js'
import Icon from './Icon.vue'
const props = defineProps({ booking:{ type:Object, required:true }, label:{ type:String, default:'Next booking' }, menu:Boolean })
const emit = defineEmits(['open', 'cancel'])
const menuOpen = ref(false)
const root = ref(null)
const now = ref(new Date())
const timer = setInterval(() => { now.value = new Date() }, 30000)
const relativeDay = computed(() => {
  const today = todayIso(now.value)
  if (props.booking.date === today) return 'today'
  if (props.booking.date === addDays(today, 1)) return 'tomorrow'
  return 'in ' + Math.round((new Date(props.booking.date + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000) + ' days'
})
function open() { menuOpen.value = false; emit('open', props.booking.id) }
function cancel() { menuOpen.value = false; emit('cancel', props.booking.id) }
function dismiss(event) {
  if (event.type === 'keydown' && event.key === 'Escape') menuOpen.value = false
  if (event.type === 'click' && !root.value.contains(event.target)) menuOpen.value = false
}
onMounted(() => { document.addEventListener('click', dismiss); document.addEventListener('keydown', dismiss) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('click', dismiss); document.removeEventListener('keydown', dismiss) })
</script>
<template>
  <div ref="root" class="ticket lift" role="button" tabindex="0" aria-label="Open your next booking" @click="open" @keydown.enter.self="open" @keydown.space.self.prevent="open">
    <div class="ticket-top">
      <p class="label">{{ label }}</p>
      <button v-if="menu" class="icon-btn" aria-label="Booking options" aria-haspopup="menu" :aria-expanded="menuOpen" @click.stop="menuOpen=!menuOpen"><icon name="dots" /></button>
      <div v-if="menu && menuOpen" class="menu" role="menu" @click.stop>
        <button role="menuitem" @click="open"><icon name="ticket" :size="18" />View details</button>
        <button role="menuitem" class="danger" @click="cancel"><icon name="x" :size="18" />Cancel booking</button>
      </div>
    </div>
    <div class="ticket-body">
      <div class="t-date"><span class="t-day">{{ Number(booking.date.slice(8)) }}</span><span class="t-mon">{{ fmtDate(booking.date).split(' ')[2] }}</span></div>
      <div class="t-info"><p class="t-title">{{ fmtLong(booking.date).split(' ')[0] }}, {{ range(booking) }}</p><p class="t-sub">{{ booking.courtId===1 ? 'Court I' : 'Court II' }}, {{ hoursText(booking.end-booking.start) }}, {{ relativeDay }}</p></div>
    </div>
    <div class="ticket-foot"><span class="code">{{ booking.code }}</span><span class="t-link">View details<icon name="right" :size="16" /></span></div>
  </div>
</template>
