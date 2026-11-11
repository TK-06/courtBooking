import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
const fake = vi.hoisted(() => ({ show:vi.fn(), unsubscribe:vi.fn(), onEvent:null }))
vi.mock('../../src/lib/api.js', () => ({ fetchCourts:vi.fn(), fetchBookings:vi.fn(), fetchProfiles:vi.fn(), fetchLoans:vi.fn(), fetchEvents:vi.fn(), fetchEquipment:vi.fn(), fetchAvailability:vi.fn(), cancelBooking:vi.fn(), updateCourt:vi.fn(), setLoanStatus:vi.fn(), subscribeEvents:vi.fn() }))
vi.mock('../../src/composables/useToast.js', () => ({ useToast:() => ({show:fake.show}) }))
import * as api from '../../src/lib/api.js'
import AdminToday from '../../src/views/admin/AdminToday.vue'
import AdminBookings from '../../src/views/admin/AdminBookings.vue'
import AdminCourts from '../../src/views/admin/AdminCourts.vue'
import AdminEquipment from '../../src/views/admin/AdminEquipment.vue'
import AdminMembers from '../../src/views/admin/AdminMembers.vue'
const student = {id:'u',fullName:'Napat Srisuk',studentId:'6638012321',program:'ICE',role:'student'}
const court = {id:1,name:'Court I',status:'open',note:''}
const booking = {id:'b',userId:'u',courtId:1,code:'ITC-1111-0001',date:'2026-11-11',start:18,end:20,status:'confirmed',purpose:null}
const club = {...booking,id:'club',code:'ITC-1111-0002',start:8,end:9,purpose:'Club training'}
const loan = {id:'l',userId:'u',date:'2026-11-11',racket:1,balls:2,status:'reserved'}
const event = {id:1,userId:'u',kind:'booking.created',text:'Booked Court I',source:'Make.com',createdAt:new Date('2026-11-10T18:00:00Z')}
let wrappers=[]
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T18:30:00Z'))
  api.fetchCourts.mockResolvedValue([court,{id:2,name:'Court II',status:'closed',note:'Resurfacing'}])
  api.fetchBookings.mockResolvedValue([booking,club])
  api.fetchProfiles.mockResolvedValue([student,{id:'a',fullName:'Club Admin',role:'admin'}])
  api.fetchLoans.mockResolvedValue([loan])
  api.fetchEvents.mockResolvedValue([event])
  api.fetchEquipment.mockResolvedValue([{id:'racket',plural:'Rackets',total:8},{id:'balls',plural:'Cans of balls',total:12}])
  api.fetchAvailability.mockResolvedValue({racket:7,balls:10})
  api.subscribeEvents.mockImplementation(callback=>{fake.onEvent=callback;return fake.unsubscribe})
})
afterEach(()=>{ wrappers.forEach(w=>w.unmount()); wrappers=[]; vi.useRealTimers() })
async function render(component,query={}) {
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',name:'test',component},{path:'/booking/:id',name:'booking/:id',component:{template:'<div/>'}},{path:'/book',name:'book',component:{template:'<div/>'}},{path:'/members',name:'admin-members',component:{template:'<div/>'}},{path:'/equipment',name:'admin-equipment',component:{template:'<div/>'}}]})
  await router.push({name:'test',query}); await router.isReady()
  const w=mount(component,{global:{plugins:[router]}}); wrappers.push(w); await flushPromises()
  return {w,router}
}
const button=(w,text)=>w.findAll('button').find(b=>b.text()===text)
test('Today uses Bangkok date, four figures, hourly initials/ITC, latest six and equipment',async()=>{
  api.fetchEvents.mockResolvedValue(Array.from({length:8},(_,i)=>({...event,id:i,text:'Action '+i,createdAt:new Date(event.createdAt.getTime()+i*1000)})))
  const {w,router}=await render(AdminToday)
  expect(api.fetchBookings).toHaveBeenCalledWith({from:'2026-11-11',to:'2026-11-11'})
  expect(w.findAll('.kpi .v').map(n=>n.text())).toEqual(['2','21%','0','1/2'])
  expect(w.findAll('.sc')).toHaveLength(28)
  expect(w.findAll('.sc.b').map(n=>n.text())).toEqual(['ITC','NS','NS'])
  expect(w.find('.sr-name').text()).toBe('Court I')
  expect(w.findAll('.timeline')[0].findAll('li')).toHaveLength(6)
  expect(w.text()).toContain('Napat Srisuk: 1 racket and 2 cans of balls')
  await button(w,'Book for the club').trigger('click'); await flushPromises()
  expect(router.currentRoute.value.name).toBe('book')
})
test('Bookings reads and writes q/tab and reacts to browser navigation',async()=>{
  const {w,router}=await render(AdminBookings,{q:booking.code,tab:'upcoming',keep:'yes'})
  expect(w.findAll('tbody tr')).toHaveLength(1)
  await w.find('#ab-search').setValue('Napat'); await flushPromises()
  expect(router.currentRoute.value.query).toEqual({q:'Napat',tab:'upcoming',keep:'yes'})
  await button(w,'Past').trigger('click'); await flushPromises()
  expect(router.currentRoute.value.query.tab).toBe('past')
  await router.push({query:{q:booking.code,tab:'upcoming'}}); await flushPromises()
  expect(w.find('#ab-search').element.value).toBe(booking.code)
  await button(w,'View').trigger('click'); await flushPromises()
  expect(router.currentRoute.value.name).toBe('booking/:id')
  expect(router.currentRoute.value.params).toEqual({id:'b'})
})
test('Bookings sends strict cancel payload, prevents duplicate submission and reports the exact student toast',async()=>{
  let resolve
  api.cancelBooking.mockImplementation(()=>new Promise(done=>{resolve=done}))
  const {w}=await render(AdminBookings,{q:booking.code,tab:'upcoming'})
  await button(w,'Cancel').trigger('click')
  await button(w,'Club event').trigger('click')
  await w.find('#cancel-note').setValue('The court is needed for the final today.')
  await w.find('#ack-1').setValue(true); await w.find('#ack-2').setValue(true)
  await button(w,'Cancel booking').trigger('click'); await button(w,'Cancel booking').trigger('click')
  expect(api.cancelBooking).toHaveBeenCalledOnce()
  expect(api.cancelBooking).toHaveBeenCalledWith('b',{reason:'Club event',note:'The court is needed for the final today.'})
  resolve({...booking,status:'cancelled'}); await flushPromises()
  expect(fake.show).toHaveBeenCalledWith("Napat's booking is cancelled. They'll see your message.")
  expect(w.find('[role="dialog"]').exists()).toBe(false)
})
test('Bookings permits cancellation of live/past confirmed club bookings and reports club toast',async()=>{
  api.fetchBookings.mockResolvedValue([{...club,date:'2026-11-10'}])
  api.cancelBooking.mockResolvedValue({...club,status:'cancelled'})
  const {w}=await render(AdminBookings,{tab:'past'})
  await button(w,'Cancel').trigger('click'); await button(w,'Other').trigger('click')
  await w.find('#cancel-note').setValue('This session did not take place.')
  await w.find('#ack-1').setValue(true); await button(w,'Cancel booking').trigger('click'); await flushPromises()
  expect(fake.show).toHaveBeenCalledWith('Club booking cancelled.')
})
test('Courts saves via updateCourt, counts upcoming bookings and clears reopening note',async()=>{
  api.updateCourt.mockImplementation(async(id,patch)=>({...court,id,...patch}))
  const {w}=await render(AdminCourts)
  const first=w.find('.court-admin')
  expect(first.text()).toContain('2 upcoming bookings on this court.')
  await first.findAll('[role="radio"]')[1].trigger('click')
  await first.find('textarea').setValue('  Closed for an event.  ')
  await button(first,'Save Court I').trigger('click'); await flushPromises()
  expect(api.updateCourt).toHaveBeenLastCalledWith(1,{status:'closed',note:'Closed for an event.'})
  await first.findAll('[role="radio"]')[0].trigger('click')
  await button(first,'Save Court I').trigger('click'); await flushPromises()
  expect(api.updateCourt).toHaveBeenLastCalledWith(1,{status:'open',note:''})
})
test('Equipment advances reserved/out/returned with refreshed availability',async()=>{
  api.setLoanStatus.mockImplementation(async(id,status)=>({...loan,id,status}))
  const {w}=await render(AdminEquipment)
  expect(w.findAll('.kpi .v').map(n=>n.text())).toEqual(['7/8','10/12','0'])
  await button(w,'Mark picked up').trigger('click'); await flushPromises()
  expect(api.setLoanStatus).toHaveBeenLastCalledWith('l','out')
  expect(w.text()).toContain('Picked up')
  expect(w.findAll('.kpi .v')[2].text()).toBe('3')
  await button(w,'Mark returned').trigger('click'); await flushPromises()
  expect(api.setLoanStatus).toHaveBeenLastCalledWith('l','returned')
  expect(api.fetchAvailability).toHaveBeenCalledTimes(3)
  expect(w.text()).toContain('Returned')
})
test('Members filters students, counts bookings, filters logs by member/kind and cleans up live subscription',async()=>{
  const {w}=await render(AdminMembers)
  expect(w.findAll('.mrow:not(.all)')).toHaveLength(1)
  expect(w.find('.mr-stats').text()).toContain('2 bookings')
  expect(w.find('.mr-stats').text()).toContain('30 min ago')
  expect(w.find('thead').text()).toContain('Logged by')
  expect(w.find('td .chip.camel').text()).toBe('Make.com')
  fake.onEvent({...event,id:2,kind:'court.closed',userId:'a',text:'Closed Court II',source:'App',createdAt:new Date()})
  await flushPromises()
  await button(w,'Courts').trigger('click')
  expect(w.findAll('tbody tr')).toHaveLength(1)
  expect(w.find('td .chip.muted').text()).toBe('App')
  await w.find('.mrow:not(.all)').trigger('click')
  expect(w.find('.act-head h2').text()).toBe('Napat Srisuk')
  expect(w.text()).toContain('No activity yet.')
  await w.find('#m-search').setValue('6638012321')
  expect(w.findAll('.mrow:not(.all)')).toHaveLength(1)
  w.unmount(); wrappers=[]
  expect(fake.unsubscribe).toHaveBeenCalledOnce()
})
test('admin load errors are visible and retry performs the read again',async()=>{
  api.fetchCourts.mockRejectedValueOnce(new Error('Connection unavailable.'))
  const {w}=await render(AdminCourts)
  expect(w.find('[role="alert"]').text()).toContain("Couldn't load courts. Check your connection and try again.")
  await button(w,'Try again').trigger('click'); await flushPromises()
  expect(w.findAll('.court-admin')).toHaveLength(2)
})
test.each([AdminToday,AdminEquipment])('today-based admin data follows Bangkok midnight and clears its clock',async component=>{
  vi.setSystemTime(new Date('2026-11-10T16:59:30Z'))
  const {w}=await render(component)
  await vi.advanceTimersByTimeAsync(60000); await flushPromises()
  if (component===AdminToday) expect(api.fetchBookings).toHaveBeenLastCalledWith({from:'2026-11-11',to:'2026-11-11'})
  else expect(api.fetchAvailability).toHaveBeenLastCalledWith('2026-11-11')
  w.unmount(); wrappers=[]
  expect(vi.getTimerCount()).toBe(0)
})
