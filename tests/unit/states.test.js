import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import LoadState from '../../src/components/LoadState.vue'
import { MESSAGES } from '../../src/lib/rules.js'
import Home from '../../src/views/Home.vue'
import MyBookings from '../../src/views/MyBookings.vue'
import BookingDetail from '../../src/views/BookingDetail.vue'
import BookFlow from '../../src/views/BookFlow.vue'
import Borrow from '../../src/views/Borrow.vue'
import Club from '../../src/views/Club.vue'
import Profile from '../../src/views/Profile.vue'
import AdminToday from '../../src/views/admin/AdminToday.vue'
import AdminBookings from '../../src/views/admin/AdminBookings.vue'
import AdminCourts from '../../src/views/admin/AdminCourts.vue'
import AdminEquipment from '../../src/views/admin/AdminEquipment.vue'
import AdminMembers from '../../src/views/admin/AdminMembers.vue'

const fake = vi.hoisted(() => ({ auth:null, route:null, show:vi.fn(), push:vi.fn(), replace:vi.fn(), onEvent:null }))
vi.mock('../../src/lib/api.js', () => ({
  fetchMyBookings:vi.fn(), fetchBookings:vi.fn(), fetchCourts:vi.fn(), fetchClosedDays:vi.fn(),
  fetchEquipment:vi.fn(), fetchLoans:vi.fn(), fetchAvailability:vi.fn(), fetchEvents:vi.fn(),
  fetchProfiles:vi.fn(), subscribeEvents:vi.fn(), createBooking:vi.fn(), cancelBooking:vi.fn(),
  createLoan:vi.fn(), setLoanStatus:vi.fn(), updateCourt:vi.fn(),
}))
vi.mock('../../src/composables/useAuth.js', () => ({ useAuth:() => fake.auth }))
vi.mock('../../src/composables/useToast.js', () => ({ useToast:() => ({ show:fake.show }) }))
vi.mock('vue-router', () => ({ useRoute:() => fake.route, useRouter:() => ({ push:fake.push, replace:fake.replace }) }))
import * as api from '../../src/lib/api.js'

const courts = [{ id:1, name:'Court I', status:'open', note:'' }]
const equipment = [{ id:'racket', name:'Racket', plural:'Rackets', total:8, maxPerDay:2 }]
const wrappers = []
const render = component => { const w = mount(component); wrappers.push(w); return w }
const retry = w => w.findAll('button').find(b => b.text() === 'Try again')
const message = thing => `Couldn't load ${thing}. Check your connection and try again.`
const views = [
  { name:'Home', component:Home, reads:['fetchMyBookings','fetchCourts','fetchBookings','fetchClosedDays'], thing:'your bookings', empty:'No court booked.' },
  { name:'My bookings', component:MyBookings, reads:['fetchMyBookings','fetchCourts'], thing:'your bookings', empty:'No upcoming bookings' },
  { name:'Booking detail', component:BookingDetail, reads:['fetchMyBookings','fetchCourts','fetchEvents'], thing:'this booking', empty:'Booking not found.' },
  { name:'Book flow', component:BookFlow, reads:['fetchCourts','fetchClosedDays','fetchBookings'], thing:'court availability', empty:'You can book up to 14 days ahead.' },
  { name:'Borrow', component:Borrow, reads:['fetchEquipment','fetchClosedDays','fetchLoans'], thing:'equipment', empty:'Nothing borrowed yet.' },
  { name:'Club', component:Club, reads:['fetchCourts'], thing:'courts', empty:'Open today' },
  { name:'Profile', component:Profile, reads:['fetchMyBookings','fetchEvents'], thing:'your playing history', empty:'No games played yet. Your first booking will show here.' },
  { name:'Admin today', component:AdminToday, reads:['fetchCourts','fetchBookings','fetchProfiles','fetchLoans','fetchEvents'], thing:"today's courts", empty:'No loans today.' },
  { name:'Admin bookings', component:AdminBookings, reads:['fetchBookings','fetchProfiles','fetchCourts'], thing:'bookings', empty:'No bookings match.' },
  { name:'Admin courts', component:AdminCourts, reads:['fetchCourts','fetchBookings'], thing:'courts', empty:'0 upcoming bookings on this court.' },
  { name:'Admin equipment', component:AdminEquipment, reads:['fetchEquipment','fetchLoans','fetchProfiles','fetchAvailability'], thing:'equipment', empty:'No loans here.' },
  { name:'Admin members', component:AdminMembers, reads:['fetchProfiles','fetchBookings','fetchEvents'], thing:'members and activity', empty:'No activity yet.' },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake:['Date'] })
  vi.setSystemTime(new Date('2026-11-10T06:20:00Z'))
  fake.auth = { profile:ref({ id:'u1', fullName:'Club Member', role:'student' }), session:ref({ user:{ id:'u1' } }), mode:ref('student'), isAdmin:ref(false), ready:Promise.resolve() }
  fake.route = reactive({ params:{ id:'b1' }, query:{}, fullPath:'/home' })
  for (const name of ['fetchMyBookings','fetchBookings','fetchLoans','fetchEvents','fetchProfiles']) api[name].mockResolvedValue([])
  api.fetchCourts.mockResolvedValue(courts)
  api.fetchClosedDays.mockResolvedValue({})
  api.fetchEquipment.mockResolvedValue(equipment)
  api.fetchAvailability.mockResolvedValue({ racket:8, balls:12 })
  api.subscribeEvents.mockImplementation(callback => { fake.onEvent = callback; return vi.fn() })
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.useRealTimers() })

