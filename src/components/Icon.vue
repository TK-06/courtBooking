<script setup>
import { computed } from 'vue'
const props = defineProps({ name:String, size:{ type:Number, default:20 } })
const ICONS = {
  home:'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  list:'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  racket:'M14 3.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11zM10.2 12.8L4 19M3 18l2 2',
  pin:'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z',
  user:'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4.5 20.5c0-3.8 3.4-5.8 7.5-5.8s7.5 2 7.5 5.8',
  shield:'M12 3l7 3v5.2c0 4.6-3 8.3-7 9.8c-4-1.5-7-5.2-7-9.8V6z',
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendar:'M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  court:'M5 3h14v18H5zM5 12h14M8 3v18M16 3v18M8 7.5h8M8 16.5h8M12 7.5v9',
  ball:'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8',
  users:'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.5 2.3 3.5 5.2',
  dots:'M5 12h.01M12 12h.01M19 12h.01',
  x:'M6 6l12 12M18 6L6 18',
  left:'M15 5l-7 7 7 7',
  right:'M9 5l7 7-7 7',
  plus:'M12 5v14M5 12h14',
  minus:'M5 12h14',
  ticket:'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v12',
  phone:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  ext:'M7 17L17 7M8 7h9v9',
  copy:'M9 9h11v11H9zM5 15H4V4h11v1',
  edit:'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  logout:'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10'
}
const d = computed(() => ICONS[props.name] || '')
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="name==='dots' ? 3 : 1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="d"/></svg>
</template>
