<script setup>
defineProps({
  state:{ type:String, required:true, validator:value => ['loading','error','ready'].includes(value) },
  message:{ type:String, default:'' },
})
const emit = defineEmits(['retry'])
</script>
<template>
  <p v-if="state==='loading'" class="load-state muted" role="status">Loading…</p>
  <div v-else-if="state==='error'" class="load-state">
    <p role="alert">{{ message }}</p>
    <button type="button" class="btn ghost small" @click="emit('retry')">Try again</button>
  </div>
  <slot v-else />
</template>
