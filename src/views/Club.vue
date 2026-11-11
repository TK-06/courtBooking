<script setup>
import { getCurrentInstance, onMounted, onUnmounted, ref } from 'vue'
import { fetchCourts } from '../lib/api.js'
import { useToast } from '../composables/useToast.js'
import Icon from '../components/Icon.vue'
import ClubLogo from '../components/ClubLogo.vue'
import LoadState from '../components/LoadState.vue'

const { show } = useToast()
const courts = ref([]), loading = ref(true), error = ref(false)
let active = true
const gradientId = 'ig-grad-' + getCurrentInstance().uid
const links = { map:'https://maps.app.goo.gl/4LWxM2rodPUCLwEK8', ig:'https://www.instagram.com/intaniatennisclub/' }
const rules = [
  {t:'Open every day, 08:00 to 22:00', d:'Courts are booked by the hour. The last hour starts at 21:00.'},
  {t:'Up to 2 hours a day', d:'Two hours on the same day have to be back to back. You can book 14 days ahead.'},
  {t:'Please bring your own equipment', d:'No racket? Borrow one, and a can of balls, for the day.'},
  {t:'Tidy up after your session', d:'Take balls, bottles and towels with you so the court is ready for the next players.'},
  {t:'Cancel at least 2 hours before', d:'That gives someone else time to take the hour.'},
  {t:'Arrive on time', d:'Your hour ends on the hour, whenever you start.'},
]
async function load() {
  loading.value = true; error.value = false
  try { const result = await fetchCourts(); if (active) courts.value = result }
  catch { if (active) error.value = true }
  finally { loading.value = false }
}
async function copyPhone() {
  try { await navigator.clipboard.writeText('0617830155'); show('Number copied.') }
  catch { show('Copy the number: 061-783-0155') }
}
onMounted(load)
onUnmounted(() => { active = false })
</script>

<template>
<section class="screen">
  <div class="club-hero">
    <div class="club-id">
      <club-logo></club-logo>
      <div>
        <h1 class="display h-xl">Intania Tennis Club</h1>
        <p class="lede" style="margin-top:10px">Two courts at CUB 13, open every day from 08:00 to 22:00 for Chula engineering students.</p>
      </div>
    </div>
    <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load courts. Check your connection and try again." @retry="load">
    <ul v-if="courts.length" class="status-list">
      <li v-for="c in courts" :key="c.id" class="status-row"><span class="dot" :class="c.status"></span><strong>{{ c.name }}</strong><span class="muted">{{ c.status==='open' ? 'Open today' : 'Closed' }}</span></li>
    </ul>
    <p v-else class="muted">No courts available.</p>
    </LoadState>
  </div>
  <div class="club-grid">
    <a class="place-card lift" :href="links.map" target="_blank" rel="noopener noreferrer">
      <span class="label" style="color:rgba(251,245,236,.75)">Where to find the courts</span>
      <span class="place-name">CUB 13</span>
      <span class="muted">Chulalongkorn University, Pathum Wan, Bangkok</span>
      <span class="ext">Open in Google Maps<icon name="ext" :size="16"></icon></span>
    </a>
    <a class="ig-card lift" :href="links.ig" target="_blank" rel="noopener noreferrer">
      <div class="ig-head">
        <span class="ig-av"><club-logo></club-logo></span>
        <span style="min-width:0"><span class="ig-handle">intaniatennisclub</span><span class="muted sm">Intania Tennis Club</span></span>
        <svg width="26" height="26" viewBox="0 0 24 24" role="img" aria-label="Instagram">
  <defs><radialGradient :id="gradientId" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs>
  <rect width="24" height="24" rx="6" :fill="'url(#' + gradientId + ')'"/><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.3" cy="7.7" r="1.1" fill="#fff"/>
</svg>
      </div>
      <p class="muted sm">Match days, court news and club announcements.</p>
      <span class="ext">Open Instagram<icon name="ext" :size="16"></icon></span>
    </a>
    <div class="phone-card">
      <span class="label">Call the club</span>
      <p class="phone">061-783-0155</p>
      <p class="muted sm">For questions about the courts or equipment.</p>
      <div class="hours">
        <div><span>Every day</span><span>08:00–22:00</span></div>
        <div><span>Last booking starts</span><span>21:00</span></div>
      </div>
      <div class="phone-btns">
        <a class="btn primary" href="tel:+66617830155"><icon name="phone" :size="18"></icon>Call</a>
        <button class="btn ghost" @click="copyPhone()"><icon name="copy" :size="18"></icon>Copy</button>
      </div>
    </div>
  </div>
  <div class="club-rules">
    <h2 class="display h-md">Court rules</h2>
    <ul class="rules" style="margin-top:12px"><li v-for="r in rules" :key="r.t"><strong>{{ r.t }}</strong><span>{{ r.d }}</span></li></ul>
  </div>
  <p class="note" style="margin-top:22px">Student prototype for an ISE course assignment, built with sample data.</p>
</section>
</template>

