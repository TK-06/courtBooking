<script setup>
import { getCurrentInstance, onMounted, onUnmounted, ref } from 'vue'
import { fmtDate, fmtLong, range } from '../lib/format.js'
const props = defineProps({ booking:{ type:Object, required:true }, busy:Boolean })
const emit = defineEmits(['confirm', 'close'])
const reason = ref(null)
const dialog = ref(null)
const titleId = 'cancel-title-' + getCurrentInstance().uid
const reasons = ["Can't make it", 'Weather', 'Found another time', 'Other']
let previousFocus
function close() { if (!props.busy) emit('close') }
function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key !== 'Tab') return
  const buttons = [...dialog.value.querySelectorAll('button:not(:disabled)')]
  if (!buttons.length) { event.preventDefault(); return }
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(() => {
  previousFocus = document.activeElement
  dialog.value.focus()
  document.addEventListener('keydown', keydown)
})
onUnmounted(() => { document.removeEventListener('keydown', keydown); previousFocus?.focus() })
</script>
<template>
  <div class="scrim" @click.self="close">
    <div ref="dialog" class="sheet" role="dialog" tabindex="-1" aria-modal="true" :aria-labelledby="titleId" :aria-busy="busy">
      <div class="grab" aria-hidden="true"></div>
      <h2 :id="titleId" class="display h-md">Cancel this booking?</h2>
      <div class="sheet-sum">
        <div class="t-date"><span class="t-day">{{ Number(booking.date.slice(8)) }}</span><span class="t-mon">{{ fmtDate(booking.date).split(' ')[2] }}</span></div>
        <div style="min-width:0"><p class="t-title">{{ fmtLong(booking.date).split(' ')[0] }}, {{ range(booking) }}</p><p class="muted sm">{{ booking.courtId===1 ? 'Court I' : 'Court II' }} <span class="mono">{{ booking.code }}</span></p></div>
      </div>
      <p class="muted sm">The hour goes back on the board for other students.</p>
      <h3 class="label">Reason, if you want to give one</h3>
      <div class="reasons"><button v-for="r in reasons" :key="r" class="rchip" :class="{ on:reason===r }" :aria-pressed="reason===r" :disabled="busy" @click="reason=reason===r ? null : r">{{ r }}</button></div>
      <div class="sheet-btns"><button class="btn ghost" :disabled="busy" @click="close">Keep booking</button><button class="btn danger" :disabled="busy" @click="emit('confirm', { reason })">Cancel booking</button></div>
    </div>
  </div>
</template>
