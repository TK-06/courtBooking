<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import { cancelBooking, fetchBookings, fetchClosedDays, fetchCourts, fetchMyBookings } from '../lib/api.js'
import { HOURS, MESSAGES, canCancel, isFree, statusOf } from '../lib/rules.js'
import { bangkokParts, slotInstant, todayIso } from '../lib/time.js'
import { fmtDate, fmtLong, range } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import CourtArt from '../components/CourtArt.vue'
import RacketArt from '../components/RacketArt.vue'
import TicketCard from '../components/TicketCard.vue'
import CancelSheet from '../components/CancelSheet.vue'
import LoadState from '../components/LoadState.vue'
const route = useRoute()
const router = useRouter()
const { profile, session, mode, isAdmin } = useAuth()
const { show } = useToast()
const userId = computed(() => session.value?.user.id || profile.value?.id)
const now = ref(new Date())
const today = computed(() => todayIso(now.value))
const mine = ref([]), todayBookings = ref([]), courts = ref([]), closedDays = ref({})
const loading = ref(true), error = ref(false), cancelling = ref(false), sheetBooking = ref(null)
let revision = 0
const timer = setInterval(() => { now.value = new Date() }, 30000)
onUnmounted(() => { clearInterval(timer); revision++ })
async function load() {
  const current = ++revision
  loading.value = true; error.value = false; sheetBooking.value = null
  try {
    const [bs, cs, occupied, ds] = await Promise.all([fetchMyBookings(userId.value), fetchCourts(), fetchBookings({ from:today.value, to:today.value }), fetchClosedDays()])
    if (current !== revision) return
    mine.value = bs.filter(b => b.userId === userId.value); courts.value = cs; todayBookings.value = occupied; closedDays.value = ds
  } catch { if (current === revision) error.value = true }
  finally { if (current === revision) loading.value = false }
}
watch([userId, () => route.fullPath, today], load, { immediate:true })
const upcoming = computed(() => mine.value.filter(b => statusOf(b, now.value) === 'upcoming').sort((a,b) => slotInstant(a.date,a.start) - slotInstant(b.date,b.start)))
const greeting = computed(() => { const { hour } = bangkokParts(now.value); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' })
const courtName = id => courts.value.find(c => c.id === id)?.name || ''
const openCount = id => HOURS.filter(hour => isFree({ date:today.value, courtId:id, hour, now:now.value, courts:courts.value, closedDays:closedDays.value, bookings:todayBookings.value })).length
const go = name => router.push({ name })
const openBooking = id => router.push({ name:'booking/:id', params:{ id } })
function startBooking(courtId) {
  if (!courts.value.some(c => c.status === 'open')) return show('Both courts are closed right now.')
  router.push(courtId ? { name:'book', query:{ court:courtId } } : { name:'book' })
}
function tapCourt(court) {
  if (court.status !== 'open') return show(court.name + ': ' + (court.note || 'closed for now.'))
  startBooking(court.id)
}
function openCancel(id) {
  const booking = mine.value.find(b => b.id === id)
  if (mode.value === 'admin' && isAdmin.value) return router.push({ name:'admin-bookings', query:{ q:booking.code, tab:'upcoming' } })
  now.value = new Date()
  if (!booking || !canCancel(booking, now.value)) return show(MESSAGES.cutoff)
  sheetBooking.value = booking
}
async function confirmCancel({ reason }) {
  if (cancelling.value || !sheetBooking.value) return
  const booking = sheetBooking.value
  if (mode.value === 'admin' && isAdmin.value) {
    sheetBooking.value = null
    return router.push({ name:'admin-bookings', query:{ q:booking.code, tab:'upcoming' } })
  }
  now.value = new Date()
  if (!canCancel(booking, now.value)) { sheetBooking.value = null; return show(MESSAGES.cutoff) }
  cancelling.value = true
  const current = revision
  try {
    const cancelled = await cancelBooking(booking.id, { reason })
    if (current !== revision) return
    mine.value = mine.value.map(b => b.id === booking.id ? cancelled : b)
    todayBookings.value = todayBookings.value.map(b => b.id === booking.id ? cancelled : b)
    sheetBooking.value = null
    show('Booking cancelled. The hour is free again.')
  } catch (cause) { show(cause.message) }
  finally { cancelling.value = false }
}
</script>
<template>
  <section class="screen">
    <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load your bookings. Check your connection and try again." @retry="load">
    <div class="home-grid">
      <div class="home-main">
        <div class="greet enter"><p class="date-line">{{ fmtLong(today) }}</p><h1 class="display h-xl">{{ greeting }}, {{ (profile?.fullName || '').split(' ')[0] }}.</h1></div>
        <TicketCard v-if="upcoming[0]" class="enter e2" :booking="upcoming[0]" label="Next booking" menu @open="openBooking" @cancel="openCancel" />
        <div v-else class="empty-card enter e2"><p class="display h-sm">No court booked.</p><p class="muted">Your next booking shows up here once you pick a date and an hour.</p></div>
        <div class="sec-head"><h2 class="display h-md">Courts</h2><p class="muted sm">Tap a court for its open hours</p></div>
        <div class="courts">
          <button v-for="c in courts" :key="c.id" class="court-btn" :class="{ closed:c.status!=='open' }" :aria-label="c.name + (c.status==='open' ? ', open. See hours' : ', closed')" @click="tapCourt(c)">
            <court-art :closed="c.status!=='open'" :label="c.name" />
            <span class="ct-row"><span class="dot" :class="c.status"></span><span class="ct-name">{{ c.name }}</span></span>
            <span class="ct-status">{{ c.status==='open' ? openCount(c.id) + ' hours open today' : 'Closed for resurfacing' }}</span>
          </button>
        </div>
        <p v-if="!courts.length" class="muted">No courts available.</p>
        <button class="btn primary block home-cta" :disabled="!courts.length" @click="startBooking()">Book a court<icon name="right" :size="18" class="go" /></button>
      </div>
      <div class="home-side">
        <ul class="rows">
          <li><button class="row" @click="go('borrow')"><span class="row-ico"><racket-art /></span><span class="row-text"><strong>Borrow a racket or balls</strong><span>For one day, from the court attendant</span></span><icon name="right" /></button></li>
          <li><button class="row" @click="go('club')"><span class="row-ico"><icon name="pin" :size="22" /></span><span class="row-text"><strong>CUB 13, Chulalongkorn University</strong><span>Directions, Instagram and phone</span></span><icon name="right" /></button></li>
          <li><button class="row" @click="go('club')"><span class="row-ico"><icon name="list" :size="22" /></span><span class="row-text"><strong>Court rules</strong><span>Bring your own equipment, tidy up after</span></span><icon name="right" /></button></li>
        </ul>
        <div v-if="upcoming.length>1"><h2 class="display h-sm">Also booked</h2><ul class="blist" style="margin-top:10px">
          <li v-for="b in upcoming.slice(1,4)" :key="b.id"><button class="brow" @click="openBooking(b.id)">
            <span class="br-date"><span class="br-day">{{ Number(b.date.slice(8)) }}</span><span class="br-mon">{{ fmtDate(b.date).split(' ')[2] }}</span></span>
            <span class="br-info"><span class="br-title">{{ fmtLong(b.date).split(' ')[0] }}, {{ range(b) }}</span><span class="br-sub">{{ courtName(b.courtId) }}</span></span><span></span><icon name="right" :size="18" class="br-chev" />
          </button></li>
        </ul></div>
      </div>
    </div>
    </LoadState>
    <CancelSheet v-if="sheetBooking" :booking="sheetBooking" :busy="cancelling" @confirm="confirmCancel" @close="sheetBooking=null" />
  </section>
</template>
