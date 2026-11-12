<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { MESSAGES, chulaEmail, resolveLoginEmail, validateSignUp } from '../lib/rules.js'
import { ENGINEERING, OTHER_FACULTIES } from '../lib/programs.js'
import ClubLogo from '../components/ClubLogo.vue'
import CourtArt from '../components/CourtArt.vue'
import ProgramPicker from '../components/ProgramPicker.vue'
import '../styles/signin.css'
const router = useRouter()
const { signIn, signUp, error:authError } = useAuth()
const authTab = ref('in')
const form = reactive({ login:'', name:'', sid:'', faculty:ENGINEERING, program:'', year:1, email:'', pass:'' })
const customEmail = ref(false)
const showPass = ref(false)
const formErr = ref('')
const notice = ref('')
const busy = ref(false)
const isEngineering = computed(() => form.faculty === ENGINEERING)
const tenDigits = value => /^\d{10}$/.test(value.trim())
const loginId = computed(() => tenDigits(form.login) ? form.login.trim() : '')
const derivedEmail = computed(() => tenDigits(form.sid) ? chulaEmail(form.sid.trim()) : '')
const signUpEmail = computed(() => customEmail.value ? form.email.trim() : derivedEmail.value)
// A program picked for one faculty means nothing for another.
watch(() => form.faculty, () => { form.program = '' })
function setTab(tab) {
  authTab.value = tab
  formErr.value = ''
  showPass.value = false
}
async function submit() {
  if (busy.value) return
  formErr.value = ''
  notice.value = ''
  const signingUp = authTab.value === 'up'
  if (signingUp) {
    formErr.value = validateSignUp({
      fullName:form.name, studentId:form.sid, faculty:form.faculty, program:form.program,
      email:signUpEmail.value, password:form.pass, customEmail:customEmail.value,
    }) || ''
  } else if (!resolveLoginEmail(form.login)) formErr.value = MESSAGES.login
  else if (form.pass.length < 8) formErr.value = MESSAGES.password
  if (formErr.value) return
  busy.value = true
  try {
    const data = signingUp
      ? await signUp({ fullName:form.name, studentId:form.sid, faculty:form.faculty, program:form.program.trim(), year:form.year, email:signUpEmail.value, password:form.pass })
      : await signIn(form.login, form.pass)
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
    <div class="si-brand">
      <club-logo class="si-mark" variant="mark"></club-logo>
      <div class="si-brand-text">
        <span class="si-club">Intania Tennis Club</span>
        <span class="si-hours">CUB 13 · open 08:00–22:00</span>
      </div>
    </div>
    <club-logo class="si-logo"></club-logo>
    <court-art class="si-court" label="Tennis court"></court-art>
    <div>
      <h1 class="display si-title">Book a court at CUB 13.</h1>
      <p class="si-sub">Two courts for Chula engineering students, open every day from 08:00 to 22:00.</p>
    </div>
    <p class="si-foot">Student project for an ISE course assignment.</p>
  </div>
  <div class="si-form-wrap">
    <div class="si-form">
      <div class="seg full" role="tablist">
        <button type="button" role="tab" :aria-selected="authTab==='in'" :class="{on: authTab==='in'}" @click="setTab('in')">Sign in</button>
        <button type="button" role="tab" :aria-selected="authTab==='up'" :class="{on: authTab==='up'}" @click="setTab('up')">Create account</button>
      </div>
      <h2 class="display h-lg si-h2">{{ authTab==='in' ? 'Sign in' : 'Create your account' }}</h2>
      <p v-if="notice" class="si-notice" role="status">{{ notice }}</p>
      <p v-if="authError" class="err" role="alert">{{ authError }}</p>
      <form class="form" novalidate :aria-busy="busy" @submit.prevent="submit">
        <template v-if="authTab==='in'">
          <div class="field">
            <label for="f-login">Student ID or Chula email</label>
            <input id="f-login" v-model="form.login" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="6638012321">
            <p class="si-help">Your 10-digit ID is enough. Club admins sign in with their email.</p>
            <p v-if="loginId" class="chip ok si-chip">Signing in as {{ chulaEmail(loginId) }}</p>
          </div>
        </template>
        <template v-else>
          <div class="field"><label for="f-name">Full name</label><input id="f-name" v-model="form.name" autocomplete="name" placeholder="Napat Srisuk"></div>
          <div class="field"><label for="f-sid">Student ID</label><input id="f-sid" v-model="form.sid" class="mono-input" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="6638012321"></div>
          <div class="field">
            <label for="f-faculty">Faculty</label>
            <select id="f-faculty" v-model="form.faculty">
              <option :value="ENGINEERING">Engineering</option>
              <optgroup label="Other faculties"><option v-for="faculty in OTHER_FACULTIES" :key="faculty" :value="faculty">{{ faculty }}</option></optgroup>
            </select>
          </div>
          <div v-if="isEngineering" class="field">
            <label id="f-program-lbl" for="f-program">Program</label>
            <program-picker v-model="form.program" labelledby="f-program-lbl"></program-picker>
          </div>
          <div v-else class="field"><label for="f-program-text">Program</label><input id="f-program-text" v-model="form.program" autocomplete="off" placeholder="e.g. Accounting"></div>
          <div class="field"><label for="f-year">Year</label><select id="f-year" v-model="form.year"><option v-for="year in 6" :key="year" :value="year">{{ year }}</option></select></div>
          <div v-if="!customEmail" class="field">
            <span id="lbl-email" class="lbl">Chula email</span>
            <div class="email-ro" role="group" aria-labelledby="lbl-email">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3"/></svg>
              <span v-if="derivedEmail" class="mono">{{ derivedEmail }}</span>
              <span v-else class="email-ph">Fills in from your student ID</span>
            </div>
            <p class="si-help">Made from your student ID. Club admin with another address? <button type="button" class="linkbtn" @click="customEmail = true">Use a different email</button></p>
          </div>
          <div v-else class="field">
            <label for="f-email">Email</label>
            <input id="f-email" v-model="form.email" type="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com">
            <p class="si-help">Only club admins can use an address that does not end in @student.chula.ac.th. <button type="button" class="linkbtn" @click="customEmail = false">Use my Chula email</button></p>
          </div>
        </template>
        <div class="field">
          <label for="f-pass">Password</label>
          <div class="pw">
            <input id="f-pass" v-model="form.pass" :type="showPass ? 'text' : 'password'" :autocomplete="authTab==='in' ? 'current-password' : 'new-password'" :placeholder="authTab==='up' ? 'At least 8 characters' : null">
            <button type="button" class="pw-toggle" :aria-pressed="showPass" aria-controls="f-pass" @click="showPass = !showPass">{{ showPass ? 'Hide' : 'Show' }}</button>
          </div>
        </div>
        <p v-if="authTab==='up'" class="note">By creating an account you agree to the court rules: up to 2 hours a day, cancel at least 2 hours before, bring your own equipment and tidy up after.</p>
        <p v-if="formErr" class="err" role="alert">{{ formErr }}</p>
        <button class="btn primary block si-submit" type="submit" :disabled="busy" :aria-busy="busy">{{ authTab==='in' ? 'Sign in' : 'Create account' }}</button>
      </form>
      <template v-if="authTab==='in'">
        <p class="si-switch">New here? <button type="button" class="linkbtn" @click="setTab('up')">Create an account</button></p>
        <div class="si-legal">
          <p>2 courts · up to 2 hours a day · book 14 days ahead</p>
          <p class="si-note">Student project for an ISE course assignment.</p>
        </div>
      </template>
    </div>
  </div>
</div>
</template>
