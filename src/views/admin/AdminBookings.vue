<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../../lib/api.js'
import { statusOf } from '../../lib/rules.js'
import { todayIso, slotInstant } from '../../lib/time.js'
import { fmtDate, range } from '../../lib/format.js'
import { useToast } from '../../composables/useToast.js'
import Icon from '../../components/Icon.vue'
import AdminCancelSheet from '../../components/AdminCancelSheet.vue'
import LoadState from '../../components/LoadState.vue'

const route = useRoute(), router = useRouter(), { show } = useToast()
const bookings = ref([]), profiles = ref([]), courts = ref([])
const loading = ref(true), error = ref(false), saving = ref(false), selected = ref(null)
const now = ref(new Date())
const abTabs = [{id:'today',label:'Today'}, {id:'upcoming',label:'Upcoming'}, {id:'past',label:'Past'}, {id:'cancelled',label:'Cancelled'}]
const validTab = value => abTabs.some(t => t.id === value) ? value : 'today'
const queryText = value => typeof value === 'string' ? value : ''
const abTab = computed({ get:() => validTab(route.query.tab), set:value => syncQuery({tab:value}) })
const abSearch = computed({ get:() => queryText(route.query.q), set:value => syncQuery({q:value}) })
function syncQuery(patch) {
  const query = { ...route.query, ...patch }
  if (!query.q) delete query.q
  void router.replace({ query })
}
const member = id => profiles.value.find(p => p.id === id) || { fullName:'Unknown' }
const first = booking => booking.purpose ? null : member(booking.userId).fullName.split(' ')[0]
const bookerName = b => b.purpose ? 'Club booking' : member(b.userId).fullName
const courtName = id => courts.value.find(c => c.id === id)?.name || (id === 1 ? 'Court I' : 'Court II')
const status = b => statusOf(b, now.value)
const statusChip = b => ({cancelled:'crimson',played:'muted',live:'warn',upcoming:'ok'})[status(b)]
const statusText = b => ({cancelled:'Cancelled',played:'Played',live:'On court now',upcoming:'Confirmed'})[status(b)]
const adminBookings = computed(() => {
  const q = abSearch.value.trim().toLowerCase()
  const list = bookings.value.filter(b => {
    const matchesTab = abTab.value === 'today' ? b.date === todayIso(now.value) : status(b) === ({past:'played'}[abTab.value] || abTab.value)
    return matchesTab && (!q || b.code.toLowerCase().includes(q) || member(b.userId).fullName.toLowerCase().includes(q))
  })
  const direction = ['past','cancelled'].includes(abTab.value) ? -1 : 1
  return list.sort((a,b) => direction * (slotInstant(a.date,a.start) - slotInstant(b.date,b.start)))
})
const startBooking = () => router.push({ name:'book' })
const openBooking = id => router.push({ name:'booking/:id', params:{id} })
async function cancel(payload) {
  if (saving.value || !selected.value) return
  saving.value = true
  const booking = selected.value, memberFirst = first(booking)
  try {
    const updated = await api.cancelBooking(booking.id, payload)
    bookings.value = bookings.value.map(b => b.id === booking.id ? updated : b)
    selected.value = null
    show(memberFirst ? `${memberFirst}'s booking is cancelled. They'll see your message.` : 'Club booking cancelled.')
  } catch (cause) { show(cause.message) }
  finally { saving.value = false }
}
async function load() {
  loading.value = true; error.value = false; now.value = new Date()
  try { [bookings.value,profiles.value,courts.value] = await Promise.all([api.fetchBookings({from:'0001-01-01',to:'9999-12-31'}),api.fetchProfiles(),api.fetchCourts()]) }
  catch { error.value = true }
  finally { loading.value = false }
}
watch(() => route.query.tab, () => { now.value = new Date() })
let clock
onMounted(() => { void load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onBeforeUnmount(() => clearInterval(clock))
</script>
<template>
<section class="screen">
  <div class="page-head"><h1 class="display h-lg">Bookings</h1><button class="btn primary small" @click="startBooking"><Icon name="plus" :size="18"/>Book for the club</button></div>
  <div class="toolbar">
    <div class="seg" role="tablist"><button v-for="t in abTabs" :key="t.id" role="tab" :aria-selected="abTab===t.id" :class="{on:abTab===t.id}" @click="abTab=t.id">{{ t.label }}</button></div>
    <input id="ab-search" v-model="abSearch" class="search" type="search" placeholder="Search name or code" aria-label="Search bookings">
  </div>
  <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load bookings. Check your connection and try again." @retry="load">
    <div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Member</th><th>Court</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="b in adminBookings" :key="b.id">
          <td class="mono">{{ b.code }}</td><td>{{ bookerName(b) }}</td><td>{{ courtName(b.courtId) }}</td><td>{{ fmtDate(b.date) }}</td><td>{{ range(b) }}</td>
          <td><span class="chip" :class="statusChip(b)">{{ statusText(b) }}</span></td>
          <td class="right"><button class="linkbtn" style="color:var(--ink-2)" @click="openBooking(b.id)">View</button><button v-if="b.status!=='cancelled'" class="linkbtn danger-text" style="margin-left:16px" @click="selected=b">Cancel</button></td>
        </tr>
        <tr v-if="!adminBookings.length"><td colspan="7" class="empty-cell">No bookings match.</td></tr>
      </tbody>
    </table></div>
    <p class="table-note">{{ adminBookings.length }} {{ adminBookings.length===1 ? 'booking' : 'bookings' }}</p>
  </LoadState>
  <AdminCancelSheet v-if="selected" :booking="selected" :member-first="first(selected)" :busy="saving" @confirm="cancel" @close="selected=null"/>
</section>
</template>
