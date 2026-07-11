import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import SurfaceActLine from '../SurfaceActLine.vue'
import SurfaceActStream from '../SurfaceActStream.vue'

function makeAct(id: string, height: number, signer: string) {
  return {
    id: `${id}:0:0`,
    kind: 'identity.created' as const,
    txhash: id,
    msgIndex: 0,
    actIndex: 0,
    height,
    entry: `${height}.0.0`,
    timestamp: `2026-07-09T12:0${height}:00Z`,
    signer,
    contractAddress: 'axone1contract',
    action: 'instantiate',
    title: 'IDENTITY REGISTERED',
    description: 'Identity recorded.',
    assertion: `Identity recorded for ${signer}.`,
    payload: {},
  }
}

describe('SurfaceActStream', () => {
  it('renders the oldest-to-newest three-record window with assertions and limited proof', async () => {
    const oldest = makeAct('TX-1', 1, 'axone1oldest')
    const newest = makeAct('TX-2', 2, 'axone1newest')
    const wrapper = mount(SurfaceActStream, {
      props: { acts: [newest, oldest], loading: false, reducedMotion: true, polling: false },
    })

    await nextTick()

    const records = wrapper.findAll('.surface-act-record')
    expect(records).toHaveLength(2)
    expect(records[0]!.text()).toContain('Identity recorded for axone1oldest.')
    expect(records[1]!.text()).toContain('Identity recorded for axone1newest.')
    expect(records[0]!.find('.surface-act-category').text()).toBe('IDENTITY')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('entry1.0.0')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('txTX-1')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('time2026-07-09 12:01 UTC')
    expect(wrapper.text()).not.toContain('HEIGHT')
    expect(wrapper.text()).not.toContain('MSG')
    expect(wrapper.find('.surface-act-cursor').exists()).toBe(false)
  })

  it('reveals exactly one record assertion at a time', async () => {
    const oldest = makeAct('TX-1', 1, 'axone1oldest')
    const newest = makeAct('TX-2', 2, 'axone1newest')
    const wrapper = mount(SurfaceActStream, {
      props: { acts: [newest, oldest], loading: false, reducedMotion: false, polling: false },
    })

    expect(wrapper.findAllComponents(SurfaceActLine)).toHaveLength(1)
    expect(wrapper.findComponent(SurfaceActLine).props('typingActive')).toBe(true)

    wrapper.findComponent(SurfaceActLine).vm.$emit('typing-complete')
    await nextTick()
    await nextTick()

    const records = wrapper.findAllComponents(SurfaceActLine)
    expect(records).toHaveLength(2)
    expect(records[0]!.props('typingActive')).toBe(false)
    expect(records[1]!.props('typingActive')).toBe(true)
    expect(wrapper.findAll('.surface-act-cursor')).toHaveLength(1)
  })

  it('retains only the three latest records', async () => {
    const acts = [
      makeAct('TX-4', 4, 'axone1newest'),
      makeAct('TX-3', 3, 'axone1middle'),
      makeAct('TX-2', 2, 'axone1older'),
      makeAct('TX-1', 1, 'axone1oldest'),
    ]
    const wrapper = mount(SurfaceActStream, {
      props: { acts, loading: false, reducedMotion: true, polling: false },
    })

    await nextTick()

    expect(wrapper.findAll('.surface-act-record')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('axone1oldest')
    expect(wrapper.text()).toContain('axone1older')
    expect(wrapper.text()).toContain('axone1newest')
  })
})
