<script setup>
defineProps({ variant:{ type:String, default:'full' }, size:Number })
</script>
<template>
  <span class="logo" :class="variant==='mark' ? 'logo-mark' : ''" :style="size ? { width:size + 'px', height:size + 'px' } : null" role="img" aria-label="Intania Tennis Club"></span>
</template>
