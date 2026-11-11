<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as api from '../../lib/api.js'
import { useToast } from '../../composables/useToast.js'
import { todayIso } from '../../lib/time.js'
import { fmtDate, itemsText } from '../../lib/format.js'
import LoadState from '../../components/LoadState.vue'
const { show } = useToast()
const now = ref(new Date())
const today = computed(() => todayIso(now.value))
const loading = ref(true), error = ref(false)
const profiles = ref([]), loans = ref([]), equipment = ref([])
const member = id => profiles.value.find(m => m.id === id) || { fullName:'Unknown', studentId:'', program:'' }
const loanLabel = s => ({ reserved:'Reserved', out:'Picked up', returned:'Returned' })[s]
const loanChip = s => ({ reserved:'ok', out:'warn', returned:'muted' })[s]
const aeTab=ref('today'), pending=ref(new Set()), free=ref({})
const aeTabs=[{id:'today',label:'Today'},{id:'upcoming',label:'Upcoming'},{id:'history',label:'History'}]
const capital = text => text.charAt(0).toUpperCase()+text.slice(1)
const availFor = (_date,id) => free.value[id] ?? 0
const kpis = computed(() => ({kit:loans.value.filter(l => l.status==='out').reduce((n,l) => n+l.racket+l.balls,0)}))
const adminLoans = computed(() => loans.value.filter(l => aeTab.value==='today' ? l.date===today.value : aeTab.value==='upcoming' ? l.date>today.value : l.status==='returned'||l.date<today.value).sort((a,b)=>a.date.localeCompare(b.date)))
async function setLoan(loan,status) {
  if(pending.value.has(loan.id)) return
  pending.value.add(loan.id)
  try {
    const updated=await api.setLoanStatus(loan.id,status)
    loans.value=loans.value.map(l=>l.id===loan.id?updated:l)
    show(status==='out'?'Marked as picked up.':'Marked as returned.')
    loading.value=true
    try { free.value=await api.fetchAvailability(today.value) }
    catch { error.value=true }
    finally { loading.value=false }
  } catch(cause) { show(cause.message) }
  finally { pending.value.delete(loan.id) }
}
async function load() {
  loading.value=true; error.value=false; now.value=new Date()
  try { [equipment.value,loans.value,profiles.value,free.value]=await Promise.all([api.fetchEquipment(),api.fetchLoans(),api.fetchProfiles(),api.fetchAvailability(today.value)]) }
  catch { error.value=true }
  finally { loading.value=false }
}
let clock
watch(today, load)
onMounted(() => { void load(); clock = setInterval(() => { now.value = new Date() }, 60000) })
onBeforeUnmount(() => clearInterval(clock))

</script>
<template>
<section class="screen">
  <div class="page-head"><h1 class="display h-lg">Equipment</h1></div>
  <LoadState :state="loading ? 'loading' : error ? 'error' : 'ready'" message="Couldn't load equipment. Check your connection and try again." @retry="load">
  <div class="admin-content"><div class="kpis three">
    <div v-for="it in equipment" :key="it.id" class="kpi"><div class="v">{{ availFor(today, it.id) }}<small>/{{ it.total }}</small></div><div class="l">{{ it.plural }} free today</div></div>
    <div class="kpi"><div class="v">{{ kpis.kit }}</div><div class="l">Items out right now</div></div>
  </div>
  <p v-if="!equipment.length" class="muted">No equipment available.</p>
  <div class="toolbar">
    <div class="seg" role="tablist"><button v-for="t in aeTabs" :key="t.id" role="tab" :aria-selected="aeTab===t.id" :class="{on: aeTab===t.id}" @click="aeTab=t.id">{{ t.label }}</button></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Member</th><th>Items</th><th>Day</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="l in adminLoans" :key="l.id">
          <td>{{ member(l.userId).fullName }}</td><td>{{ capital(itemsText(l)) }}</td><td>{{ fmtDate(l.date) }}</td>
          <td><span class="chip" :class="loanChip(l.status)">{{ loanLabel(l.status) }}</span></td>
          <td class="right"><button v-if="l.status==='reserved' && l.date===today" class="btn ghost small" :disabled="pending.has(l.id)" @click="setLoan(l, 'out')">Mark picked up</button><button v-if="l.status==='out'" class="btn primary small" :disabled="pending.has(l.id)" @click="setLoan(l, 'returned')">Mark returned</button></td>
        </tr>
        <tr v-if="!adminLoans.length"><td colspan="5" class="empty-cell">No loans here.</td></tr>
      </tbody>
    </table>
  </div>
</div>
  </LoadState>
</section>
</template>