test('LoadState renders only the active state and emits retry without submitting a form', async () => {
  const w = mount(LoadState, { props:{ state:'loading', message:message('courts') }, slots:{ default:'Ready content' } })
  wrappers.push(w)
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  expect(w.text()).not.toContain('Ready content')
  await w.setProps({ state:'error' })
  expect(w.get('[role="alert"]').text()).toBe(message('courts'))
  expect(retry(w).attributes('type')).toBe('button')
  await retry(w).trigger('click')
  expect(w.emitted('retry')).toHaveLength(1)
  await w.setProps({ state:'ready' })
  expect(w.text()).toBe('Ready content')
  expect(retry(w)).toBeUndefined()
})

test.each(views)('$name shows loading until the read finishes, then ready/empty content', async ({ component, reads, empty }) => {
  let finish
  const result = reads[0] === 'fetchCourts' ? courts : reads[0] === 'fetchEquipment' ? equipment : []
  api[reads[0]].mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const w = render(component)
  await flushPromises()
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  expect(w.get('[role="status"]').classes()).toContain('muted')
  expect(w.text()).not.toContain(empty)
  finish(result)
  await flushPromises()
  expect(w.find('[role="status"]').exists()).toBe(false)
  expect(w.text()).toContain(empty)
})

test.each(views.flatMap(view => view.reads.map(read => ({ ...view, read }))))('$name retries a failed $read without showing an empty result', async ({ component, read, thing, empty }) => {
  api[read].mockRejectedValueOnce(new Error('Internal request details'))
  const w = render(component)
  await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe(message(thing))
  expect(w.text()).not.toContain('Internal request details')
  expect(w.text()).not.toContain(empty)
  expect(retry(w)).toBeDefined()
  await retry(w).trigger('click')
  await flushPromises()
  expect(api[read]).toHaveBeenCalledTimes(2)
  expect(w.find('[role="alert"]').exists()).toBe(false)
  expect(w.text()).toContain(empty)
})

test('Home keeps the exact failure copy and retry passes through loading again', async () => {
  api.fetchMyBookings.mockRejectedValueOnce(new Error('offline'))
  const w = render(Home); await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe("Couldn't load your bookings. Check your connection and try again.")
  let finish
  api.fetchMyBookings.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await retry(w).trigger('click')
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  expect(retry(w)).toBeUndefined()
  finish([]); await flushPromises()
  expect(w.text()).toContain('No court booked.')
})

test.each([
  { component:BookFlow, thing:'court availability' },
  { component:BookingDetail, thing:'this booking' },
])('admin mode retries the extra profile read in $component.__name', async ({ component, thing }) => {
  fake.auth.mode.value = 'admin'; fake.auth.isAdmin.value = true
  api.fetchProfiles.mockRejectedValueOnce(new Error('offline'))
  const w = render(component); await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe(message(thing))
  await retry(w).trigger('click'); await flushPromises()
  expect(api.fetchProfiles).toHaveBeenCalledTimes(2)
  expect(w.find('[role="alert"]').exists()).toBe(false)
})

test('Book flow retries a failed availability refresh after an overlap without resubmitting', async () => {
  const w = render(BookFlow); await flushPromises()
  await w.get('[aria-label="Wednesday 11 November, open"]').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  await w.get('.slot[aria-label^="18:00 to"]').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  await w.get('#agree').setValue(true)
  api.createBooking.mockRejectedValueOnce(new Error(MESSAGES.taken))
  let fail
  api.fetchBookings.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  await w.get('.flow-bar .btn').trigger('click'); await flushPromises()
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  expect(w.find('.flow-bar').exists()).toBe(false)
  fail(new Error('offline')); await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe(message('court availability'))
  await retry(w).trigger('click'); await flushPromises()
  expect(w.find('.s1').exists()).toBe(true)
  expect(api.fetchBookings).toHaveBeenCalledTimes(3)
  expect(api.createBooking).toHaveBeenCalledOnce()
})

