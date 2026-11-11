<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { MESSAGES, validateSignUp } from '../lib/rules.js'
import ClubLogo from '../components/ClubLogo.vue'
import CourtArt from '../components/CourtArt.vue'
import '../styles/signin.css'
const router = useRouter()
const { signIn, signUp, error:authError } = useAuth()
const authTab = ref('in')
const form = reactive({ name:'', sid:'', email:'', pass:'', program:'ICE', year:1 })
const programs = ['ICE','ADME','AERO','NANO','ChPE','Other']
const formErr = ref('')
const notice = ref('')
const busy = ref(false)
async function submit() {
  if (busy.value) return
  formErr.value = ''
  notice.value = ''
  if (authTab.value === 'up') {
    formErr.value = validateSignUp({ fullName:form.name, studentId:form.sid, email:form.email, password:form.pass, mode:'up' }) || ''
  } else if (form.pass.length < 8) formErr.value = MESSAGES.password
  if (formErr.value) return
  busy.value = true
  try {
    const data = authTab.value === 'in'
      ? await signIn(form.email, form.pass)
      : await signUp({ fullName:form.name, studentId:form.sid, program:form.program, year:form.year, email:form.email, password:form.pass })
    if (!data.session) {
      notice.value = 'Check your email to confirm your account, then sign in.'
      return
    }
    await router.replace({ name:'home' })
  } catch (error) { formErr.value = error.message }
  finally { busy.value = false }
}
</script>
<template>
<div class="signin">
  <div class="si-art">
    <club-logo class="si-logo"></club-logo>
    <court-art class="si-court" label="Tennis court"></court-art>
    <div>
      <h1 class="display si-title">Book a tennis court at CUB 13.</h1>
      <p class="si-sub">Two courts for Chula engineering students, open every day from 08:00 to 22:00.</p>
    </div>
    <p class="si-foot">Student prototype for an ISE course assignment, filled with sample data.</p>
  </div>
  <div class="si-form-wrap">
    <div class="si-form">
      <div class="seg full" role="tablist">
        <button role="tab" :aria-selected="authTab==='in'" :class="{on: authTab==='in'}" @click="authTab='in'; formErr=''">Sign in</button>
        <button role="tab" :aria-selected="authTab==='up'" :class="{on: authTab==='up'}" @click="authTab='up'; formErr=''">Create account</button>
      </div>
      <div>
        <h2 class="display h-lg">{{ authTab==='in' ? 'Sign in with your Chula email' : 'Create your account' }}</h2>
        <p class="muted" style="margin-top:8px">{{ authTab==='in' ? 'The one that ends in @student.chula.ac.th.' : 'You need your student ID and Chula email.' }}</p>
      </div>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p v-if="authError" class="err" role="alert">{{ authError }}</p>
      <form class="form" novalidate :aria-busy="busy" @submit.prevent="submit">
        <div v-if="authTab==='up'" class="field"><label for="f-name">Full name</label><input id="f-name" v-model="form.name" autocomplete="name" placeholder="Napat Srisuk"></div>
        <div v-if="authTab==='up'" class="field"><label for="f-sid">Student ID</label><input id="f-sid" v-model="form.sid" inputmode="numeric" placeholder="6638012321"></div>
        <div v-if="authTab==='up'" class="field"><label for="f-program">Program</label><select id="f-program" v-model="form.program"><option v-for="program in programs" :key="program" :value="program">{{ program }}</option></select></div>
        <div v-if="authTab==='up'" class="field"><label for="f-year">Year</label><select id="f-year" v-model="form.year"><option v-for="year in 6" :key="year" :value="year">{{ year }}</option></select></div>
        <div class="field"><label for="f-email">Email</label><input id="f-email" v-model="form.email" type="email" autocomplete="email" placeholder="6638012321@student.chula.ac.th"></div>
        <div class="field"><label for="f-pass">Password</label><input id="f-pass" v-model="form.pass" type="password" :autocomplete="authTab==='in' ? 'current-password' : 'new-password'" placeholder="At least 8 characters"></div>
        <p v-if="formErr" class="err" role="alert">{{ formErr }}</p>
        <button class="btn primary block" type="submit" :disabled="busy" :aria-busy="busy">{{ authTab==='in' ? 'Sign in' : 'Create account' }}</button>
      </form>
    </div>
  </div>
</div>
</template>
