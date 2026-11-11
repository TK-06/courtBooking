<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import * as api from '../lib/api.js'
import { buildHeatMap, statusOf } from '../lib/rules.js'
import { fmtLong, fmtStamp as formatStamp, hh } from '../lib/format.js'
import { useAuth } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import Icon from '../components/Icon.vue'
import HeatMap from '../components/HeatMap.vue'
import LoadState from '../components/LoadState.vue'

const { profile, ready, isAdmin, setMode, signOut:authSignOut } = useAuth()
const { show:toast } = useToast()
const bookings = ref([]), myEvents = ref([]), now = ref(new Date()), logLimit = ref(6)
const loading = ref(true), error = ref(false)
let clock, active = true
const me = computed(() => ({ name:profile.value?.fullName || '', sid:profile.value?.studentId || '', ...profile.value }))
const initials = name => name.split(' ').filter(Boolean).map(s => s[0]).slice(0,2).join('')
const PROGRAMS = { ICE:'Information and Communication Engineering', ADME:'Automotive Design and Manufacturing Engineering', AERO:'Aerospace Engineering', NANO:'Nano-Engineering', ChPE:'Chemical and Process Engineering' }
const programName = program => PROGRAMS[program] || program
const kindTail = kind => kind.split('.').at(-1)
const fmtStamp = date => formatStamp(date, now.value)
const stats = computed(() => {
  const done = bookings.value.filter(b => statusOf(b, now.value) === 'played').sort((a,b) => a.date.localeCompare(b.date))
  const hours = done.reduce((total,b) => total + b.end - b.start, 0)
  const counts = {}
  done.forEach(b => { counts[b.start] = (counts[b.start] || 0) + 1 })
  const fav = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0]
  return { hours, sessions:done.length, fav:fav ? hh(+fav) : '', since:done[0] ? fmtLong(done[0].date).split(' ').slice(1).join(' ') : '', cancels:bookings.value.filter(b => b.status === 'cancelled').length }
})
const heat = computed(() => buildHeatMap({ bookings:bookings.value, userId:profile.value?.id, now:now.value }))
const heatLabel = computed(() => 'Heat map of hours on court over the last 12 weeks: ' + stats.value.hours + ' hours across ' + stats.value.sessions + ' games.')
async function load() {
  loading.value = true; error.value = false
  try {
    await ready
    if (!active) return
    const [mine, events] = await Promise.all([api.fetchMyBookings(profile.value.id), api.fetchEvents({ userId:profile.value.id })])
    if (!active) return
    bookings.value = mine; myEvents.value = events.slice().sort((a,b) => b.createdAt - a.createdAt)
  } catch { if (active) error.value = true }
  finally { loading.value = false }
}
async function switchMode() { try { await setMode('admin') } catch (cause) { toast(cause.message) } }
async function signOut() { try { await authSignOut() } catch (cause) { toast(cause.message) } }
onMounted(() => { void load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onUnmounted(() => { active = false; clearInterval(clock) })
</script>

<template>
<section class="screen">
  <div class="prof-head">
    <span class="avatar xl">{{ initials(me.name) }}</span>
    <div>
      <h1 class="display h-lg">{{ me.name }}</h1>
      <p class="muted">{{ me.role==='admin' ? 'Club admin' : programName(me.program) + ', year ' + me.year }}</p>
      <p class="mono sm muted">{{ me.sid }}</p>
    </div>
  </div>
  <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load your playing history. Check your connection and try again." @retry="load">
  <p v-if="stats.sessions" class="summary"><em>{{ stats.hours }} hours</em> on court across {{ stats.sessions }} games since {{ stats.since }}. You book {{ stats.fav }} most often{{ stats.cancels ? ', and you have cancelled ' + (stats.cancels === 1 ? 'once' : stats.cancels + ' times') : '' }}.</p>
  <p v-else class="summary">No games played yet. Your first booking will show here.</p>
  <div class="prof-grid">
    <div class="card">
      <div class="row-between"><h2 class="display h-sm">Hours on court</h2><span class="muted sm">Last 12 weeks</span></div>
      <HeatMap :columns="heat" :label="heatLabel"/>
    </div>
    <div class="card">
      <div class="row-between"><h2 class="display h-sm">Booking log</h2><span class="muted sm">{{ myEvents.length }} entries</span></div>
      <ul v-if="myEvents.length" class="timeline" style="margin-top:8px">
        <li v-for="e in myEvents.slice(0, logLimit)" :key="e.id"><span class="tl-dot" :class="kindTail(e.kind)"></span><div><p class="tl-text">{{ e.text }}</p><p class="muted sm">{{ fmtStamp(e.createdAt) }}</p></div></li>
      </ul>
      <p v-else class="muted sm" style="margin-top:10px">Bookings and loans you make are logged here.</p>
      <button v-if="myEvents.length > logLimit" class="linkbtn" style="margin-top:8px" @click="logLimit += 6">Show 6 more</button>
    </div>
  </div>
  </LoadState>
  <div class="prof-actions">
    <button class="list-btn" @click="toast('Editing your profile is not in this prototype.')"><icon name="edit"></icon>Edit profile<icon name="right" class="end"></icon></button>
    <button v-if="isAdmin" class="list-btn" @click="switchMode()"><icon name="shield"></icon>Open admin<icon name="right" class="end"></icon></button>
    <button class="list-btn" @click="signOut()"><icon name="logout"></icon>Sign out</button>
  </div>
</section>
</template>

