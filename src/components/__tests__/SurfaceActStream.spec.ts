import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the oldest-to-newest desktop window with assertions and limited proof', async () => {
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
    expect(records[0]!.find('.surface-act-inscription').attributes('aria-label')).toBe(
      'Identity recorded for axone1oldest.',
    )
    expect(records[0]!.find('.surface-act-entry').text()).toContain('1.0.0')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('txTX-1')
    expect(records[0]!.find('.surface-act-proof').text()).toContain('time2026-07-09 12:01 UTC')
    expect(wrapper.text()).not.toContain('HEIGHT')
    expect(wrapper.text()).not.toContain('MSG')
    expect(wrapper.find('.surface-act-column-head').text()).toBe('ENTRYSTATEMENTEVIDENCE')
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

  it('retains only the eight latest desktop records', async () => {
    const acts = [
      makeAct('TX-9', 9, 'axone1newest'),
      makeAct('TX-8', 8, 'axone1eight'),
      makeAct('TX-7', 7, 'axone1seven'),
      makeAct('TX-6', 6, 'axone1six'),
      makeAct('TX-5', 5, 'axone1five'),
      makeAct('TX-4', 4, 'axone1four'),
      makeAct('TX-3', 3, 'axone1three'),
      makeAct('TX-2', 2, 'axone1two'),
      makeAct('TX-1', 1, 'axone1oldest'),
    ]
    const wrapper = mount(SurfaceActStream, {
      props: { acts, loading: false, reducedMotion: true, polling: false },
    })

    await nextTick()

    expect(wrapper.findAll('.surface-act-record')).toHaveLength(8)
    expect(wrapper.text()).not.toContain('axone1oldest')
    expect(wrapper.text()).toContain('axone1two')
    expect(wrapper.text()).toContain('axone1newest')
  })

  it('shows only the five latest records on compact viewports', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    )
    const acts = Array.from({ length: 8 }, (_, index) => {
      const height = 8 - index
      return makeAct(`TX-${height}`, height, `axone1${height}`)
    })
    const wrapper = mount(SurfaceActStream, {
      props: { acts, loading: false, reducedMotion: true, polling: false },
    })

    await nextTick()
    await nextTick()

    expect(wrapper.findAll('.surface-act-record')).toHaveLength(5)
    expect(wrapper.text()).not.toContain('axone11')
    expect(wrapper.text()).toContain('axone14')
    expect(wrapper.text()).toContain('axone18')
  })
})
