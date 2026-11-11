<template>
<svg viewBox="0 0 80 150" class="balls-art" aria-hidden="true" focusable="false">
    <rect x="18" y="16" width="44" height="124" rx="10" class="can"/>
    <rect x="15" y="9" width="50" height="12" rx="4" class="lid"/>
    <g v-for="y in [44, 80, 116]" :key="y"><circle cx="40" :cy="y" r="16.5" class="ball"/><path :d="'M25.5 ' + (y - 7) + ' q14.5 9 29 0 M25.5 ' + (y + 7) + ' q14.5 -9 29 0'" class="seam"/></g>
  </svg>
</template>
<style scoped>
.balls-art .can{fill:var(--sunk);stroke:var(--rule-strong);stroke-width:1.5}
.balls-art .lid{fill:var(--crimson)}
.balls-art .ball{fill:var(--ball)}
.balls-art .seam{fill:none;stroke:var(--paper-2);stroke-width:2.2;stroke-linecap:round}
</style>
