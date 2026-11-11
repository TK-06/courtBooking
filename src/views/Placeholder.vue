<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>
<template>
  <section class="screen"><h1 class="display h-xl">{{ route.meta.title }}</h1></section>
</template>
