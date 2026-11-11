import { mount } from '@vue/test-utils'
import CourtArt from '../../src/components/CourtArt.vue'

test('closed court has plaque and accessible label', () => {
  const w = mount(CourtArt, { props:{ closed:true, label:'Court II' } })
  expect(w.text()).toContain('CLOSED')
  expect(w.attributes('aria-label')).toBe('Court II, closed')
})
test('open court has no closed plaque and repeated drawings have unique patterns', () => {
  const first = mount(CourtArt, { props:{ label:'Court I' } })
  const second = mount(CourtArt)
  expect(first.text()).not.toContain('CLOSED')
  expect(first.attributes('aria-label')).toBe('Court I')
  expect(first.find('pattern').attributes('id')).not.toBe(second.find('pattern').attributes('id'))
})
