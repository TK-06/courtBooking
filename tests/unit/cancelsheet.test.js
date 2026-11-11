import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import CancelSheet from '../../src/components/CancelSheet.vue'
const booking = { id:'b', courtId:1, date:'2026-11-12', start:18, end:20, code:'ITC-1112-0001' }
test('Weather then Cancel booking emits optional reason; Keep booking closes', async () => {
  const w = mount(CancelSheet, { props:{ booking } })
  await w.findAll('.rchip').find(n => n.text()==='Weather').trigger('click')
  await w.get('.btn.danger').trigger('click')
  expect(w.emitted('confirm')).toEqual([[{ reason:'Weather' }]])
  await w.get('.btn.ghost').trigger('click')
  expect(w.emitted('close')).toHaveLength(1)
  w.unmount()
})
test('no reason and deselected reason emit null', async () => {
  const w = mount(CancelSheet, { props:{ booking } })
  await w.get('.btn.danger').trigger('click')
  expect(w.emitted('confirm')[0]).toEqual([{ reason:null }])
  const weather = w.findAll('.rchip').find(n => n.text()==='Weather')
  await weather.trigger('click'); await weather.trigger('click')
  await w.get('.btn.danger').trigger('click')
  expect(w.emitted('confirm')[1]).toEqual([{ reason:null }])
  w.unmount()
})
test('initial focus traps shift-tab, Escape closes, and focus returns to the trigger', async () => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const w = mount(CancelSheet, { props:{ booking }, attachTo:document.body })
  expect(document.activeElement).toBe(w.get('[role="dialog"]').element)
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', shiftKey:true, cancelable:true }))
  expect(document.activeElement).toBe(w.get('.btn.danger').element)
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', cancelable:true }))
  expect(w.emitted('close')).toHaveLength(1)
  w.unmount()
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})
