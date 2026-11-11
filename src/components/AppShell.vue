<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import Icon from './Icon.vue'
import ClubLogo from './ClubLogo.vue'
import Toast from './Toast.vue'
import '../styles/shell.css'
const route = useRoute()
const router = useRouter()
const { profile, isAdmin, mode, setMode, signOut } = useAuth()
const { show } = useToast()
const screen = computed(() => route.name)
const navItems = computed(() => mode.value === 'admin' ? [
  {id:'admin-today', label:'Today', short:'Today', icon:'grid'},
  {id:'admin-bookings', label:'Bookings', short:'Bookings', icon:'calendar'},
  {id:'admin-courts', label:'Courts', short:'Courts', icon:'court'},
  {id:'admin-equipment', label:'Equipment', short:'Equipment', icon:'ball'},
  {id:'admin-members', label:'Members and log', short:'Members', icon:'users'},
] : [
  {id:'home', label:'Home', short:'Home', icon:'home'},
  {id:'bookings', label:'My bookings', short:'Bookings', icon:'list'},
  {id:'borrow', label:'Borrow equipment', short:'Borrow', icon:'racket'},
  {id:'club', label:'Club and contact', short:'Club', icon:'pin'},
  {id:'profile', label:'Profile', short:'Profile', icon:'user'},
])
const initials = name => name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('')
function navOn(id) {
  return screen.value === id || (screen.value === 'booking/:id' && id === (mode.value === 'admin' ? 'admin-bookings' : 'bookings'))
}
const go = name => router.push({ name })
const startBooking = () => go('book')
async function switchMode() {
  try { await setMode(mode.value === 'admin' ? 'student' : 'admin') }
  catch (error) { show(error.message) }
}
async function logout() {
  try { await signOut() } catch (error) { show(error.message) }
}
</script>
<template>
<div class="shell authed" :class="{ flow:screen==='book' }">

  <aside class="side">
    <div class="brand"><club-logo variant="mark" :size="40"></club-logo><span class="wordmark">Intania<br>Tennis Club</span></div>
    <button class="btn primary block" @click="startBooking()">{{ mode==='admin' ? 'Book for the club' : 'Book a court' }}</button>
    <nav class="nav" aria-label="Main">
      <button v-for="t in navItems" :key="t.id" :class="{on: navOn(t.id)}" :aria-current="navOn(t.id) ? 'page' : null" @click="go(t.id)"><icon :name="t.icon"></icon>{{ t.label }}</button>
    </nav>
    <div class="side-foot">
      <button v-if="isAdmin" class="nav-switch" @click="switchMode()"><icon name="shield"></icon>{{ mode==='admin' ? 'Switch to student view' : 'Open admin' }}</button>
      <div class="side-user"><span class="avatar sm">{{ initials(profile?.fullName || '') }}</span><div style="min-width:0"><strong>{{ profile?.fullName || '' }}</strong><span>{{ profile?.role==='admin' ? 'Club admin' : profile?.program + ', year ' + profile?.year }}</span></div></div>
      <button class="linkbtn" @click="logout()">Sign out</button>
      <p class="side-note">Student project for an ISE course assignment.</p>
    </div>
  </aside>

  <div class="main">
    <header v-if="screen!=='book'" class="top">
      <div class="top-brand"><club-logo variant="mark" :size="30"></club-logo><span class="wordmark">ITC</span><span v-if="mode==='admin'" class="chip crimson">Admin</span></div>
      <div class="top-actions">
        <button v-if="isAdmin" class="icon-btn" :aria-label="mode==='admin' ? 'Switch to student view' : 'Open admin'" @click="switchMode()"><icon name="shield"></icon></button>
        <button v-if="mode==='student'" class="avatar-btn" aria-label="Open your profile" @click="go('profile')">{{ initials(profile?.fullName || '') }}</button>
      </div>
    </header>

    
    <main class="page"><slot /></main>
  </div>
<nav v-if="screen!=='book'" class="tabs" aria-label="Sections">
    <button v-for="t in navItems" :key="t.id" class="tab" :class="{on: navOn(t.id)}" :aria-current="navOn(t.id) ? 'page' : null" @click="go(t.id)"><icon :name="t.icon" :size="22"></icon><span>{{ t.short }}</span></button>
  </nav>
<Toast />
</div>
</template>
