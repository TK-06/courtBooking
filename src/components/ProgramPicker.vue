<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { PROGRAMS, programByCode, searchPrograms } from '../lib/programs.js'
const props = defineProps({ modelValue:{ type:String, default:'' }, labelledby:{ type:String, default:'' } })
const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const query = ref('')
const trigger = ref(null)
const sheet = ref(null)
const searchBox = ref(null)
const selected = computed(() => programByCode(props.modelValue))
const groups = computed(() => searchPrograms(query.value))
const shownQuery = computed(() => query.value.trim())
let previousOverflow = null

function lockScroll(locked) {
  if (locked && previousOverflow === null) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else if (!locked && previousOverflow !== null) {
    document.body.style.overflow = previousOverflow
    previousOverflow = null
  }
}
async function show() {
  query.value = ''
  open.value = true
  lockScroll(true)
  await nextTick()
  searchBox.value?.focus()
}
async function close() {
  open.value = false
  lockScroll(false)
  await nextTick()
  trigger.value?.focus()
}
function choose(code) {
  emit('update:modelValue', code)
  void close()
}
// Keep Tab inside the sheet while it is open.
function trap(event) {
  const items = [...sheet.value.querySelectorAll('button, input')]
  if (!items.length) return
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onBeforeUnmount(() => lockScroll(false))
</script>

<template>
<div class="pp">
  <button ref="trigger" id="f-program" type="button" class="pp-trigger" aria-haspopup="dialog" :aria-expanded="open" :aria-labelledby="labelledby ? labelledby + ' f-program' : null" @click="show">
    <template v-if="selected">
      <span class="pp-badge">{{ selected.code }}</span>
      <span class="pp-text">
        <span class="pp-name">{{ selected.name }}</span>
        <span class="pp-kind">{{ selected.group === 'ise' ? 'ISE · international program' : 'Regular program' }}</span>
      </span>
    </template>
    <span v-else class="pp-placeholder">Choose your program</span>
    <svg class="pp-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  <div v-if="open" class="pp-scrim" @click.self="close" @keydown.esc.stop.prevent="close" @keydown.tab="trap">
    <div ref="sheet" class="pp-sheet" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <div class="pp-head">
        <span class="pp-grab" aria-hidden="true"></span>
        <div class="pp-title-row">
          <div>
            <h2 id="pp-title" class="display pp-title">Your program</h2>
            <p class="pp-sub">Faculty of Engineering · {{ PROGRAMS.length }} programs</p>
          </div>
          <button type="button" class="pp-done" @click="close">Done</button>
        </div>
        <input ref="searchBox" v-model="query" type="search" class="pp-search" aria-label="Search programs" placeholder="Search, e.g. computer or AERO" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      </div>
      <div class="pp-list">
        <section v-for="group in groups" :key="group.id" class="pp-group">
          <h3 class="pp-group-h">{{ group.title }}
            <span class="pp-group-note">{{ group.note }}</span></h3>
          <button v-for="program in group.programs" :key="program.code" type="button" class="prog-opt" :class="{ on:program.code === modelValue }" :aria-pressed="program.code === modelValue" @click="choose(program.code)">
            <span class="prog-code">{{ program.code }}</span>
            <span class="prog-name">{{ program.name }}</span>
            <svg v-if="program.code === modelValue" class="prog-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          </button>
        </section>
        <p v-if="!groups.length" class="pp-empty">No program matches “{{ shownQuery }}”. Try the short code, like ICE or CEDT.</p>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.pp-trigger{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 12px 8px 14px;border-radius:var(--r-s);border:1px solid var(--rule-strong);background:var(--paper-2);font-size:16px;text-align:left;transition:border-color 140ms var(--ease),box-shadow 140ms var(--ease)}
.pp-trigger:focus-visible{outline:none;border-color:var(--crimson);box-shadow:0 0 0 3px var(--crimson-tint)}
.pp-badge{flex:none;min-width:52px;padding:4px 8px;border-radius:var(--r-s);background:var(--crimson-tint);color:var(--crimson);font-family:var(--f-mono);font-size:13px;font-weight:500;letter-spacing:.03em;text-align:center}
.pp-text{display:flex;flex-direction:column;min-width:0;flex:1}
.pp-name{font-size:15px;line-height:1.3;overflow-wrap:anywhere}
.pp-kind{font-size:12px;color:var(--ink-2)}
.pp-placeholder{flex:1;color:var(--ink-3)}
.pp-chev{flex:none;color:var(--ink-3)}

.pp-scrim{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;background:var(--scrim);animation:pp-fade .2s var(--ease)}
.pp-sheet{display:flex;flex-direction:column;width:100%;height:88vh;height:88dvh;border-radius:16px 16px 0 0;background:var(--paper-2);color:var(--ink);overflow:hidden;animation:pp-up .28s var(--ease-enter)}
.pp-head{flex:none;display:flex;flex-direction:column;gap:12px;padding:8px max(20px,env(safe-area-inset-right,0px)) 14px max(20px,env(safe-area-inset-left,0px));border-bottom:1px solid var(--rule)}
.pp-grab{width:40px;height:4px;border-radius:4px;background:var(--rule-strong);margin:0 auto}
.pp-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.pp-title{font-size:26px}
.pp-sub{margin-top:2px;font-size:13px;color:var(--ink-2)}
.pp-done{min-height:44px;min-width:44px;padding:0 4px;color:var(--crimson);font-weight:500;font-size:15px;text-align:right}
.pp-search{width:100%;min-height:48px;border-radius:var(--r-s);border:1px solid var(--rule-strong);background:var(--paper);padding:12px 14px;font:inherit;font-size:16px;color:inherit;transition:border-color 140ms var(--ease),box-shadow 140ms var(--ease)}
.pp-search:focus{outline:none;border-color:var(--crimson);box-shadow:0 0 0 3px var(--crimson-tint)}
.pp-search::placeholder{color:var(--ink-3)}
.pp-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:env(safe-area-inset-bottom,0px)}
.pp-group-h{position:sticky;top:0;z-index:1;display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px max(20px,env(safe-area-inset-right,0px)) 8px max(20px,env(safe-area-inset-left,0px));background:var(--paper-2);border-bottom:1px solid var(--rule);font-family:var(--f-label);font-stretch:125%;font-weight:600;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.pp-group-note{font-weight:500;letter-spacing:.08em;opacity:.85}
.prog-opt{display:grid;grid-template-columns:64px minmax(0,1fr) 20px;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px max(20px,env(safe-area-inset-right,0px)) 8px max(20px,env(safe-area-inset-left,0px));border-bottom:1px solid var(--rule);font-size:15px;text-align:left;transition:background-color 150ms var(--ease)}
.prog-opt:focus-visible{outline:2px solid var(--crimson);outline-offset:-2px}
.prog-code{justify-self:start;min-width:52px;padding:3px 8px;border-radius:var(--r-s);background:var(--sunk);color:var(--ink-2);font-family:var(--f-mono);font-size:13px;letter-spacing:.03em;text-align:center}
.prog-name{line-height:1.3;overflow-wrap:anywhere}
.prog-check{color:var(--crimson)}
.prog-opt.on{background:var(--crimson-tint)}
.prog-opt.on .prog-code{background:var(--paper-2);color:var(--crimson)}
.prog-opt.on .prog-name{font-weight:600}
@media (hover:hover) and (pointer:fine){.prog-opt:not(.on):hover{background:var(--sunk)}}
.pp-empty{padding:28px max(20px,env(safe-area-inset-right,0px));color:var(--ink-2);font-size:14px;text-align:center;overflow-wrap:anywhere}

@media (min-width:900px){
  .pp-scrim{align-items:center}
  .pp-sheet{height:auto;max-width:480px;max-height:80vh;border-radius:var(--r-l)}
  .pp-grab{display:none}
  .pp-head{padding-top:20px}
}
@keyframes pp-fade{from{opacity:0}}
@keyframes pp-up{from{transform:translateY(24px);opacity:.4}}
@media (prefers-reduced-motion:reduce){.pp-scrim,.pp-sheet{animation:none}.pp-trigger,.pp-search,.prog-opt{transition:none}}
</style>