test('My bookings preserves the Played and Cancelled empty copy', async () => {
  const w = render(MyBookings); await flushPromises()
  await w.findAll('[role="tab"]')[1].trigger('click')
  expect(w.text()).toContain('No games played yet')
  expect(w.text()).toContain('Your history fills in as you play.')
  await w.findAll('[role="tab"]')[2].trigger('click')
  expect(w.text()).toContain('No cancellations')
})

test.each(['initial','date change'])('Borrow retries an availability failure on $0 and prevents reservation', async when => {
  if (when === 'initial') api.fetchAvailability.mockRejectedValueOnce(new Error('offline'))
  const w = render(Borrow); await flushPromises()
  if (when === 'date change') {
    api.fetchAvailability.mockRejectedValueOnce(new Error('offline'))
    await w.findAll('.dchip')[1].trigger('click'); await flushPromises()
  }
  expect(w.get('[role="alert"]').text()).toBe(message('equipment availability'))
  expect(w.find('.avail').exists()).toBe(false)
  const reserve = w.findAll('button').find(b => b.text().startsWith('Reserve for'))
  expect(reserve.attributes('disabled')).toBeDefined()
  const calls = api.fetchAvailability.mock.calls.length
  await retry(w).trigger('click'); await flushPromises()
  expect(api.fetchAvailability).toHaveBeenCalledTimes(calls + 1)
  expect(api.fetchAvailability).toHaveBeenLastCalledWith(when === 'initial' ? '2026-11-10' : '2026-11-11')
  expect(w.find('[role="alert"]').exists()).toBe(false)
  expect(w.get('.avail').text()).toContain('8 of 8 free')
  expect(reserve.attributes('disabled')).toBeUndefined()
})

test('Borrow hides stale availability during date loads and clears its error on another day', async () => {
  const w = render(Borrow); await flushPromises()
  let fail
  api.fetchAvailability.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  await w.findAll('.dchip')[1].trigger('click')
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  expect(w.find('.avail').exists()).toBe(false)
  fail(new Error('offline')); await flushPromises()
  await w.findAll('.dchip')[2].trigger('click'); await flushPromises()
  expect(w.find('[role="alert"]').exists()).toBe(false)
  expect(w.get('.avail').text()).toContain('8 of 8 free')
})

test.each([
  { component:Home, empty:'No courts available.' },
  { component:BookFlow, empty:'No courts available.' },
  { component:Club, empty:'No courts available.' },
  { component:AdminCourts, empty:'No courts available.' },
])('an empty courts response has visible copy in $component.__name', async ({ component, empty }) => {
  api.fetchCourts.mockResolvedValue([])
  const w = render(component); await flushPromises()
  expect(w.text()).toContain(empty)
  expect(w.find('[role="alert"]').exists()).toBe(false)
})

test('empty admin activity and member lists have visible copy', async () => {
  const today = render(AdminToday), members = render(AdminMembers)
  await flushPromises()
  expect(today.text()).toContain('No activity yet.')
  expect(members.text()).toContain('No members match.')
})

test('empty equipment disables reserving while retaining the loan empty copy', async () => {
  api.fetchEquipment.mockResolvedValue([])
  const w = render(Borrow); await flushPromises()
  expect(w.text()).toContain('No equipment available.')
  expect(w.text()).toContain('Nothing borrowed yet.')
  expect(w.findAll('button').find(b => b.text().startsWith('Reserve for')).attributes('disabled')).toBeDefined()
})

test('admin loan changes show loading and a retry when the availability refresh fails', async () => {
  const loan = { id:'l1', userId:'u1', date:'2026-11-10', racket:1, balls:0, status:'reserved' }
  api.fetchLoans.mockResolvedValue([loan])
  api.setLoanStatus.mockResolvedValue({ ...loan, status:'out' })
  const w = render(AdminEquipment); await flushPromises()
  let fail
  api.fetchAvailability.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  await w.findAll('button').find(b => b.text() === 'Mark picked up').trigger('click')
  await flushPromises()
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  fail(new Error('offline')); await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe(message('equipment'))
  await retry(w).trigger('click'); await flushPromises()
  expect(api.fetchAvailability).toHaveBeenCalledTimes(3)
  expect(w.find('[role="alert"]').exists()).toBe(false)
  expect(api.setLoanStatus).toHaveBeenCalledOnce()
})

test('admin live booking refresh shows loading and can recover through retry', async () => {
  const w = render(AdminMembers); await flushPromises()
  let fail
  api.fetchBookings.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  fake.onEvent({ id:1, userId:'u1', kind:'booking.created', text:'Booked Court I', source:'Make.com', createdAt:new Date() })
  await flushPromises()
  expect(w.get('[role="status"]').text()).toBe('Loading…')
  fail(new Error('offline')); await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe(message('members and activity'))
  await retry(w).trigger('click'); await flushPromises()
  expect(api.fetchBookings).toHaveBeenCalledTimes(3)
  expect(w.find('[role="alert"]').exists()).toBe(false)
  expect(w.text()).toContain('Booked Court I')
})
