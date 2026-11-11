<script setup>
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import * as api from '../../lib/api.js'
import { statusOf } from '../../lib/rules.js'
import { useToast } from '../../composables/useToast.js'
import CourtArt from '../../components/CourtArt.vue'
import LoadState from '../../components/LoadState.vue'
const { show } = useToast()
const courts = ref([]), bookings = ref([]), loading = ref(true), error = ref(false)
const courtEdit = reactive({}), pending = reactive(new Set())
const now = ref(new Date())
const upcomingOn = id => bookings.value.filter(b => b.courtId===id && statusOf(b,now.value)==='upcoming').length
async function saveCourt(court) {
  if (pending.has(court.id)) return
  const edit = courtEdit[court.id]
  const note = edit.status === 'closed' ? edit.note.trim() || 'Closed for maintenance.' : ''
  if (edit.status === court.status && note === court.note) { show('Nothing changed.'); return }
  pending.add(court.id)
  try {
    const updated = await api.updateCourt(court.id, {status:edit.status,note})
    courts.value = courts.value.map(c => c.id===court.id ? updated : c)
    courtEdit[court.id] = {status:updated.status,note:updated.note}
    show(updated.name + (updated.status==='open' ? ' is open for booking.' : ' is closed.'))
  } catch (cause) { show(cause.message) }
  finally { pending.delete(court.id) }
}
async function load() {
  loading.value=true; error.value=false
  try {
    [courts.value,bookings.value] = await Promise.all([api.fetchCourts(),api.fetchBookings({from:'0001-01-01',to:'9999-12-31'})])
    for (const c of courts.value) courtEdit[c.id] = {status:c.status,note:c.note || ''}
  } catch { error.value=true }
  finally { loading.value=false }
}
let clock
onMounted(() => { void load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onBeforeUnmount(() => clearInterval(clock))
</script>
<template>
<section class="screen">
  <div class="page-head"><div><h1 class="display h-lg">Courts</h1><p class="lede">Close a court for maintenance or an event. Students see the change straight away, and a closed court can't be booked.</p></div></div>
  <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load courts. Check your connection and try again." @retry="load">
  <p v-if="!courts.length" class="muted">No courts available.</p>
  <div v-else class="court-admin-grid">
    <div v-for="c in courts" :key="c.id" class="card court-admin">
      <CourtArt :closed="courtEdit[c.id].status!=='open'" :label="c.name"/>
      <div class="ca-body">
        <div class="row-between"><h2 class="display h-md">{{ c.name }}</h2><span class="chip" :class="c.status==='open' ? 'ok' : 'crimson'">{{ c.status==='open' ? 'Open' : 'Closed' }}</span></div>
        <div class="seg full" role="radiogroup" :aria-label="c.name + ' status'">
          <button role="radio" :aria-checked="courtEdit[c.id].status==='open'" :class="{on:courtEdit[c.id].status==='open'}" :disabled="pending.has(c.id)" @click="courtEdit[c.id].status='open'">Open</button>
          <button role="radio" :aria-checked="courtEdit[c.id].status==='closed'" :class="{on:courtEdit[c.id].status==='closed'}" :disabled="pending.has(c.id)" @click="courtEdit[c.id].status='closed'">Closed</button>
        </div>
        <div v-if="courtEdit[c.id].status==='closed'" class="field"><label :for="'note-'+c.id">Message for students</label><textarea :id="'note-'+c.id" v-model="courtEdit[c.id].note" :disabled="pending.has(c.id)" rows="3" placeholder="Closed for resurfacing. Reopening date to follow."></textarea></div>
        <p class="muted sm">{{ upcomingOn(c.id) }} upcoming {{ upcomingOn(c.id)===1 ? 'booking' : 'bookings' }} on this court.</p>
        <button class="btn primary block" :disabled="pending.has(c.id)" @click="saveCourt(c)">Save {{ c.name }}</button>
      </div>
    </div>
  </div>
  </LoadState>
</section>
</template>
