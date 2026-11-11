<script setup>
import { computed, ref, watch } from 'vue'
import { hh, range } from '../../lib/format.js'
import CourtArt from '../../components/CourtArt.vue'
const props = defineProps({
  slots:{ type:Array, default:() => [] }, role:{ type:String, default:'student' }, courtId:Number,
  courts:{ type:Array, default:() => [] }, profiles:{ type:Array, default:() => [] }, openCounts:{ type:Object, default:() => ({}) },
})
const emit = defineEmits(['select', 'court', 'open-bookings'])
const admin = computed(() => props.role === 'admin')
const blocked = ref(null)
watch(() => [props.courtId, props.slots], () => { blocked.value = null })
const courtName = computed(() => props.courts.find(c => c.id === props.courtId)?.name || '')
const member = booking => props.profiles.find(p => p.id === booking?.userId)?.fullName || 'Unknown'
const booker = booking => booking.purpose ? 'Club booking' : member(booking)
function slotLabel(slot) {
  if (admin.value && (slot.state === 'booked' || slot.state === 'mine')) {
    return slot.b?.purpose || slot.state === 'mine' ? 'Club' : member(slot.b).split(' ')[0]
  }
  return { open:'Open', selected:'Selected', booked:'Booked', mine:'Your booking', past:'Past', closed:'Closed' }[slot.state]
}
function select(slot) {
  if (admin.value && (slot.state === 'booked' || slot.state === 'mine') && slot.b) {
    blocked.value = { h:slot.h, booking:slot.b }
    return
  }
  blocked.value = null
  emit('select', slot)
}
</script>
<template>
  <div class="step s2">
    <div class="s2-courts">
      <h2 class="label">Court</h2>
      <div class="mini-courts">
        <button v-for="c in courts" :key="c.id" class="mini-court" :class="{ on:courtId===c.id && c.status==='open', closed:c.status!=='open' }" :aria-pressed="courtId===c.id" @click="emit('court', c.id)">
          <court-art :closed="c.status!=='open'" :label="c.name" />
          <span class="mc-name">{{ c.name }}</span><span class="mc-sub">{{ c.status==='open' ? (openCounts[c.id] || 0) + ' hours open' : 'Closed' }}</span>
        </button>
      </div>
    </div>
    <div class="s2-times">
      <div class="row-between"><h2 class="label">Hours on {{ courtName }}</h2><p class="hint">{{ admin ? 'Any number of hours, back to back' : 'Up to 2 hours a day, back to back' }}</p></div>
      <div class="legend left"><span><i class="lg sq"></i>Open</span><span><i class="lg sq lg-sel"></i>Selected</span><span><i class="lg sq lg-booked"></i>Booked or past</span><span v-if="!admin"><i class="lg sq lg-mine"></i>Yours</span></div>
      <div class="slots">
        <button v-for="s in slots" :key="s.h" class="slot" :class="['s-' + s.state, { held:blocked && blocked.h===s.h, tap:admin && (s.state==='booked' || s.state==='mine') }]" :aria-pressed="s.state==='selected'" :aria-label="hh(s.h) + ' to ' + hh(s.h + 1) + ', ' + slotLabel(s)" @click="select(s)">
          <span class="slot-time">{{ hh(s.h) }}</span><span class="slot-end">until {{ hh(s.h + 1) }}</span><span class="slot-state">{{ slotLabel(s) }}</span>
        </button>
      </div>
      <div v-if="blocked" class="blocked" role="status">
        <p><strong>{{ hh(blocked.h) }} belongs to {{ booker(blocked.booking) }}</strong> ({{ blocked.booking.code }}, {{ range(blocked.booking) }}).</p>
        <p class="muted sm">Club bookings never replace a student's booking. To free this hour, cancel theirs under Bookings and explain why.</p>
        <div class="blocked-btns"><button class="btn ghost small" @click="emit('open-bookings', blocked.booking)">Open in Bookings</button><button class="linkbtn" style="color:var(--ink-2)" @click="blocked=null">Dismiss</button></div>
      </div>
    </div>
  </div>
</template>
