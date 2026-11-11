import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import HeatMap from '../../src/components/HeatMap.vue'
import { buildHeatMap } from '../../src/lib/rules.js'

test('heat map renders 84 cells, one two-hour game and Bangkok today', () => {
  const columns = buildHeatMap({ bookings:[{ userId:'u1', date:'2026-11-05', start:18, end:20, status:'confirmed' }], userId:'u1', now:new Date('2026-11-10T18:30:00Z') })
  const w = mount(HeatMap, { props:{ columns } })
  expect(w.findAll('.heat-in .hc')).toHaveLength(84)
  expect(w.findAll('.heat-in .h2')).toHaveLength(1)
  expect(w.findAll('.heat-in .today')).toHaveLength(1)
  expect(w.find('.today').attributes('title')).toContain('Wed 11 Nov')
  expect(w.find('.heat-legend').text()).toBe('No game1 hour2 hoursBooked')
})
