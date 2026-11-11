<script setup>
import { getCurrentInstance } from 'vue'
defineProps({ closed:Boolean, label:String })
const uid = 'hatch' + getCurrentInstance().uid
</script>
<template>
<svg class="court-art" :class="{closed}" viewBox="0 0 150 298" role="img" :aria-label="(label || 'Court') + (closed ? ', closed' : '')">
    <defs><pattern :id="uid" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" class="hatch-line"/></pattern></defs>
    <rect x="0" y="0" width="150" height="298" rx="4" class="apron"/>
    <rect x="20.15" y="30.15" width="109.7" height="237.7" class="surface"/>
    <g class="lines" fill="none" stroke-width="1.6">
      <rect x="20.15" y="30.15" width="109.7" height="237.7"/>
      <line x1="33.85" y1="30.15" x2="33.85" y2="267.85"/><line x1="116.15" y1="30.15" x2="116.15" y2="267.85"/>
      <line x1="33.85" y1="85" x2="116.15" y2="85"/><line x1="33.85" y1="213" x2="116.15" y2="213"/>
      <line x1="75" y1="85" x2="75" y2="213"/><line x1="75" y1="30.15" x2="75" y2="34.5"/><line x1="75" y1="267.85" x2="75" y2="263.5"/>
    </g>
    <line x1="9" y1="149" x2="141" y2="149" class="net" stroke-width="2.6"/>
    <circle cx="9" cy="149" r="2.8" class="post"/><circle cx="141" cy="149" r="2.8" class="post"/>
    <g v-if="closed">
      <rect x="0" y="0" width="150" height="298" rx="4" :fill="'url(#' + uid + ')'"/>
      <rect x="33" y="136" width="84" height="26" rx="2" class="plaque"/>
      <text x="75" y="153" text-anchor="middle" class="plaque-t">CLOSED</text>
    </g>
  </svg>
</template>
<style scoped>
.court-art{display:block}
.court-art .apron{fill:var(--apron)}
.court-art .surface{fill:var(--court)}
.court-art .lines,.court-art .net{stroke:var(--line)}
.court-art .post{fill:var(--line)}
.court-art.closed .apron{fill:var(--closed-apron)}
.court-art.closed .surface{fill:var(--closed)}
.court-art.closed .lines,.court-art.closed .net{stroke:var(--closed-line)}
.court-art.closed .post{fill:var(--closed-line)}
.court-art .hatch-line{stroke:var(--closed-line);stroke-width:2;opacity:.55}
.court-art .plaque{fill:var(--paper-2)}
.court-art .plaque-t{font:700 10px var(--f-label);font-stretch:125%;letter-spacing:2px;fill:var(--closed-ink)}
</style>
