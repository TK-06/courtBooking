<script setup>
import { useToast } from '../composables/useToast.js'
const { message } = useToast()
</script>
<template>
  <div class="toast-region" aria-live="polite" aria-atomic="true"><div v-if="message" :key="message" class="toast">{{ message }}</div></div>
</template>
<style>
.toast-region{position:fixed;left:0;right:0;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;justify-content:center;pointer-events:none;padding:0 16px}
.shell.flow .toast-region{bottom:calc(96px + env(safe-area-inset-bottom,0px))}
@media (min-width:980px){.shell.authed .toast-region{left:var(--side);bottom:32px}.shell.flow .toast-region{bottom:110px}}
.toast{background:var(--ink);color:var(--paper);padding:12px 18px;border-radius:var(--r-m);font-size:14px;max-width:440px;animation:up .25s var(--ease-enter)}
</style>
