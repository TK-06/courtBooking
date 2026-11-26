import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const fake = vi.hoisted(() => ({ fetchMyBookings:vi.fn(async () => []), fetchEvents:vi.fn(async () => []), fetchCourts:vi.fn(async () => []), fetchEquipment:vi.fn(async () => [{ id:'racket', name:'Racket', plural:'Rackets', total:8, maxPerDay:2 }]), fetchClosedDays:vi.fn(async () => ({})), fetchLoans:vi.fn(async () => []), fetchAvailability:vi.fn(async () => ({ racket:8, balls:12 })), createLoan:vi.fn() }))
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{} }))
vi.mock('../../src/lib/api.js', () => fake)
vi.mock('../../src/composables/useToast.js', () => ({ useToast:() => ({ show:vi.fn() }) }))
vi.mock('../../src/composables/useAuth.js', () => {
  const profile = ref({ id:'g', fullName:'Demo guest', studentId:null, faculty:null, program:null, year:null, role:'guest' })
  return { useAuth:() => ({ profile, ready:Promise.resolve(), isAdmin:computed(() => false), isGuest:computed(() => true), mode:ref('student'), setMode:vi.fn(), signOut:vi.fn() }) }
})
import AppShell from '../../src/components/AppShell.vue'
import Profile from '../../src/views/Profile.vue'
import Club from '../../src/views/Club.vue'
import Borrow from '../../src/views/Borrow.vue'
import { MESSAGES } from '../../src/lib/rules.js'

const wrappers = []
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()))

test('the shell labels a guest as a guest, not "null, year null"', async () => {
  const names = ['home','book','booking/:id','bookings','borrow','club','profile','admin-today','admin-bookings','admin-courts','admin-equipment','admin-members']
  const router = createRouter({ history:createMemoryHistory(), routes:names.map(name => ({ name, path:'/' + name, component:{ template:'<div />' } })) })
  await router.push({ name:'home' })
  const w = mount(AppShell, { global:{ plugins:[router] } }); wrappers.push(w)
  expect(w.find('.side-user').text()).toContain('Guest · 1 hour a week')
  expect(w.find('.side-user').text()).not.toContain('null')
})
test('the profile labels a guest and shows no student ID', async () => {
  const w = mount(Profile); wrappers.push(w)
  await flushPromises()
  expect(w.find('.prof-head').text()).toContain('Guest · 1 hour a week')
  expect(w.find('.prof-head').text()).not.toContain('null')
  expect(w.find('.prof-head').text()).not.toContain('year')
})
test('the club rules mention the guest limit', async () => {
  const w = mount(Club); wrappers.push(w)
  await flushPromises()
  expect(w.find('.club-rules').text()).toContain('Guests can book 1 hour a week.')
})
test('guests see that equipment is for Chula students and get no reserve button', async () => {
  const w = mount(Borrow); wrappers.push(w)
  await flushPromises()
  expect(w.text()).toContain(MESSAGES.loanGuest)
  expect(MESSAGES.loanGuest).toBe('Equipment loans are for Chula students.')
  expect(w.findAll('button').some(b => b.text().startsWith('Reserve for'))).toBe(false)
})
