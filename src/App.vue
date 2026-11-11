<script setup>
import AppShell from './components/AppShell.vue'
</script>
<template>
  <router-view v-slot="{ Component, route }">
    <AppShell v-if="route.meta.auth"><component :is="Component" /></AppShell>
    <component :is="Component" v-else />
  </router-view>
</template>
