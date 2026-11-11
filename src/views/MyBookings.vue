<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { fetchCourts, fetchMyBookings } from '../lib/api.js'
import { statusOf } from '../lib/rules.js'
import { slotInstant } from '../lib/time.js'
import { fmtDate, fmtLong, range } from '../lib/format.js'
import Icon from '../components/Icon.vue'
import LoadState from '../components/LoadState.vue'
const route = useRoute()
const router = useRouter()
const { profile, session } = useAuth()
const userId = computed(() => session.value?.user.id || profile.value?.id)
const bookings = ref([]), courts = ref([]), loading = ref(true), error = ref(false)
const tab = ref('upcoming'), now = ref(new Date())
let revision = 0
const timer = setInterval(() => { now.value = new Date() }, 30000)
onUnmounted(() => { clearInterval(timer); revision++ })
watch(() => route.query.tab, value => { tab.value = ['upcoming','past','cancelled'].includes(value) ? value : 'upcoming' }, { immediate:true })
async function load() {
  const current = ++revision
  loading.value = true; error.value = false
  try {
    const [bs, cs] = await Promise.all([fetchMyBookings(userId.value), fetchCourts()])
    if (current === revision) { bookings.value = bs.filter(b => b.userId === userId.value); courts.value = cs }
  } catch { if (current === revision) error.value = true }
  finally { if (current === revision) loading.value = false }
}
watch(userId, load, { immediate:true })
const status = b => statusOf(b, now.value)
const tabs = computed(() => [
  { id:'upcoming', label:'Upcoming', n:bookings.value.filter(b => status(b)==='upcoming').length },
  { id:'past', label:'Played', n:bookings.value.filter(b => status(b)==='played').length },
  { id:'cancelled', label:'Cancelled', n:bookings.value.filter(b => status(b)==='cancelled').length },
])
const list = computed(() => bookings.value.filter(b => status(b) === (tab.value==='past' ? 'played' : tab.value)).sort((a,b) => (slotInstant(a.date,a.start) - slotInstant(b.date,b.start)) * (tab.value==='upcoming' ? 1 : -1)))
const statusText = b => ({ upcoming:'Confirmed', played:'Played', cancelled:'Cancelled', live:'On court now' })[status(b)]
const statusChip = b => ({ upcoming:'ok', played:'muted', cancelled:'crimson', live:'warn' })[status(b)]
const courtName = id => courts.value.find(c => c.id===id)?.name || ''
const startBooking = () => router.push({ name:'book' })
</script>
<template>
  <section class="screen">
    <div class="page-head"><h1 class="display h-lg">My bookings</h1><button class="btn primary small" @click="startBooking"><icon name="plus" :size="18" />Book a court</button></div>
    <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load your bookings. Check your connection and try again." @retry="load">
      <div class="seg" role="tablist"><button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="tab===t.id" :class="{ on:tab===t.id }" @click="tab=t.id">{{ t.label }}<span class="count">{{ t.n }}</span></button></div>
      <ul v-if="list.length" class="blist"><li v-for="b in list" :key="b.id"><button class="brow" @click="router.push({ name:'booking/:id', params:{ id:b.id } })">
        <span class="br-date"><span class="br-day">{{ Number(b.date.slice(8)) }}</span><span class="br-mon">{{ fmtDate(b.date).split(' ')[2] }}</span></span>
        <span class="br-info"><span class="br-title">{{ fmtLong(b.date).split(' ')[0] }}, {{ range(b) }}</span><span class="br-sub">{{ courtName(b.courtId) }} <span class="mono">{{ b.code }}</span></span></span>
        <span class="chip" :class="statusChip(b)">{{ statusText(b) }}</span><icon name="right" :size="18" class="br-chev" />
      </button></li></ul>
      <div v-else class="empty"><p class="display h-sm" style="color:var(--ink)">{{ tab==='upcoming' ? 'No upcoming bookings' : tab==='past' ? 'No games played yet' : 'No cancellations' }}</p><p class="sm">{{ tab==='upcoming' ? 'Book an hour and it shows up here.' : 'Your history fills in as you play.' }}</p><button v-if="tab==='upcoming'" class="btn primary small" @click="startBooking">Book a court</button></div>
    </LoadState>
  </section>
</template>
