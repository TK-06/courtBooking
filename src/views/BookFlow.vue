<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import { createBooking, fetchBookings, fetchClosedDays, fetchCourts, fetchProfiles } from '../lib/api.js'
import { HOURS, MESSAGES, isFree, slotState, toggleSlot, windowEnd } from '../lib/rules.js'
import { todayIso } from '../lib/time.js'
import { fmtDate, fmtLong, hh, hoursText } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import LoadState from '../components/LoadState.vue'
import StepDate from './steps/StepDate.vue'
import StepSlots from './steps/StepSlots.vue'
import StepReview from './steps/StepReview.vue'
import StepDone from './steps/StepDone.vue'

const route = useRoute()
const router = useRouter()
const { profile, session, mode, isAdmin } = useAuth()
const { show } = useToast()
const role = computed(() => mode.value === 'admin' && isAdmin.value ? 'admin' : 'student')
const userId = computed(() => session.value?.user.id || profile.value?.id)
const now = ref(new Date())
const today = computed(() => todayIso(now.value))
const step = ref(1)
watch(step, () => {
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}, { flush:'post' })
const draft = reactive({ date:null, courtId:1, slots:[], agree:false, purpose:'' })
const courts = ref([])
const closedDays = ref({})
const bookings = ref([])
const profiles = ref([])
const loading = ref(true)
const loadError = ref(false)
const busy = ref(false)
const agreeError = ref(false)
const purposeError = ref(false)
const lastBooking = ref(null)
let revision = 0
const timer = setInterval(() => { now.value = new Date() }, 30000)
onUnmounted(() => { clearInterval(timer); revision++ })

