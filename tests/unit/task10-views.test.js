import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

const fake = vi.hoisted(() => ({ fetchEquipment:vi.fn(), fetchClosedDays:vi.fn(), fetchLoans:vi.fn(), fetchAvailability:vi.fn(), createLoan:vi.fn(), fetchCourts:vi.fn(), fetchMyBookings:vi.fn(), fetchEvents:vi.fn(), show:vi.fn(), signOut:vi.fn(), setMode:vi.fn() }))
vi.mock('../../src/lib/api.js', () => fake)
vi.mock('../../src/composables/useAuth.js', () => ({ useAuth:() => ({ profile:ref({ id:'u1', fullName:'Napat Srisuk', studentId:'6638012321', program:'ICE', year:3, role:'student' }), ready:Promise.resolve(), isAdmin:ref(false), signOut:fake.signOut, setMode:fake.setMode }) }))
vi.mock('../../src/composables/useToast.js', () => ({ useToast:() => ({ show:fake.show }) }))
import Borrow from '../../src/views/Borrow.vue'
import Club from '../../src/views/Club.vue'
import Profile from '../../src/views/Profile.vue'

const wrappers = []
const render = component => { const w = mount(component); wrappers.push(w); return w }
const button = (w, text) => w.findAll('button').find(b => b.text() === text)
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake:['Date'] })
  vi.setSystemTime(new Date('2026-11-10T18:30:00Z'))
  fake.fetchEquipment.mockResolvedValue([{ id:'racket', name:'Racket', plural:'Rackets', total:8, maxPerDay:2 }, { id:'balls', name:'Can of balls', plural:'Cans of balls', total:12, maxPerDay:2 }])
  fake.fetchClosedDays.mockResolvedValue({ '2026-11-13':'The courts are closed that day.' })
  fake.fetchLoans.mockResolvedValue([])
  fake.fetchAvailability.mockResolvedValue({ racket:8, balls:12 })
  fake.createLoan.mockImplementation(async loan => ({ ...loan, id:'l1', userId:'u1', status:'reserved' }))
  fake.fetchCourts.mockResolvedValue([{ id:1, name:'Court I', status:'open' }, { id:2, name:'Court II', status:'closed' }])
  fake.fetchMyBookings.mockResolvedValue([])
  fake.fetchEvents.mockResolvedValue([])
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.useRealTimers() })

