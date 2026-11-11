<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { validateAdminCancel } from '../lib/rules.js'
import { fmtDate, fmtLong, range } from '../lib/format.js'
const props = defineProps({ booking:{ type:Object, required:true }, memberFirst:{ type:String, default:null }, busy:Boolean })
const emit = defineEmits(['confirm', 'close'])
const reason = ref(null), note = ref(''), ack1 = ref(false), ack2 = ref(false), errors = ref({})
const dialog = ref(null)
const first = computed(() => props.booking.purpose ? null : props.memberFirst || 'Unknown')
const reasons = ['Court maintenance', 'Club event', 'Member asked', 'Other']
watch(() => props.booking.id, () => { reason.value = null; note.value = ''; ack1.value = false; ack2.value = false; errors.value = {} })
function confirm() {
  if (props.busy) return
  errors.value = validateAdminCancel({ reason:reason.value, note:note.value, ack1:ack1.value, ack2:ack2.value, memberFirst:first.value })
  if (!Object.keys(errors.value).length) emit('confirm', { reason:reason.value, note:note.value.trim() })
}
function close() { if (!props.busy) emit('close') }
let previousFocus
onMounted(() => { previousFocus = document.activeElement; dialog.value?.focus() })
onBeforeUnmount(() => previousFocus?.focus())
function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key !== 'Tab') return
  const controls = [...dialog.value.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)')]
  const target = event.shiftKey ? controls.at(-1) : controls[0]
  if (document.activeElement === dialog.value || document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) {
    event.preventDefault(); target?.focus()
  }
}
</script>
<template>
  <div class="scrim" @click.self="close" @keydown="keydown">
    <div ref="dialog" class="sheet" role="dialog" aria-modal="true" aria-labelledby="admin-sheet-title" tabindex="-1">
      <div class="grab" aria-hidden="true"></div>
      <h2 id="admin-sheet-title" class="display h-md">{{ first ? `Cancel ${first}'s booking?` : 'Cancel this booking?' }}</h2>
      <div class="sheet-sum">
        <div class="t-date"><span class="t-day">{{ Number(booking.date.slice(8)) }}</span><span class="t-mon">{{ fmtDate(booking.date).slice(-3) }}</span></div>
        <div style="min-width:0"><p class="t-title">{{ fmtLong(booking.date).split(' ')[0] }}, {{ range(booking) }}</p><p class="muted sm">{{ booking.courtId === 1 ? 'Court I' : 'Court II' }} <span class="mono">{{ booking.code }}</span>, {{ booking.purpose ? 'Club booking' : first }}</p></div>
      </div>
      <div class="field">
        <h3 id="admin-reason-label" class="label">Reason</h3>
        <div class="reasons" role="group" aria-labelledby="admin-reason-label"><button v-for="r in reasons" :key="r" class="rchip" :class="{on:reason===r}" :aria-pressed="reason===r" :disabled="busy" @click="reason=r; errors.reason=''">{{ r }}</button></div>
        <p v-if="errors.reason" class="err" role="alert">{{ errors.reason }}</p>
      </div>
      <div class="field">
        <label for="cancel-note">{{ first ? 'Message to ' + first : 'Note for the log' }}</label>
        <textarea id="cancel-note" v-model="note" rows="3" maxlength="400" :disabled="busy" placeholder="The court is needed for the inter-faculty final. Sorry for the late change. Please book another hour this week." @input="errors.note=''"></textarea>
        <p v-if="errors.note" class="err" role="alert">{{ errors.note }}</p>
      </div>
      <label class="agree" for="ack-1"><input id="ack-1" v-model="ack1" type="checkbox" :disabled="busy" @change="errors.ack=''"><span>I've checked this is the right booking: {{ booking.code }}, {{ fmtDate(booking.date) }}, {{ range(booking) }}.</span></label>
      <label v-if="first" class="agree" for="ack-2"><input id="ack-2" v-model="ack2" type="checkbox" :disabled="busy" @change="errors.ack=''"><span>{{ first }} loses this hour and sees my message. This can't be undone.</span></label>
      <p v-if="errors.ack" class="err" role="alert">{{ errors.ack }}</p>
      <div class="sheet-btns"><button class="btn ghost" :disabled="busy" @click="close">Keep booking</button><button class="btn danger" :disabled="busy" @click="confirm">Cancel booking</button></div>
    </div>
  </div>
</template>
