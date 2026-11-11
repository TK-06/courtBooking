<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import { cancelBooking, fetchBookings, fetchCourts, fetchEvents, fetchMyBookings, fetchProfiles, subscribeEvents } from '../lib/api.js'
import { CANCEL_CUTOFF_HOURS, MESSAGES, canCancel, statusOf } from '../lib/rules.js'
import { bangkokParts, slotInstant } from '../lib/time.js'
import { fmtDate, fmtLong, fmtStamp, hh, hoursText, range } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import ClubLogo from '../components/ClubLogo.vue'
import CancelSheet from '../components/CancelSheet.vue'
import LoadState from '../components/LoadState.vue'
const route = useRoute()
const router = useRouter()
const { profile, session, mode, isAdmin } = useAuth()
const { show } = useToast()
const admin = computed(() => mode.value==='admin' && isAdmin.value)
const userId = computed(() => session.value?.user.id || profile.value?.id)
const booking = ref(null), courts = ref([]), profiles = ref([]), events = ref([])
const loading = ref(true), error = ref(false), sheet = ref(false), busy = ref(false), now = ref(new Date())
let revision = 0
const timer = setInterval(() => { now.value = new Date() }, 30000)
// Subscribe before fetching so an insert arriving during the request is retained.
const unsubscribe = subscribeEvents(event => {
  if (event.bookingId === route.params.id && !events.value.some(e => e.id === event.id)) events.value.push(event)
})
onUnmounted(() => { clearInterval(timer); unsubscribe(); revision++ })
async function load() {
  const current = ++revision
  const id = route.params.id
  loading.value = true; error.value = false; sheet.value = false; booking.value = null; events.value = []
  try {
    // The existing API has no fetch-by-id helper; use its permitted list query.
    const [bs, cs, es, ps] = await Promise.all([
      admin.value ? fetchBookings({ from:'0001-01-01', to:'9999-12-31' }) : fetchMyBookings(userId.value),
      fetchCourts(), fetchEvents({ bookingId:id }), admin.value ? fetchProfiles() : Promise.resolve(profile.value ? [profile.value] : []),
    ])
    if (current !== revision) return
    booking.value = bs.find(b => b.id === id && (admin.value || b.userId === userId.value)) || null
    courts.value = cs; profiles.value = ps
    events.value = [...new Map([...es, ...events.value].filter(e => e.bookingId === id).map(e => [e.id, e])).values()]
  } catch { if (current === revision) error.value = true }
  finally { if (current === revision) loading.value = false }
}
watch([() => route.params.id, admin, userId], load, { immediate:true })
const member = computed(() => profiles.value.find(p => p.id === booking.value?.userId) || { fullName:'Unknown', studentId:'' })
const first = computed(() => member.value.fullName.split(' ')[0])
const courtName = computed(() => courts.value.find(c => c.id === booking.value?.courtId)?.name || '')
const status = computed(() => booking.value ? statusOf(booking.value, now.value) : '')
const statusText = computed(() => ({ upcoming:'Confirmed', live:'On court now', played:'Played', cancelled:'Cancelled' })[status.value])
const statusChip = computed(() => ({ upcoming:'ok', live:'warn', played:'muted', cancelled:'crimson' })[status.value])
const cancellable = computed(() => booking.value && booking.value.userId === userId.value && canCancel(booking.value, now.value))
const history = computed(() => [...events.value].sort((a,b) => a.createdAt-b.createdAt))
const cutoff = computed(() => {
  const instant = new Date(slotInstant(booking.value.date, booking.value.start).getTime() - CANCEL_CUTOFF_HOURS*3600000)
  const parts = bangkokParts(instant)
  return fmtDate(parts.iso) + ', ' + hh(parts.hour)
})
const openInBookings = () => router.push({ name:'admin-bookings', query:{ q:booking.value.code, tab:'upcoming' } })
function openCancel() {
  if (admin.value) return openInBookings()
  now.value = new Date()
  if (!cancellable.value) return show(MESSAGES.cutoff)
  sheet.value = true
}
async function confirmCancel({ reason }) {
  if (busy.value || !booking.value) return
  if (admin.value) { sheet.value = false; return openInBookings() }
  now.value = new Date()
  if (!cancellable.value) { sheet.value = false; return show(MESSAGES.cutoff) }
  busy.value = true
  const current = revision
  try {
    const cancelled = await cancelBooking(booking.value.id, { reason })
    if (current !== revision) return
    booking.value = cancelled; sheet.value = false
    show('Booking cancelled. The hour is free again.')
  } catch (cause) { show(cause.message) }
  finally { busy.value = false }
}
</script>
<template>
  <section class="screen">
    <button class="back" @click="router.push({ name:admin ? 'admin-bookings' : 'bookings' })"><icon name="left" :size="18" />{{ admin ? 'All bookings' : 'My bookings' }}</button>
    <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load this booking. Check your connection and try again." @retry="load">
    <div v-if="!booking" class="empty"><p class="display h-sm">Booking not found.</p></div>
    <div v-else class="detail-grid">
      <div class="detail-col">
        <div class="detail-head"><h1 class="display h-lg">{{ fmtLong(booking.date) }}</h1><span class="chip" :class="statusChip">{{ statusText }}</span></div>
        <div class="ticket">
          <div class="ticket-body" style="padding-top:18px">
            <div class="t-date"><span class="t-day">{{ Number(booking.date.slice(8)) }}</span><span class="t-mon">{{ fmtDate(booking.date).split(' ')[2] }}</span></div>
            <div class="t-info"><p class="t-title">{{ range(booking) }}</p><p class="t-sub">{{ courtName }}, {{ hoursText(booking.end-booking.start) }}</p></div>
          </div>
          <dl class="dl" style="border-top:1px solid var(--rule);padding-top:16px">
            <div v-if="booking.purpose" class="wide"><dt class="label">Booked by</dt><dd>The club</dd></div>
            <template v-else><div><dt class="label">Player</dt><dd>{{ member.fullName }}</dd></div><div><dt class="label">Student ID</dt><dd class="mono">{{ member.studentId }}</dd></div></template>
            <div><dt class="label">Booked</dt><dd>{{ fmtStamp(booking.createdAt, now) }}</dd></div>
            <div v-if="booking.status==='cancelled'"><dt class="label">{{ booking.cancelledBy==='club' ? 'Cancelled by the club' : 'Reason' }}</dt><dd>{{ booking.cancelReason || 'None given' }}</dd></div>
            <div v-if="booking.status==='cancelled' && booking.cancelNote" class="wide"><dt class="label">Message from the club</dt><dd style="font-weight:400">{{ booking.cancelNote }}</dd></div>
          </dl>
          <div class="ticket-foot"><span class="code">{{ booking.code }}</span><club-logo variant="mark" :size="26" /></div>
        </div>
        <div v-if="admin && status!=='cancelled'" class="cancel-zone"><p class="muted sm">To cancel this booking, find it under Bookings. You'll need a reason and a message for {{ booking.purpose ? 'the club' : first }}.</p><button class="btn ghost small" style="align-self:flex-start" @click="openInBookings">Open in Bookings</button></div>
        <div v-else-if="!admin && status==='upcoming'" class="cancel-zone"><button v-if="cancellable" class="btn ghost block danger-text" @click="openCancel">Cancel booking</button><p class="muted sm">{{ cancellable ? 'You can cancel until ' + cutoff + '.' : MESSAGES.cutoff }}</p></div>
      </div>
      <div class="detail-col">
        <div class="card"><h2 class="display h-sm">History</h2><ul class="timeline" style="margin-top:8px">
          <li v-for="e in history" :key="e.id"><span class="tl-dot" :class="e.kind.split('.')[1]"></span><div><p class="tl-text">{{ e.text }}</p><p class="muted sm">{{ fmtStamp(e.createdAt, now) }}, logged by {{ e.source }}</p></div></li>
          <li v-if="!history.length"><span class="tl-dot"></span><div><p class="tl-text">No log entries for this booking.</p></div></li>
        </ul></div>
        <div><h2 class="display h-sm">Before you play</h2><ul class="rules" style="margin-top:10px"><li><strong>Bring your own equipment</strong><span>Or borrow a racket and balls for the day.</span></li><li><strong>Tidy up after</strong><span>Take balls, bottles and towels with you.</span></li></ul></div>
      </div>
    </div>
    </LoadState>
    <CancelSheet v-if="sheet && booking" :booking="booking" :busy="busy" @confirm="confirmCancel" @close="sheet=false" />
  </section>
</template>
