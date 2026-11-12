import { computed, ref } from 'vue'
import router from '../router.js'
import { supabase } from '../lib/supabase.js'
import { toMessage, toProfile } from '../lib/api.js'
import { MESSAGES, resolveLoginEmail } from '../lib/rules.js'

const session = ref(null)
const profile = ref(null)
const mode = ref('student')
const error = ref('')
const isAdmin = computed(() => profile.value?.role === 'admin')
let ready
let revision = 0
let pending = Promise.resolve()

function defaultMode() {
  mode.value = isAdmin.value && /^#\/?admin-/.test(window.location.hash) ? 'admin' : 'student'
}

async function loadSession(next) {
  const current = ++revision
  session.value = next
  error.value = ''
  if (!next) {
    profile.value = null
    mode.value = 'student'
    return
  }
  // Token refreshes must not reset an admin's chosen view.
  if (profile.value?.id === next.user.id) return
  profile.value = null
  try {
    const result = await supabase.from('profiles').select('*').eq('id', next.user.id).single()
    if (result.error) throw result.error
    if (current !== revision) return
    profile.value = toProfile(result.data)
    defaultMode()
  } catch (cause) {
    if (current === revision) error.value = toMessage(cause)
  }
}

function syncSession(next) {
  pending = loadSession(next)
  return pending
}

function initialize() {
  // Keep profile queries outside Supabase's auth callback lock.
  supabase.auth.onAuthStateChange((_event, next) => {
    session.value = next
    if (!next) {
      void syncSession(null)
      return
    }
    const scheduledRevision = ++revision
    setTimeout(() => {
      if (revision === scheduledRevision) void syncSession(next)
    }, 0)
  })
  const initialRevision = revision
  ready = (async () => {
    try {
      const result = await supabase.auth.getSession()
      if (result.error) throw result.error
      if (revision === initialRevision) await syncSession(result.data.session)
      else {
        // An auth event may have arrived while storage was being read.
        if (session.value && !profile.value) await syncSession(session.value)
        await pending
      }
    } catch (cause) {
      error.value = toMessage(cause)
    }
  })()
}

async function authenticate(method, credentials) {
  let result
  try { result = await supabase.auth[method](credentials) }
  catch (cause) { throw new Error(toMessage(cause)) }
  if (result.error) throw new Error(result.error.message || toMessage(result.error))
  await syncSession(result.data.session)
  if (error.value) throw new Error(error.value)
  return result.data
}

async function setMode(next) {
  mode.value = next === 'admin' && isAdmin.value ? 'admin' : 'student'
  return router.push({ name:mode.value === 'admin' ? 'admin-today' : 'home' })
}

async function signOut() {
  const result = await supabase.auth.signOut()
  if (result.error) throw new Error(result.error.message || toMessage(result.error))
  await syncSession(null)
  return router.replace({ name:'signin' })
}

export function useAuth() {
  if (!ready) initialize()
  return {
    session, profile, isAdmin, mode, error, ready, setMode, signOut,
    signIn:(login, password) => {
      const email = resolveLoginEmail(login)
      if (!email) return Promise.reject(new Error(MESSAGES.login))
      return authenticate('signInWithPassword', { email, password })
    },
    signUp:({ fullName, studentId, faculty, program, year, email, password }) => authenticate('signUp', {
      email:email.trim().toLowerCase(), password,
      options:{ data:{ full_name:fullName.trim(), student_id:studentId.trim(), faculty, program, year:Number(year) } },
    }),
  }
}
