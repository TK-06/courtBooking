<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as api from '../lib/api.js'
import { LOAN_AHEAD_DAYS, MESSAGES, validateLoan } from '../lib/rules.js'
import { addDays, todayIso, weekdayIndex } from '../lib/time.js'
import { fmtDate, fmtLong, itemsText } from '../lib/format.js'
import { useAuth } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import Icon from '../components/Icon.vue'
import RacketArt from '../components/RacketArt.vue'
import BallsArt from '../components/BallsArt.vue'
import LoadState from '../components/LoadState.vue'

const { profile, ready } = useAuth()
const { show } = useToast()
const now = ref(new Date())
const today = computed(() => todayIso(now.value))
const loanDraft = reactive({ date:today.value, racket:0, balls:0 })
const equipment = ref([]), loans = ref([]), closedDays = ref({}), free = ref({ racket:0, balls:0 })
const loading = ref(true), availabilityLoading = ref(true), saving = ref(false), loadError = ref(false), loanErr = ref('')
const availabilityError = ref(false)
let availabilityRevision = 0, clock, active = true
const myLoans = computed(() => loans.value.slice().sort((a,b) => b.date.localeCompare(a.date)))
const borrowDays = computed(() => Array.from({ length:LOAN_AHEAD_DAYS + 1 }, (_, i) => {
  const iso = addDays(today.value, i)
  return { iso, n:Number(iso.slice(8)), wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekdayIndex(iso)], closed:Object.hasOwn(closedDays.value, iso) }
}))
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const loanLabel = status => ({ reserved:'Reserved', out:'Picked up', returned:'Returned' })[status]
const loanChip = status => ({ reserved:'ok', out:'warn', returned:'muted' })[status]
const hasLoanThatDay = () => loans.value.some(l => l.date === loanDraft.date && l.status !== 'returned')