async function load() {
  const current = ++revision
  loading.value = true
  loadError.value = false
  step.value = 1
  Object.assign(draft, { date:null, courtId:Number(route.query.court) || 1, slots:[], agree:false, purpose:'' })
  agreeError.value = purposeError.value = false
  lastBooking.value = null
  try {
    const [cs, ds, bs, ps] = await Promise.all([
      fetchCourts(), fetchClosedDays(), fetchBookings({ from:today.value, to:windowEnd(today.value, role.value) }),
      role.value === 'admin' ? fetchProfiles() : Promise.resolve([]),
    ])
    if (current !== revision) return
    courts.value = cs; closedDays.value = ds; bookings.value = bs; profiles.value = ps
    if (!cs.some(c => c.id === draft.courtId && c.status === 'open')) draft.courtId = cs.find(c => c.status === 'open')?.id || 1
  } catch {
    if (current === revision) loadError.value = true
  } finally { if (current === revision) loading.value = false }
}
watch([role, () => route.query.court, today], load, { immediate:true })
const context = computed(() => ({ now:now.value, courts:courts.value, closedDays:closedDays.value, bookings:bookings.value }))
const openCount = (date, courtId) => HOURS.filter(hour => isFree({ ...context.value, date, courtId, hour })).length
const openTotal = date => courts.value.reduce((sum, c) => sum + openCount(date, c.id), 0)
const openCounts = computed(() => Object.fromEntries(courts.value.map(c => [c.id, openCount(draft.date, c.id)])))
const courtName = computed(() => courts.value.find(c => c.id === draft.courtId)?.name || '')
const selected = computed(() => ({ courtId:draft.courtId, date:draft.date, start:Math.min(...draft.slots), end:Math.max(...draft.slots) + 1 }))
const slots = computed(() => HOURS.map(hour => ({
  h:hour, state:slotState({ ...context.value, date:draft.date, courtId:draft.courtId, hour, userId:userId.value, selected:draft.slots }),
  b:bookings.value.find(b => b.date === draft.date && b.courtId === draft.courtId && b.status !== 'cancelled' && hour >= b.start && hour < b.end),
})))
const ownOnDate = computed(() => bookings.value.filter(b => b.date === draft.date && b.userId === userId.value && b.status !== 'cancelled'))
const hoursUsed = computed(() => ownOnDate.value.reduce((sum, b) => sum + b.end - b.start, 0))
function pickDate(date) {
  if (busy.value || date === draft.date) return
  draft.date = date; draft.slots = []
}
function pickCourt(id) {
  if (busy.value) return
  const court = courts.value.find(c => c.id === id)
  if (!court) return
  if (court.status !== 'open') return show(court.name + ': ' + (court.note || 'closed for now.') + (role.value === 'admin' ? ' Reopen it under Courts to book it.' : ''))
  if (draft.courtId !== id) { draft.courtId = id; draft.slots = [] }
}
function pickSlot(slot) {
  if (busy.value) return
  now.value = new Date()
  const current = slots.value.find(s => s.h === slot.h)
  const result = toggleSlot({ slots:draft.slots, hour:slot.h, state:current.state, role:role.value, hoursUsed:hoursUsed.value })
  draft.slots = result.slots
  if (result.message) show(result.message)
}
function validateSelection() {
  if (!draft.slots.length) return 'Pick at least one hour.'
  if (role.value === 'student') {
    if (hoursUsed.value + draft.slots.length > 2) return MESSAGES.maxHours
    const hours = [...draft.slots, ...ownOnDate.value.flatMap(b => Array.from({ length:b.end-b.start }, (_, i) => b.start+i))].sort((a,b) => a-b)
    if (hours.some((hour, i) => i > 0 && hour !== hours[i-1]+1)) return MESSAGES.adjacent
  }
  if (draft.slots.some(hour => !isFree({ ...context.value, date:draft.date, courtId:draft.courtId, hour }))) return MESSAGES.taken
  return null
}
async function refreshDate() {
  const date = draft.date
  const current = revision
  loading.value = true; loadError.value = false
  try {
    const fresh = await fetchBookings({ from:date, to:date })
    if (current === revision) bookings.value = [...bookings.value.filter(b => b.date !== date), ...fresh]
  } catch {
    if (current === revision) loadError.value = true
  } finally { if (current === revision) loading.value = false }
}
async function confirm() {
  if (role.value === 'student' && !draft.agree) { agreeError.value = true; return }
  now.value = new Date()
  const error = validateSelection()
  if (error) {
    if (error === MESSAGES.taken) { draft.slots = []; draft.agree = false }
    show(error); step.value = 2; return
  }
  busy.value = true
  const current = revision
  try {
    const booking = await createBooking({ ...selected.value, purpose:role.value === 'admin' ? 'Club booking' : null })
    if (current !== revision) return
    lastBooking.value = booking
    step.value = 4
  } catch (error) {
    if (current !== revision) return
    show(error.message)
    if (error.message === MESSAGES.taken) {
      draft.slots = []; draft.agree = false; step.value = 2
      await refreshDate()
    }
  } finally { busy.value = false }
}
function next() {
  if (loading.value || busy.value || loadError.value) return
  now.value = new Date()
  if (step.value === 1) {
    if (!draft.date) return show('Pick a date first.')
    if (!courts.value.some(c => c.status === 'open')) return show('Both courts are closed right now.')
    step.value = 2
  } else if (step.value === 2) {
    const error = validateSelection()
    if (error) {
      if (error === MESSAGES.taken) draft.slots = []
      return show(error)
    }
    draft.agree = false; agreeError.value = false; step.value = 3
  } else if (step.value === 3) return confirm()
}
const openBooking = id => router.push({ name:'booking/:id', params:{ id } })
const openInBookings = booking => router.push({ name:'admin-bookings', query:{ q:booking.code, tab:'upcoming' } })
const exit = () => router.push({ name:role.value === 'admin' ? 'admin-today' : 'home' })
function back() { if (busy.value) return; if (step.value > 1 && step.value < 4) step.value--; else exit() }
const titles = ['Date','Court and hour','Review','Done']
const title = computed(() => step.value === 1 ? 'Choose a date' : step.value === 2 ? fmtDate(draft.date) : step.value === 3 ? 'Review and confirm' : 'Booked')
</script>
<template>
  <section class="screen flow-screen">
    <div class="flow-head"><div class="fh-row">
      <button class="icon-btn" :aria-label="step===1 ? 'Close' : 'Back'" :disabled="busy" @click="back"><icon name="left" /></button>
      <div class="fh-title"><p class="label">Step {{ step }} of 4 · {{ titles[step-1] }}</p><h1 class="display">{{ title }}</h1></div>
      <button class="icon-btn" aria-label="Close booking" :disabled="busy" @click="exit"><icon name="x" /></button>
    </div><div class="progress" aria-hidden="true"><span v-for="n in 4" :key="n" :class="{ on:n<=step }"></span></div></div>
    <LoadState :state="loading ? 'loading' : loadError ? 'error' : 'ready'" message="Couldn't load court availability. Check your connection and try again." @retry="load">
      <p v-if="!courts.length" class="empty">No courts available.</p>
      <StepDate v-else-if="step===1" :date="draft.date" :role="role" :now="now" :courts="courts" :closed-days="closedDays" :bookings="bookings" @select="pickDate" @message="show" />
      <StepSlots v-if="step===2" :slots="slots" :role="role" :court-id="draft.courtId" :courts="courts" :profiles="profiles" :open-counts="openCounts" @select="pickSlot" @court="pickCourt" @open-bookings="openInBookings" />
      <StepReview v-if="step===3" :booking="selected" :profile="profile || {}" :role="role" :agree="draft.agree" :purpose="draft.purpose" :agree-error="agreeError" :purpose-error="purposeError" @update:agree="draft.agree=$event; agreeError=false" @update:purpose="draft.purpose=$event; purposeError=false" />
      <StepDone v-if="step===4 && lastBooking" :booking="lastBooking" :first-name="(profile?.fullName || '').split(' ')[0]" :role="role" @open="openBooking" @home="router.push({ name:role==='admin' ? 'admin-bookings' : 'home' })" />
    </LoadState>
    <div v-if="step<4 && !loading && !loadError && courts.length" class="flow-bar"><div class="fb-inner">
      <div class="fb-sum">
        <template v-if="step===1"><strong>{{ draft.date ? fmtLong(draft.date) : 'Pick a date' }}</strong><span>{{ draft.date ? openTotal(draft.date) + ' hours open' : 'Open daily 08:00–22:00' }}</span></template>
        <template v-else><strong>{{ draft.slots.length ? hh(selected.start) + '–' + hh(selected.end) : 'Pick an hour' }}</strong><span>{{ courtName }}, {{ fmtDate(draft.date) }}{{ draft.slots.length ? ', ' + hoursText(draft.slots.length) : '' }}</span></template>
      </div>
      <button class="btn primary" :disabled="busy" :aria-busy="busy" @click="next">{{ step===3 ? 'Confirm booking' : 'Next' }}<icon v-if="step<3" name="right" :size="18" class="go" /></button>
    </div></div>
  </section>
</template>
