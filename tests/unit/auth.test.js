import { beforeEach, afterEach, expect, test, vi } from 'vitest'
const fake = vi.hoisted(() => ({ auth:{}, profile:null, profileError:null, calls:[] }))
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{
  auth:fake.auth,
  from:table => {
    fake.calls.push(['from', table])
    const query = {
      select:vi.fn(function () { return this }),
      eq:vi.fn(function (...args) { fake.calls.push(['eq', ...args]); return this }),
      single:vi.fn(async () => ({ data:fake.profile, error:fake.profileError })),
    }
    return query
  },
} }))
vi.mock('../../src/router.js', () => ({ default:{ push:vi.fn(), replace:vi.fn() } }))
const student = { id:'u', full_name:'Napat Srisuk', student_id:'6638012321', program:'ICE', year:3, role:'student' }
const session = { user:{ id:'u' } }
let useAuth
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  window.location.hash = '#/home'
  fake.profile = student
  fake.profileError = null
  fake.calls = []
  fake.auth.getSession = vi.fn(async () => ({ data:{ session }, error:null }))
  fake.auth.onAuthStateChange = vi.fn(callback => { fake.listener = callback; return { data:{ subscription:{ unsubscribe:vi.fn() } } } })
  fake.auth.signInWithPassword = vi.fn(async () => ({ data:{ session }, error:null }))
  fake.auth.signUp = vi.fn(async () => ({ data:{ session }, error:null }))
  fake.auth.signOut = vi.fn(async () => ({ error:null }))
  ;({ useAuth } = await import('../../src/composables/useAuth.js'))
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

test('restores session and mapped profile once across consumers', async () => {
  const auth = useAuth()
  expect(useAuth().session).toBe(auth.session)
  expect(useAuth().ready).toBe(auth.ready)
  await auth.ready
  expect(fake.auth.getSession).toHaveBeenCalledTimes(1)
  expect(fake.auth.onAuthStateChange).toHaveBeenCalledTimes(1)
  expect(fake.calls).toContainEqual(['eq', 'id', 'u'])
  expect(auth.profile.value.fullName).toBe('Napat Srisuk')
  expect(auth.mode.value).toBe('student')
  expect(auth.isAdmin.value).toBe(false)
})
test.each(['#/admin-courts', '#/home'])('admin landing mode follows %s', async hash => {
  window.location.hash = hash
  fake.profile = { ...student, role:'admin', student_id:null }
  const auth = useAuth()
  await auth.ready
  expect(auth.isAdmin.value).toBe(true)
  expect(auth.profile.value.studentId).toBeNull()
  expect(auth.mode.value).toBe(hash.includes('admin-') ? 'admin' : 'student')
})
test('mode switch navigates, while refresh preserves chosen admin mode', async () => {
  fake.profile = { ...student, role:'admin' }
  const auth = useAuth()
  await auth.ready
  const { default:router } = await import('../../src/router.js')
  await auth.setMode('admin')
  expect(auth.mode.value).toBe('admin')
  expect(router.push).toHaveBeenCalledWith({ name:'admin-today' })
  fake.listener('TOKEN_REFRESHED', session)
  await vi.runAllTimersAsync()
  expect(auth.mode.value).toBe('admin')
  await auth.setMode('student')
  expect(router.push).toHaveBeenLastCalledWith({ name:'home' })
})
test('students cannot select admin mode', async () => {
  const auth = useAuth()
  await auth.ready
  await auth.setMode('admin')
  expect(auth.mode.value).toBe('student')
})
test('sign-in normalizes any email domain', async () => {
  const auth = useAuth()
  await auth.ready
  await auth.signIn(' Admin@Example.com ', 'password')
  expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email:'admin@example.com', password:'password' })
})
test('sign-up sends exact metadata and handles confirmation without a session', async () => {
  const auth = useAuth()
  await auth.ready
  fake.auth.signUp.mockResolvedValue({ data:{ session:null, user:{ id:'new' } }, error:null })
  const result = await auth.signUp({ fullName:' Napat Srisuk ', studentId:' 6638012321 ', program:'ICE', year:'3', email:' NAPAT@Student.Chula.ac.th ', password:'password' })
  expect(fake.auth.signUp).toHaveBeenCalledWith({ email:'napat@student.chula.ac.th', password:'password', options:{ data:{ full_name:'Napat Srisuk', student_id:'6638012321', program:'ICE', year:3 } } })
  expect(result.session).toBeNull()
  expect(auth.profile.value).toBeNull()
})
test('auth events load profiles outside the callback and clear on sign-out', async () => {
  fake.auth.getSession.mockResolvedValue({ data:{ session:null }, error:null })
  const auth = useAuth()
  await auth.ready
  fake.listener('SIGNED_IN', session)
  expect(fake.calls).toEqual([])
  await vi.runAllTimersAsync()
  expect(auth.profile.value.id).toBe('u')
  fake.listener('SIGNED_OUT', null)
  expect(auth.session.value).toBeNull()
  expect(auth.profile.value).toBeNull()
})
test('sign-out clears state and navigates to sign-in', async () => {
  const auth = useAuth()
  await auth.ready
  await auth.signOut()
  const { default:router } = await import('../../src/router.js')
  expect(router.replace).toHaveBeenCalledWith({ name:'signin' })
  expect(auth.session.value).toBeNull()
  expect(auth.profile.value).toBeNull()
})
test('profile errors finish ready with no access and a mapped error', async () => {
  fake.profileError = { code:'42501' }
  const auth = useAuth()
  await auth.ready
  expect(auth.profile.value).toBeNull()
  expect(auth.error.value).toBe('You do not have access to do that.')
})
test('failed sign-in throws and failed sign-out retains state', async () => {
  const auth = useAuth()
  await auth.ready
  fake.auth.signInWithPassword.mockResolvedValue({ error:{ message:'Invalid login credentials' } })
  await expect(auth.signIn('a@example.com', 'password')).rejects.toThrow('Invalid login credentials')
  fake.auth.signOut.mockResolvedValue({ error:{ message:'Connection lost' } })
  await expect(auth.signOut()).rejects.toThrow('Connection lost')
  expect(auth.profile.value.id).toBe('u')
})
test('stale profile response cannot restore a signed-out user', async () => {
  let resolveSession
  fake.auth.getSession.mockReturnValue(new Promise(resolve => { resolveSession = resolve }))
  const auth = useAuth()
  fake.listener('SIGNED_OUT', null)
  resolveSession({ data:{ session }, error:null })
  await auth.ready
  expect(auth.session.value).toBeNull()
  expect(auth.profile.value).toBeNull()
})