test('borrow uses seven Bangkok days, closed-day toast and date availability', async () => {
  const w = render(Borrow)
  await flushPromises()
  const days = w.findAll('.dchip')
  expect(days).toHaveLength(7)
  expect(days[0].attributes('aria-label')).toBe('Wednesday 11 November')
  expect(days[0].attributes('aria-pressed')).toBe('true')
  expect(days[2].classes()).toContain('off')
  await days[2].trigger('click')
  expect(fake.show).toHaveBeenCalledWith('The courts are closed that day.')
  expect(fake.fetchAvailability).toHaveBeenCalledTimes(1)
  await days[1].trigger('click'); await flushPromises()
  expect(fake.fetchAvailability).toHaveBeenLastCalledWith('2026-11-12')
})
test('borrow steppers enforce availability and max rules; reservation populates Your loans', async () => {
  fake.fetchAvailability.mockResolvedValue({ racket:1, balls:12 })
  const w = render(Borrow)
  await flushPromises()
  await w.find('[aria-label="One more racket"]').trigger('click')
  await w.find('[aria-label="One more racket"]').trigger('click')
  expect(fake.show).toHaveBeenLastCalledWith('Only 1 free that day.')
  const addBalls = w.find('[aria-label="One more can of balls"]')
  await addBalls.trigger('click'); await addBalls.trigger('click'); await addBalls.trigger('click')
  expect(fake.show).toHaveBeenLastCalledWith('Up to 2 cans of balls a day.')
  await button(w, 'Reserve for Wed 11 Nov').trigger('click'); await flushPromises()
  expect(fake.createLoan).toHaveBeenCalledWith({ date:'2026-11-11', racket:1, balls:2 })
  expect(w.find('.loan-list').text()).toContain('1 racket and 2 cans of balls')
  expect(w.findAll('.stepper > span').map(n => n.text())).toEqual(['0','0'])
  await w.find('[aria-label="One more racket"]').trigger('click')
  await button(w, 'Reserve for Wed 11 Nov').trigger('click')
  expect(w.find('[role="alert"]').text()).toBe('You already have equipment reserved for Wed 11 Nov.')
  expect(fake.createLoan).toHaveBeenCalledTimes(1)
})
test('borrow does not overwrite selected-day availability with a stale response', async () => {
  const w = render(Borrow); await flushPromises()
  let resolveOld
  fake.fetchAvailability.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce({ racket:2, balls:3 })
  await w.findAll('.dchip')[1].trigger('click')
  await w.findAll('.dchip')[3].trigger('click'); await flushPromises()
  resolveOld({ racket:0, balls:0 }); await flushPromises()
  expect(w.findAll('.avail').map(n => n.text())).toEqual(['2 of 8 free, up to 2 each','3 of 12 free, up to 2 each'])
})
test('borrow quantities can always decrease after switching to a day with no availability', async () => {
  const w = render(Borrow); await flushPromises()
  for (const label of ['One more racket','One more can of balls']) {
    await w.find(`[aria-label="${label}"]`).trigger('click')
    await w.find(`[aria-label="${label}"]`).trigger('click')
  }
  fake.fetchAvailability.mockResolvedValueOnce({ racket:0, balls:0 })
  await w.findAll('.dchip')[1].trigger('click'); await flushPromises()
  for (const label of ['One fewer racket','One fewer can of balls']) {
    await w.find(`[aria-label="${label}"]`).trigger('click')
    await w.find(`[aria-label="${label}"]`).trigger('click')
  }
  expect(w.findAll('.stepper > span').map(n => n.text())).toEqual(['0','0'])
  expect(fake.show).not.toHaveBeenCalled()
  await w.find('[aria-label="One more racket"]').trigger('click')
  expect(fake.show).toHaveBeenCalledWith('Only 0 free that day.')
  expect(w.findAll('.stepper > span').map(n => n.text())).toEqual(['0','0'])
})
test('borrow validates empty submission and displays server reservation failure', async () => {
  const w = render(Borrow); await flushPromises()
  await button(w, 'Reserve for Wed 11 Nov').trigger('click')
  expect(w.find('[role="alert"]').text()).toBe('Choose a racket or a can of balls first.')
  fake.createLoan.mockRejectedValueOnce(new Error('Only 0 free that day.'))
  await w.find('[aria-label="One more racket"]').trigger('click')
  await button(w, 'Reserve for Wed 11 Nov').trigger('click'); await flushPromises()
  expect(w.find('[role="alert"]').text()).toBe('Only 0 free that day.')
  expect(w.find('.loan-list').exists()).toBe(false)
})
test('leaving borrow while a reservation is pending does not toast on another screen', async () => {
  let finish
  fake.createLoan.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const w = render(Borrow); await flushPromises()
  await w.find('[aria-label="One more racket"]').trigger('click')
  await button(w, 'Reserve for Wed 11 Nov').trigger('click')
  w.unmount()
  finish({ id:'l1', userId:'u1', date:'2026-11-11', racket:1, balls:0, status:'reserved' })
  await flushPromises()
  expect(fake.show).not.toHaveBeenCalled()
  expect(fake.fetchAvailability).toHaveBeenCalledTimes(1)
})
test('club preserves exact facts, links, rules and official gradient glyph', async () => {
  const w = render(Club); await flushPromises()
  expect(w.find('.place-card').attributes('href')).toBe('https://maps.app.goo.gl/4LWxM2rodPUCLwEK8')
  expect(w.find('.ig-card').attributes('href')).toBe('https://www.instagram.com/intaniatennisclub/')
  expect(w.find('[href="tel:+66617830155"]').exists()).toBe(true)
  expect(w.find('.phone').text()).toBe('061-783-0155')
  expect(w.find('.place-card').text()).toContain('Chulalongkorn University, Pathum Wan, Bangkok')
  expect(w.findAll('.rules li')).toHaveLength(6)
  expect(w.findAll('radialGradient stop')).toHaveLength(5)
  expect(w.find('[aria-label="Instagram"]').attributes('viewBox')).toBe('0 0 24 24')
  expect(w.find('.status-list').text()).toContain('Court IIClosed')
})
test('club copy uses clipboard with exact failure fallback', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText } })
  try {
    const w = render(Club); await flushPromises()
    await button(w, 'Copy').trigger('click'); await flushPromises()
    expect(writeText).toHaveBeenCalledWith('0617830155')
    expect(fake.show).toHaveBeenLastCalledWith('Number copied.')
    writeText.mockRejectedValueOnce(new Error('Denied'))
    await button(w, 'Copy').trigger('click'); await flushPromises()
    expect(fake.show).toHaveBeenLastCalledWith('Copy the number: 061-783-0155')
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value:undefined })
    await button(w, 'Copy').trigger('click'); await flushPromises()
    expect(fake.show).toHaveBeenLastCalledWith('Copy the number: 061-783-0155')
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous)
    else delete navigator.clipboard
  }
})
test('profile uses real Bangkok clock for summary, heat map and member event log', async () => {
  fake.fetchMyBookings.mockResolvedValue([
    { id:'b1', userId:'u1', date:'2026-11-05', start:18, end:20, status:'confirmed' },
    { id:'b2', userId:'u1', date:'2026-11-10', start:18, end:19, status:'confirmed' },
    { id:'b3', userId:'u1', date:'2026-11-01', start:16, end:17, status:'cancelled' },
  ])
  fake.fetchEvents.mockResolvedValue(Array.from({ length:7 }, (_,i) => ({ id:i, userId:'u1', kind:'booking.created', text:'Booked hour ' + i, createdAt:new Date('2026-11-10T18:00:00Z') })))
  const w = render(Profile); await flushPromises()
  expect(fake.fetchMyBookings).toHaveBeenCalledWith('u1')
  expect(fake.fetchEvents).toHaveBeenCalledWith({ userId:'u1' })
  expect(w.find('.summary').text()).toBe('3 hours on court across 2 games since 5 November. You book 18:00 most often, and you have cancelled once.')
  expect(w.find('.heat-in .today').attributes('title')).toContain('Wed 11 Nov')
  expect(w.findAll('.timeline li')).toHaveLength(6)
  expect(w.find('.timeline').text()).toContain('Today, 01:00')
  await button(w, 'Show 6 more').trigger('click')
  expect(w.findAll('.timeline li')).toHaveLength(7)
  await button(w, 'Sign out').trigger('click')
  expect(fake.signOut).toHaveBeenCalledOnce()
})
test('profile has exact empty copy and retry recovers a failed request', async () => {
  fake.fetchMyBookings.mockRejectedValueOnce(new Error('Connection lost.'))
  const w = render(Profile); await flushPromises()
  expect(w.find('[role="alert"]').text()).toBe("Couldn't load your playing history. Check your connection and try again.")
  await button(w, 'Try again').trigger('click'); await flushPromises()
  expect(w.find('.summary').text()).toBe('No games played yet. Your first booking will show here.')
  expect(w.text()).toContain('Bookings and loans you make are logged here.')
})
