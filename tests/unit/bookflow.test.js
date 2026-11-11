import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import StepDate from '../../src/views/steps/StepDate.vue'
import StepSlots from '../../src/views/steps/StepSlots.vue'
import StepReview from '../../src/views/steps/StepReview.vue'
import BookFlow from '../../src/views/BookFlow.vue'
import { MESSAGES } from '../../src/lib/rules.js'

const fake = vi.hoisted(() => ({ courts:vi.fn(), closed:vi.fn(), bookings:vi.fn(), profiles:vi.fn(), create:vi.fn(), push:vi.fn(), show:vi.fn(), auth:null, route:null }))
vi.mock('../../src/lib/api.js', () => ({ fetchCourts:fake.courts, fetchClosedDays:fake.closed, fetchBookings:fake.bookings, fetchProfiles:fake.profiles, createBooking:fake.create }))
vi.mock('../../src/composables/useAuth.js', () => ({ useAuth:() => fake.auth }))
vi.mock('../../src/composables/useToast.js', () => ({ useToast:() => ({ show:fake.show }) }))
vi.mock('vue-router', () => ({ useRoute:() => fake.route, useRouter:() => ({ push:fake.push }) }))
const courts = [{ id:1, name:'Court I', status:'open', note:'' }, { id:2, name:'Court II', status:'closed', note:'Resurfacing.' }]
const booking = { id:'b1', userId:'u2', courtId:1, date:'2026-11-12', start:18, end:19, status:'confirmed', code:'ITC-1112-0001', purpose:null }
const wrappers = []
function render(component, options) { const w = mount(component, options); wrappers.push(w); return w }
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake:['Date'] })
  vi.setSystemTime(new Date('2026-11-10T06:20:00Z'))
  fake.auth = { profile:ref({ id:'u1', fullName:'Napat Srisuk', studentId:'6638012321' }), session:ref({ user:{ id:'u1' } }), mode:ref('student'), isAdmin:ref(false) }
  fake.route = { query:{ court:'1' } }
  fake.courts.mockResolvedValue(courts)
  fake.closed.mockResolvedValue({})
  fake.bookings.mockResolvedValue([])
  fake.profiles.mockResolvedValue([{ id:'u2', fullName:'Pim Jaidee' }])
  fake.create.mockResolvedValue({ ...booking, userId:'u1' })
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.useRealTimers() })
test('admin taken hour identifies holder and emits the exact booking to open', async () => {
  const w = render(StepSlots, { props:{ slots:[{ h:18, state:'booked', b:booking }], role:'admin', courts, courtId:1, profiles:[{ id:'u2', fullName:'Pim Jaidee' }] } })
  await w.get('.slot').trigger('click')
  expect(w.get('.blocked').text()).toContain('18:00 belongs to Pim Jaidee (ITC-1112-0001, 18:00–19:00).')
  expect(w.text()).toContain("Club bookings never replace a student's booking. To free this hour, cancel theirs under Bookings and explain why.")
  await w.get('.blocked .btn').trigger('click')
  expect(w.emitted('open-bookings')[0]).toEqual([booking])
  await w.get('.blocked .linkbtn').trigger('click')
  expect(w.find('.blocked').exists()).toBe(false)
})
test('student slots have the exact limit hint and never disclose another name', async () => {
  const w = render(StepSlots, { props:{ slots:[{ h:18, state:'booked', b:booking }], role:'student', courts, courtId:1, profiles:[{ id:'u2', fullName:'Pim Jaidee' }] } })
  expect(w.get('.hint').text()).toBe('Up to 2 hours a day, back to back')
  expect(w.get('.slot-state').text()).toBe('Booked')
  await w.get('.slot').trigger('click')
  expect(w.find('.blocked').exists()).toBe(false)
  expect(w.text()).not.toContain('Pim')
})
test('admin review needs no title and no agreement', () => {
  const w = render(StepReview, { props:{ booking, profile:fake.auth.profile.value, role:'admin' } })
  expect(w.find('#purpose').exists()).toBe(false)
  expect(w.text()).toContain('Students see these hours as booked by the club.')
  expect(w.find('#agree').exists()).toBe(false)
  expect(w.text()).not.toContain('Student ID')
  expect(w.find('.addon').exists()).toBe(false)
})
test('student review includes all six exact rule titles and agreement', async () => {
  const w = render(StepReview, { props:{ booking, profile:fake.auth.profile.value, role:'student' } })
  expect(w.findAll('.rules strong').map(n => n.text())).toEqual(['Open every day, 08:00 to 22:00','Up to 2 hours a day','Please bring your own equipment','Tidy up after your session','Cancel at least 2 hours before','Arrive on time'])
  await w.get('#agree').setValue(true)
  expect(w.emitted('update:agree')[0]).toEqual([true])
  expect(w.find('#purpose').exists()).toBe(false)
})
test('calendar spans the admin window, uses Bangkok date, and displays at least two student months', () => {
  const now = new Date('2026-11-30T18:30:00Z')
  const student = render(StepDate, { props:{ now, role:'student', courts } })
  expect(student.findAll('.month')).toHaveLength(2)
  expect(student.get('.today').attributes('aria-label')).toContain('Tuesday 1 December')
  const admin = render(StepDate, { props:{ now, role:'admin', courts } })
  expect(admin.findAll('.month')).toHaveLength(4)
})
async function review(w, hours=[18,19]) {
  await flushPromises()
  await w.get('[aria-label="Thursday 12 November, open"]').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  for (const h of hours) await w.get(`.slot[aria-label^="${h}:00 to"]`).trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
}
test('student flow requires agreement, enforces two hours and shows issued code', async () => {
  const w = render(BookFlow)
  await review(w)
  await w.get('.flow-bar .btn').trigger('click')
  expect(w.get('[role="alert"]').text()).toBe("Tick the box to confirm you've read the rules.")
  expect(fake.create).not.toHaveBeenCalled()
  await w.get('#agree').setValue(true)
  await w.get('.flow-bar .btn').trigger('click')
  await flushPromises()
  expect(fake.create).toHaveBeenCalledWith({ courtId:1, date:'2026-11-12', start:18, end:20, purpose:null })
  expect(w.text()).toContain("You're booked.")
  expect(w.text()).toContain('ITC-1112-0001')
})
test('a third selected student hour is refused with the rules message', async () => {
  const w = render(BookFlow)
  await flushPromises()
  await w.get('[aria-label="Thursday 12 November, open"]').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  for (const h of [18,19,20]) await w.get(`.slot[aria-label^="${h}:00 to"]`).trigger('click')
  expect(w.findAll('.s-selected')).toHaveLength(2)
  expect(fake.show).toHaveBeenCalledWith(MESSAGES.maxHours)
})
test('overlap error refetches the selected date and returns to hours', async () => {
  fake.create.mockRejectedValue(new Error(MESSAGES.taken))
  const w = render(BookFlow)
  await review(w)
  await w.get('#agree').setValue(true)
  fake.bookings.mockResolvedValue([booking])
  await w.get('.flow-bar .btn').trigger('click')
  await flushPromises()
  expect(fake.show).toHaveBeenCalledWith(MESSAGES.taken)
  expect(fake.bookings).toHaveBeenLastCalledWith({ from:'2026-11-12', to:'2026-11-12' })
  expect(w.find('.s2').exists()).toBe(true)
  expect(w.get('.slot[aria-label^="18:00 to"]').classes()).toContain('s-booked')
})
test('admin flow supports more than two hours, marks it as a club booking, and opens a blocked booking by code', async () => {
  fake.auth.mode.value = 'admin'; fake.auth.isAdmin.value = true
  fake.bookings.mockResolvedValue([booking])
  const w = render(BookFlow)
  await flushPromises()
  await w.get('[aria-label="Thursday 12 November, open"]').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  await w.get('.slot[aria-label^="18:00 to"]').trigger('click')
  await w.get('.blocked .btn').trigger('click')
  expect(fake.push).toHaveBeenCalledWith({ name:'admin-bookings', query:{ q:booking.code, tab:'upcoming' } })
  for (const h of [8,9,10]) await w.get(`.slot[aria-label^="${String(h).padStart(2,'0')}:00 to"]`).trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  await flushPromises()
  expect(fake.create).toHaveBeenCalledWith({ courtId:1, date:'2026-11-12', start:8, end:11, purpose:'Club booking' })
})
test('an existing student hour requires the next booking to be adjacent across courts', async () => {
  fake.bookings.mockResolvedValue([{ ...booking, courtId:2, userId:'u1', start:18, end:19 }])
  const w = render(BookFlow)
  await review(w, [20])
  expect(w.find('.s2').exists()).toBe(true)
  expect(fake.show).toHaveBeenLastCalledWith(MESSAGES.adjacent)
  expect(fake.create).not.toHaveBeenCalled()
})
test('admin mode without admin permission keeps the student flow', async () => {
  fake.auth.mode.value = 'admin'
  const w = render(BookFlow)
  await review(w, [18])
  expect(w.find('#agree').exists()).toBe(true)
  expect(w.find('#purpose').exists()).toBe(false)
  expect(fake.profiles).not.toHaveBeenCalled()
})
test('a pending create prevents duplicate submissions and a generic error retains review', async () => {
  let fail
  fake.create.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
  const w = render(BookFlow)
  await review(w, [18])
  await w.get('#agree').setValue(true)
  await w.get('.flow-bar .btn').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  expect(fake.create).toHaveBeenCalledTimes(1)
  expect(w.get('.flow-bar .btn').attributes('disabled')).toBeDefined()
  fail(new Error('Something went wrong. Try again.'))
  await flushPromises()
  expect(w.find('.s3').exists()).toBe(true)
  expect(w.get('#agree').element.checked).toBe(true)
  expect(fake.show).toHaveBeenCalledWith('Something went wrong. Try again.')
})
test('advancing from a scrolled calendar starts the hour step at the top', async () => {
  const w = render(BookFlow)
  await flushPromises()
  await w.get('[aria-label="Thursday 12 November, open"]').trigger('click')
  document.documentElement.scrollTop = 500
  document.body.scrollTop = 500
  await w.get('.flow-bar .btn').trigger('click')
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.body.scrollTop).toBe(0)
})
test('an hour that starts during review is cleared so the student can pick again', async () => {
  const w = render(BookFlow)
  await flushPromises()
  await w.get('[aria-label="Tuesday 10 November, open"]').trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  for (const h of [14,15]) await w.get(`.slot[aria-label^="${h}:00 to"]`).trigger('click')
  await w.get('.flow-bar .btn').trigger('click')
  await w.get('#agree').setValue(true)
  vi.setSystemTime(new Date('2026-11-10T07:01:00Z'))
  await w.get('.flow-bar .btn').trigger('click')
  expect(w.find('.s2').exists()).toBe(true)
  expect(w.findAll('.s-selected')).toHaveLength(0)
  await w.get('.slot[aria-label^="16:00 to"]').trigger('click')
  expect(w.get('.slot[aria-label^="16:00 to"]').classes()).toContain('s-selected')
  expect(fake.create).not.toHaveBeenCalled()
})