async function loadAvailability() {
  if (!active) return
  const revision = ++availabilityRevision
  availabilityLoading.value = true
  availabilityError.value = false
  try {
    const result = await api.fetchAvailability(loanDraft.date)
    if (revision === availabilityRevision) free.value = result
  } catch {
    if (revision === availabilityRevision) { free.value = { racket:0, balls:0 }; availabilityError.value = true }
  } finally { if (revision === availabilityRevision) availabilityLoading.value = false }
}
async function load() {
  loading.value = true; loadError.value = false
  try {
    await ready
    if (!active) return
    const [items, days, mine] = await Promise.all([api.fetchEquipment(), api.fetchClosedDays(), api.fetchLoans({ userId:profile.value.id })])
    if (!active) return
    equipment.value = items; closedDays.value = days; loans.value = mine
    await loadAvailability()
  } catch { if (active) loadError.value = true }
  finally { loading.value = false }
}
function pickLoanDay(day) {
  if (day.closed) { show(closedDays.value[day.iso]); return }
  loanErr.value = ''; loanDraft.date = day.iso
}
function bump(item, delta) {
  if (availabilityLoading.value || availabilityError.value || saving.value) return
  const next = loanDraft[item] + delta
  if (next < 0) return
  if (delta < 0) { loanDraft[item] = next; loanErr.value = ''; return }
  const quantities = { racket:loanDraft.racket, balls:loanDraft.balls, [item]:next }
  const error = validateLoan({ ...quantities, equipment:equipment.value, free:free.value, hasLoanThatDay:false, date:loanDraft.date })
  // Zero is a valid stepper state; only submission requires at least one item.
  if (error && error !== MESSAGES.loanNone) { show(error); return }
  loanDraft[item] = next; loanErr.value = ''
}
async function reserveLoan() {
  if (loading.value || loadError.value || availabilityLoading.value || availabilityError.value || !equipment.value.length || saving.value) return
  loanErr.value = closedDays.value[loanDraft.date] || validateLoan({ ...loanDraft, equipment:equipment.value, free:free.value, hasLoanThatDay:hasLoanThatDay() }) || ''
  if (loanErr.value) return
  saving.value = true
  try {
    const loan = await api.createLoan({ ...loanDraft })
    if (!active) return
    loans.value.push(loan)
    show('Reserved for ' + fmtDate(loan.date) + '. Collect from the court attendant.')
    loanDraft.racket = 0; loanDraft.balls = 0
    await loadAvailability()
  } catch (error) { if (active) { loanErr.value = error.message; await loadAvailability() } }
  finally { saving.value = false }
}
watch(() => loanDraft.date, loadAvailability)
watch(today, value => { if (loanDraft.date < value) loanDraft.date = value })
onMounted(() => { void load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onUnmounted(() => { active = false; clearInterval(clock); availabilityRevision++ })
</script>
<template>
<section class="screen">
  <div class="page-head"><div><h1 class="display h-lg">Borrow a racket or balls</h1><p class="lede">One day at a time. Pick up from the court attendant and return everything by 22:00 the same day.</p></div></div>
  <LoadState :state="loading ? 'loading' : loadError ? 'error' : 'ready'" message="Couldn't load equipment. Check your connection and try again." @retry="load">
  <div class="borrow-grid">
    <div class="borrow-col">
      <h2 class="label">Day</h2>
      <div class="day-strip">
        <button v-for="d in borrowDays" :key="d.iso" class="dchip" :class="{on: loanDraft.date===d.iso, off: d.closed}" :aria-pressed="loanDraft.date===d.iso" :aria-label="fmtLong(d.iso)" :disabled="saving" @click="pickLoanDay(d)"><span>{{ d.wd }}</span><strong>{{ d.n }}</strong></button>
      </div>
      <LoadState :state="availabilityLoading ? 'loading' : availabilityError ? 'error' : 'ready'" message="Couldn't load equipment availability. Check your connection and try again." @retry="loadAvailability">
      <p v-if="!equipment.length" class="muted">No equipment available.</p>
      <div v-else class="items">
        <div v-for="it in equipment" :key="it.id" class="item-row">
          <component :is="it.id==='racket' ? RacketArt : BallsArt" class="item-art"/>
          <div style="min-width:0">
            <p class="item-name">{{ it.plural }}</p>
            <p class="avail"><span class="dot" :class="free[it.id] ? 'open' : 'closed'"></span>{{ free[it.id] }} of {{ it.total }} free, up to {{ it.maxPerDay }} each</p>
          </div>
          <div class="stepper">
            <button :aria-label="'One fewer ' + it.name.toLowerCase()" :disabled="availabilityLoading || saving" @click="bump(it.id, -1)"><Icon name="minus" :size="18"/></button>
            <span>{{ loanDraft[it.id] }}</span>
            <button :aria-label="'One more ' + it.name.toLowerCase()" :disabled="availabilityLoading || saving" @click="bump(it.id, 1)"><Icon name="plus" :size="18"/></button>
          </div>
        </div>
      </div>
      </LoadState>
      <p v-if="loanErr" class="err" role="alert">{{ loanErr }}</p>
      <button class="btn primary block" :disabled="availabilityLoading || availabilityError || !equipment.length || saving" @click="reserveLoan">Reserve for {{ fmtDate(loanDraft.date) }}</button>
    </div>
    <div class="borrow-col">
      <h2 class="display h-md">Your loans</h2>
      <ul v-if="myLoans.length" class="loan-list">
        <li v-for="l in myLoans" :key="l.id" class="loan-row">
          <div><p class="lr-title">{{ capital(itemsText(l)) }}</p><p class="muted sm">{{ fmtDate(l.date) }}, back by 22:00</p></div>
          <span class="chip" :class="loanChip(l.status)">{{ loanLabel(l.status) }}</span>
        </li>
      </ul>
      <p v-else class="muted">Nothing borrowed yet.</p>
      <div class="card">
        <h2 class="display h-sm">How borrowing works</h2>
        <ol class="steps-mini"><li>Reserve here, up to 6 days ahead.</li><li>Show your student ID to the court attendant.</li><li>Return everything by 22:00 the same day.</li></ol>
      </div>
    </div>
  </div>
  </LoadState>
</section>
</template>
