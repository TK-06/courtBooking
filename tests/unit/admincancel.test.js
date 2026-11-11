import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminCancelSheet from '../../src/components/AdminCancelSheet.vue'

const booking = { id:'b', code:'ITC-1112-0001', date:'2026-11-12', courtId:1, start:18, end:19, purpose:null }
const click = (w, text) => w.findAll('button').find(b => b.text() === text).trigger('click')
test('student cancellation requires the three exact errors and both acknowledgements', async () => {
  const w = mount(AdminCancelSheet, { props:{ booking, memberFirst:'Napat' } })
  await click(w, 'Cancel booking')
  expect(w.findAll('[role="alert"]').map(e => e.text())).toEqual(['Pick a reason.', 'Write at least a sentence so Napat knows why.', 'Tick both boxes to confirm.'])
  expect(w.emitted('confirm')).toBeUndefined()
  await click(w, 'Court maintenance')
  await w.find('#cancel-note').setValue('Rain all evening, the court is flooded now.')
  await w.find('#ack-1').setValue(true)
  await click(w, 'Cancel booking')
  expect(w.emitted('confirm')).toBeUndefined()
  await w.find('#ack-2').setValue(true)
  await click(w, 'Cancel booking')
  expect(w.emitted('confirm')).toEqual([[{ reason:'Court maintenance', note:'Rain all evening, the court is flooded now.' }]])
  w.unmount()
})
test('club cancellation needs one checkbox, a 15 character trimmed note, and can close', async () => {
  const w = mount(AdminCancelSheet, { props:{ booking:{ ...booking, purpose:'Club training' }, memberFirst:'Ignored' } })
  await click(w, 'Cancel booking')
  expect(w.text()).toContain('Write at least a sentence for the log.')
  expect(w.text()).toContain('Tick the box to confirm.')
  expect(w.find('#ack-2').exists()).toBe(false)
  await click(w, 'Court maintenance')
  await w.find('#cancel-note').setValue('  123456789012345  ')
  await w.find('#ack-1').setValue(true)
  await click(w, 'Cancel booking')
  expect(w.emitted('confirm')[0]).toEqual([{ reason:'Court maintenance', note:'123456789012345' }])
  await click(w, 'Keep booking')
  expect(w.emitted('close')).toHaveLength(1)
  w.unmount()
})
