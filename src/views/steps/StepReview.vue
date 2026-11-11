<script setup>
import { computed } from 'vue'
import { fmtLong, hoursText, range } from '../../lib/format.js'
import { MESSAGES } from '../../lib/rules.js'
import ClubLogo from '../../components/ClubLogo.vue'
const props = defineProps({ booking:{ type:Object, required:true }, profile:{ type:Object, default:() => ({}) }, role:{ type:String, default:'student' }, agree:Boolean, purpose:{ type:String, default:'' }, agreeError:Boolean, purposeError:Boolean })
const emit = defineEmits(['update:agree', 'update:purpose'])
const admin = computed(() => props.role === 'admin')
const courtName = computed(() => props.booking.courtId === 1 ? 'Court I' : 'Court II')
const rules = [
  { t:'Open every day, 08:00 to 22:00', d:'Courts are booked by the hour. The last hour starts at 21:00.' },
  { t:'Up to 2 hours a day', d:'Two hours on the same day have to be back to back. You can book 14 days ahead.' },
  { t:'Please bring your own equipment', d:'No racket? Borrow one, and a can of balls, for the day.' },
  { t:'Tidy up after your session', d:'Take balls, bottles and towels with you so the court is ready for the next players.' },
  { t:'Cancel at least 2 hours before', d:'That gives someone else time to take the hour.' },
  { t:'Arrive on time', d:'Your hour ends on the hour, whenever you start.' },
]
</script>
<template>
  <div class="step s3">
    <div class="s3-main"><div class="ticket">
      <div class="ticket-top" style="padding-right:20px"><p class="label">Your booking</p></div>
      <dl class="dl">
        <div class="wide"><dt class="label">Date</dt><dd class="big">{{ fmtLong(booking.date) }}</dd></div>
        <div><dt class="label">Time</dt><dd class="big">{{ range(booking) }}</dd></div>
        <div><dt class="label">Court</dt><dd class="big">{{ courtName }}</dd></div>
        <div><dt class="label">Duration</dt><dd>{{ hoursText(booking.end - booking.start) }}</dd></div>
        <div><dt class="label">{{ admin ? 'Booked by' : 'Player' }}</dt><dd>{{ admin ? 'The club (' + (profile.fullName || '').split(' ')[0] + ')' : profile.fullName }}</dd></div>
        <div v-if="!admin"><dt class="label">Student ID</dt><dd class="mono">{{ profile.studentId }}</dd></div>
      </dl>
      <div class="ticket-foot"><span class="code">Code issued when you confirm</span><club-logo variant="mark" :size="26" /></div>
    </div></div>
    <div v-if="admin" class="s3-rules">
      <h2 class="display h-md">Club booking</h2>
      <p class="muted">Students see these hours as booked by the club. Nobody's existing booking is replaced.</p>
    </div>
    <div v-else class="s3-rules">
      <h2 class="display h-md">Court rules</h2>
      <ul class="rules"><li v-for="r in rules" :key="r.t"><strong>{{ r.t }}</strong><span>{{ r.d }}</span></li></ul>
      <label class="agree" for="agree"><input id="agree" type="checkbox" :checked="agree" @change="emit('update:agree', $event.target.checked)"><span>I've read the court rules.</span></label>
      <p v-if="agreeError" class="err" role="alert">Tick the box to confirm you've read the rules.</p>
    </div>
  </div>
</template>
