<script setup>
import { getCurrentInstance } from 'vue'
const uid = 'str' + getCurrentInstance().uid
</script>
<template>
<svg viewBox="0 0 80 150" class="racket-art" aria-hidden="true" focusable="false">
    <defs><clipPath :id="uid"><ellipse cx="40" cy="50" rx="25.5" ry="35.5"/></clipPath></defs>
    <g :clip-path="'url(#' + uid + ')'" class="strings"><line v-for="i in 9" :key="'v' + i" :x1="12 + i * 5.6" y1="10" :x2="12 + i * 5.6" y2="90"/><line v-for="i in 12" :key="'h' + i" x1="10" :y1="13 + i * 6" x2="70" :y2="13 + i * 6"/></g>
    <ellipse cx="40" cy="50" rx="28" ry="38" class="frame"/>
    <path d="M29 84 L40 104 L51 84" class="throat"/>
    <rect x="35.5" y="102" width="9" height="42" rx="3" class="grip"/>
    <path d="M35.5 112 l9 -4 M35.5 120 l9 -4 M35.5 128 l9 -4 M35.5 136 l9 -4" class="wrap"/>
  </svg>
</template>
<style scoped>
.racket-art .frame{fill:none;stroke:var(--crimson);stroke-width:5}
.racket-art .throat{fill:none;stroke:var(--crimson);stroke-width:3.5;stroke-linejoin:round}
.racket-art .strings line{stroke:var(--camel);stroke-width:.9}
.racket-art .grip{fill:var(--ink)}
.racket-art .wrap{stroke:var(--paper-2);stroke-width:1.2;opacity:.45;fill:none}
</style>
