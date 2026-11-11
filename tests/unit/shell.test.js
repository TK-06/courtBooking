import { beforeEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
const fake = vi.hoisted(() => ({ auth:null }))
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{} }))
vi.mock('../../src/composables/useAuth.js', () => ({ useAuth:() => fake.auth }))
import AppShell from '../../src/components/AppShell.vue'
let router
beforeEach(() => {
  const profile = ref({ id:'u', fullName:'Napat Srisuk', program:'ICE', year:3, role:'student' })
  fake.auth = { profile, isAdmin:computed(() => profile.value.role === 'admin'), mode:ref('student'), setMode:vi.fn(), signOut:vi.fn() }
  const names = ['home','book','booking/:id','bookings','borrow','club','profile','admin-today','admin-bookings','admin-courts','admin-equipment','admin-members']
  router = createRouter({ history:createMemoryHistory(), routes:names.map(name => ({ name, path:'/' + name, component:{ template:'<div />' } })) })
})
async function render(name) {
  await router.push(name === 'booking/:id' ? { name, params:{ id:'x' } } : { name })
  return mount(AppShell, { slots:{ default:'Route content' }, global:{ plugins:[router] } })
}
test('student shell ports both five-item navigations and profile identity', async () => {
  const w = await render('home')
  expect(w.findAll('.nav button').map(b => b.text())).toEqual(['Home','My bookings','Borrow equipment','Club and contact','Profile'])
  expect(w.findAll('.tab').map(b => b.text())).toEqual(['Home','Bookings','Borrow','Club','Profile'])
  expect(w.find('.side-user').text()).toContain('Napat Srisuk')
  expect(w.find('.side-user').text()).toContain('ICE, year 3')
  expect(w.find('main').text()).toBe('Route content')
  await w.find('.avatar-btn').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.name).toBe('profile')
  w.unmount()
})
test('admin shell nav, mode switches, booking action and sign-out are wired', async () => {
  fake.auth.profile.value.role = 'admin'
  fake.auth.mode.value = 'admin'
  const w = await render('admin-today')
  expect(w.findAll('.nav button').map(b => b.text())).toEqual(['Today','Bookings','Courts','Equipment','Members and log'])
  expect(w.findAll('.tab').map(b => b.text())).toEqual(['Today','Bookings','Courts','Equipment','Members'])
  expect(w.find('.chip').text()).toBe('Admin')
  await w.find('.nav-switch').trigger('click')
  expect(fake.auth.setMode).toHaveBeenCalledWith('student')
  await w.find('.side .linkbtn').trigger('click')
  expect(fake.auth.signOut).toHaveBeenCalledOnce()
  await w.find('.side > .btn').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.name).toBe('book')
  expect(w.find('.top').exists()).toBe(false)
  expect(w.find('.tabs').exists()).toBe(false)
  w.unmount()
})
test.each(['student','admin'])('booking detail marks the %s bookings nav as current', async mode => {
  fake.auth.mode.value = mode
  fake.auth.profile.value.role = mode
  const w = await render('booking/:id')
  expect(w.find('.nav [aria-current="page"]').text()).toBe(mode === 'admin' ? 'Bookings' : 'My bookings')
  w.unmount()
})
