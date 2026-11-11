import { beforeAll, expect, test, vi } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
const fake = vi.hoisted(() => ({ auth:null }))
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{} }))
vi.mock('../../src/composables/useAuth.js', () => ({ useAuth:() => fake.auth }))
import router from '../../src/router.js'
beforeAll(() => {
  fake.auth = { session:ref(null), profile:ref(null), mode:ref('student'), ready:Promise.resolve() }
  fake.auth.isAdmin = computed(() => fake.auth.profile.value?.role === 'admin')
})
test('hash router guards navigation and follows admin/student modes', async () => {
  await router.push('/admin-courts')
  expect(router.currentRoute.value.name).toBe('signin')
  fake.auth.session.value = { user:{ id:'u' } }
  fake.auth.profile.value = { id:'u', role:'student' }
  await router.push('/admin-courts')
  expect(router.currentRoute.value.name).toBe('home')
  fake.auth.profile.value = { id:'u', role:'admin' }
  await router.push('/admin-courts')
  expect(router.currentRoute.value.name).toBe('admin-courts')
  expect(fake.auth.mode.value).toBe('admin')
  await router.push('/book')
  expect(fake.auth.mode.value).toBe('admin')
  await router.push('/home')
  expect(fake.auth.mode.value).toBe('student')
  expect(router.options.history.createHref('/home')).toContain('#/home')
})
test('external sign-out returns protected pages to sign-in', async () => {
  await router.push('/home')
  fake.auth.session.value = null
  fake.auth.profile.value = null
  await nextTick()
  await flushPromises()
  expect(router.currentRoute.value.name).toBe('signin')
})
test('guard waits for restored profile before rendering an admin landing route', async () => {
  let restore
  fake.auth.ready = new Promise(resolve => { restore = resolve })
  const navigation = router.push('/admin-today')
  await Promise.resolve()
  fake.auth.session.value = { user:{ id:'a' } }
  fake.auth.profile.value = { id:'a', role:'admin' }
  restore()
  await navigation
  expect(router.currentRoute.value.name).toBe('admin-today')
  expect(fake.auth.mode.value).toBe('admin')
})
