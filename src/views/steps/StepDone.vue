<script setup>
import { computed } from 'vue'
import { fmtDate, fmtLong, hoursText, range } from '../../lib/format.js'
import ClubLogo from '../../components/ClubLogo.vue'
const props = defineProps({ booking:{ type:Object, required:true }, firstName:{ type:String, default:'' }, role:{ type:String, default:'student' } })
const emit = defineEmits(['open', 'home'])
const courtName = computed(() => props.booking.courtId === 1 ? 'Court I' : 'Court II')
</script>
<template>
  <div class="step s4"><div class="done">
    <club-logo class="done-logo" />
    <h1 class="display h-xl">{{ booking.purpose ? 'Booked for the club.' : "You're booked." }}</h1>
    <p class="muted">{{ booking.purpose ? 'The hours are on the schedule. Students see them as taken.' : 'See you on ' + courtName + ', ' + firstName + '.' }}</p>
    <div class="ticket">
      <div class="ticket-body" style="padding-top:18px">
        <div class="t-date"><span class="t-day">{{ Number(booking.date.slice(8)) }}</span><span class="t-mon">{{ fmtDate(booking.date).split(' ')[2] }}</span></div>
        <div class="t-info"><p class="t-title">{{ fmtLong(booking.date).split(' ')[0] }}, {{ range(booking) }}</p><p class="t-sub">{{ courtName }}, {{ hoursText(booking.end - booking.start) }}</p></div>
      </div>
      <div class="ticket-foot"><span class="code">{{ booking.code }}</span><span class="chip ok">Confirmed</span></div>
    </div>
    <div class="done-btns"><button class="btn primary" @click="emit('open', booking.id)">View booking</button><button class="btn ghost" @click="emit('home')">{{ role==='admin' ? 'All bookings' : 'Back to home' }}</button></div>
  </div></div>
</template>
