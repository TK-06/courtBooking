<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import * as api from '../../lib/api.js'
import { fmtStamp as stamp, fmtRel as relative } from '../../lib/format.js'
import LoadState from '../../components/LoadState.vue'
const now = ref(new Date())
const loading = ref(true), error = ref(false)
const profiles = ref([]), bookings = ref([]), events = ref([])
const member = id => profiles.value.find(m => m.id === id) || { fullName:'Unknown', studentId:'', program:'' }
const initials = name => name.split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('')
const fmtStamp = date => stamp(date, now.value)
const mSearch=ref(''), memberFilter=ref(null), evKind=ref('all')
const evTabs=[{id:'all',label:'All'},{id:'booking',label:'Bookings'},{id:'loan',label:'Equipment'},{id:'court',label:'Courts'}]
const sortedEvents=computed(()=>[...events.value].sort((a,b)=>b.createdAt-a.createdAt))
const memberRows=computed(()=> {
  const q=mSearch.value.trim().toLowerCase()
  return profiles.value.filter(m=>m.role==='student'&&(!q||m.fullName.toLowerCase().includes(q)||(m.studentId||'').includes(q))).map(m=>{
    const last=sortedEvents.value.find(e=>e.userId===m.id)
    return {...m,bookings:bookings.value.filter(b=>b.userId===m.id&&b.status!=='cancelled').length,last:last?relative(last.createdAt,now.value):'No activity'}
  })
})
const filteredEvents=computed(()=>sortedEvents.value.filter(e=>(!memberFilter.value||e.userId===memberFilter.value)&&(evKind.value==='all'||e.kind.startsWith(evKind.value+'.'))))
let unsubscribe, clock, disposed=false
async function load() {
  loading.value=true; error.value=false; now.value=new Date()
  try {
    const [members,allBookings,log]=await Promise.all([api.fetchProfiles(),api.fetchBookings({from:'0001-01-01',to:'9999-12-31'}),api.fetchEvents({limit:10000})])
    if(disposed) return
    profiles.value=members; bookings.value=allBookings
    const merged=new Map(log.map(e=>[e.id,e])); for(const e of events.value) merged.set(e.id,e)
    events.value=[...merged.values()]
  } catch { if(!disposed) error.value=true }
  finally { if(!disposed) loading.value=false }
}
onMounted(()=>{
  clock = setInterval(() => { now.value = new Date() }, 60000)
  unsubscribe=api.subscribeEvents(event=>{
    if(disposed) return
    now.value=new Date()
    events.value=[event,...events.value.filter(e=>e.id!==event.id)]
    if(event.kind.startsWith('booking.')) {
      loading.value=true
      api.fetchBookings({from:'0001-01-01',to:'9999-12-31'})
        .then(rows=>{if(!disposed) bookings.value=rows})
        .catch(()=>{if(!disposed) error.value=true})
        .finally(()=>{if(!disposed) loading.value=false})
    }
  })
  void load()
})
onBeforeUnmount(()=>{disposed=true;clearInterval(clock);unsubscribe?.()})

</script>
<template>
<section class="screen">
  <div class="page-head"><h1 class="display h-lg">Members and activity</h1></div>
  <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load members and activity. Check your connection and try again." @retry="load">
  <div class="members-grid">
    <div>
      <input id="m-search" type="search" v-model="mSearch" placeholder="Search name or student ID" aria-label="Search members">
      <ul class="mlist">
        <li><button class="mrow all" :class="{on: !memberFilter}" @click="memberFilter=null"><span>All members</span><span class="muted sm">{{ events.length }} actions</span></button></li>
        <li v-for="m in memberRows" :key="m.id"><button class="mrow" :class="{on: memberFilter===m.id}" @click="memberFilter=m.id">
          <span class="avatar sm">{{ initials(m.fullName) }}</span>
          <span class="mr-info"><strong>{{ m.fullName }}</strong><span class="muted sm">{{ m.studentId }}, {{ m.program }}</span></span>
          <span class="mr-stats"><span>{{ m.bookings }} bookings</span><span class="muted sm">{{ m.last }}</span></span>
        </button></li>
      </ul>
      <p v-if="!memberRows.length" class="muted">No members match.</p>
    </div>
    <div class="card">
      <div class="act-head">
        <h2 class="display h-sm">{{ memberFilter ? member(memberFilter).fullName : 'All activity' }}</h2>
        <div class="seg" role="tablist"><button v-for="t in evTabs" :key="t.id" role="tab" :aria-selected="evKind===t.id" :class="{on: evKind===t.id}" @click="evKind=t.id">{{ t.label }}</button></div>
      </div>
      <div class="table-wrap flat">
        <table>
          <thead><tr><th>When</th><th>Member</th><th>Action</th><th>Logged by</th></tr></thead>
          <tbody>
            <tr v-for="e in filteredEvents" :key="e.id">
              <td>{{ fmtStamp(e.createdAt) }}</td><td>{{ member(e.userId).fullName }}</td><td class="wrap">{{ e.text }}</td>
              <td><span class="chip" :class="e.source==='Make.com' ? 'camel' : 'muted'">{{ e.source }}</span></td>
            </tr>
            <tr v-if="!filteredEvents.length"><td colspan="4" class="empty-cell">No activity yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  </LoadState>
</section>
</template>
