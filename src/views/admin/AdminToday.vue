<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as api from '../../lib/api.js'
import { todayIso, slotInstant } from '../../lib/time.js'
import { fmtLong, fmtStamp as stamp, hh, itemsText } from '../../lib/format.js'
const now = ref(new Date())
const today = computed(() => todayIso(now.value))
const loading = ref(true), error = ref(false)
const profiles = ref([]), loans = ref([]), bookings = ref([]), events = ref([]), courts = ref([])
const member = id => profiles.value.find(m => m.id === id) || { fullName:'Unknown', studentId:'', program:'' }
const initials = name => name.split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('')
const fmtStamp = date => stamp(date, now.value)
const loanLabel = s => ({ reserved:'Reserved', out:'Picked up', returned:'Returned' })[s]
import { useRouter } from 'vue-router'
import { HOURS } from '../../lib/rules.js'
import Icon from '../../components/Icon.vue'
import LoadState from '../../components/LoadState.vue'
const router = useRouter()
const hours = HOURS, pad = h => String(h).padStart(2,'0')
const longToday = computed(() => fmtLong(today.value))
const go = name => router.push({name})
const startBooking = () => go('book')
const kindTail = kind => kind.split('.')[1]
const sortedEvents = computed(() => [...events.value].sort((a,b) => b.createdAt-a.createdAt).slice(0,6))
const todayLoans = computed(() => loans.value.filter(l => l.date === today.value))
const kpis = computed(() => {
  const active = bookings.value.filter(b => b.date === today.value && b.status !== 'cancelled')
  const open = courts.value.filter(c => c.status === 'open')
  const used = active.filter(b => open.some(c => c.id === b.courtId)).reduce((n,b) => n+b.end-b.start,0)
  return { bookings:active.length, use:open.length ? Math.round(used/(open.length*HOURS.length)*100) : 0, kit:loans.value.filter(l => l.status==='out').reduce((n,l) => n+l.racket+l.balls,0), open:open.length }
})
const schedule = computed(() => courts.value.map(c => ({...c,cells:HOURS.map(h => {
  if (c.status !== 'open') return {h,cls:'x',label:'',title:c.name+' closed'}
  const b = bookings.value.find(b => b.date===today.value && b.courtId===c.id && b.status!=='cancelled' && h>=b.start && h<b.end)
  const past = slotInstant(today.value,h+1)<=now.value
  return b ? {h,cls:'b'+(past?' past':''),label:b.purpose?'ITC':initials(member(b.userId).fullName),title:hh(h)+', '+(b.purpose?'Club booking':member(b.userId).fullName)} : {h,cls:past?'past':'',label:'',title:hh(h)+', free'}
})})))
async function load() {
  loading.value=true; error.value=false; now.value=new Date()
  try { [courts.value,bookings.value,profiles.value,loans.value,events.value] = await Promise.all([api.fetchCourts(),api.fetchBookings({from:today.value,to:today.value}),api.fetchProfiles(),api.fetchLoans(),api.fetchEvents({limit:6})]) }
  catch { error.value=true }
  finally { loading.value=false }
}
let clock
watch(today, load)
onMounted(() => { void load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onBeforeUnmount(() => clearInterval(clock))

</script>
<template>
<section class="screen">
  <div class="page-head"><div><p class="date-line">{{ longToday }}</p><h1 class="display h-lg">Today at the courts</h1></div><button class="btn primary small" @click="startBooking()"><icon name="plus" :size="18"></icon>Book for the club</button></div>
  <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load today's courts. Check your connection and try again." @retry="load">
  <div class="admin-content"><div class="kpis">
    <div class="kpi"><div class="v">{{ kpis.bookings }}</div><div class="l">Bookings today</div></div>
    <div class="kpi"><div class="v">{{ kpis.use }}<small>%</small></div><div class="l">Open court hours booked</div></div>
    <div class="kpi"><div class="v">{{ kpis.kit }}</div><div class="l">Items out on loan</div></div>
    <div class="kpi"><div class="v">{{ kpis.open }}<small>/{{ courts.length }}</small></div><div class="l">Courts open</div></div>
  </div>
  <div class="card">
    <div class="row-between"><h2 class="display h-sm">Today's schedule</h2><span class="muted sm">One cell per hour, 08:00–22:00</span></div>
    <p v-if="!courts.length" class="muted">No courts available.</p>
    <div v-else class="sched"><div class="sched-in">
      <div class="sched-row"><span></span><span v-for="h in hours" :key="h" class="sh">{{ pad(h) }}</span></div>
      <div v-for="r in schedule" :key="r.id" class="sched-row"><span class="sr-name">{{ r.name }}</span><span v-for="c in r.cells" :key="c.h" class="sc" :class="c.cls" :title="c.title">{{ c.label }}</span></div>
    </div></div>
    <div class="legend left" style="margin-top:12px"><span><i class="lg sq" style="background:var(--court);border-color:var(--court)"></i>Booked</span><span><i class="lg sq lg-booked"></i>Free</span><span><i class="lg sq lg-closed"></i>Closed</span></div>
  </div>
  <div class="two">
    <div class="card">
      <div class="row-between"><h2 class="display h-sm">Latest activity</h2><button class="linkbtn" @click="go('admin-members')">Full log</button></div>
      <ul class="timeline" style="margin-top:8px">
        <li v-for="e in sortedEvents.slice(0, 6)" :key="e.id"><span class="tl-dot" :class="kindTail(e.kind)"></span><div><p class="tl-text"><strong style="font-weight:500">{{ member(e.userId).fullName }}</strong>: {{ e.text }}</p><p class="muted sm">{{ fmtStamp(e.createdAt) }}, logged by {{ e.source }}</p></div></li>
        <li v-if="!sortedEvents.length"><span class="tl-dot"></span><div><p class="tl-text muted">No activity yet.</p></div></li>
      </ul>
    </div>
    <div class="card">
      <div class="row-between"><h2 class="display h-sm">Equipment today</h2><button class="linkbtn" @click="go('admin-equipment')">Manage</button></div>
      <ul class="timeline" style="margin-top:8px">
        <li v-for="l in todayLoans" :key="l.id"><span class="tl-dot" :class="l.status"></span><div><p class="tl-text">{{ member(l.userId).fullName }}: {{ itemsText(l) }}</p><p class="muted sm">{{ loanLabel(l.status) }}</p></div></li>
        <li v-if="!todayLoans.length"><span class="tl-dot"></span><div><p class="tl-text muted">No loans today.</p></div></li>
      </ul>
    </div>
  </div>
</div>
  </LoadState>
</section>
</template>
