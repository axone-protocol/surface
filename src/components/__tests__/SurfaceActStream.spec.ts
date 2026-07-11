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
    timestamp: `2026-07-09T12:0${height}:00Z`,
    signer,
    contractAddress: 'axone1contract',
    action: 'instantiate',
    title: 'IDENTITY REGISTERED',
    description: `${signer} was registered as an Axone identity.`,
    payload: {},
  }
}

describe('SurfaceActStream', () => {
  it('renders each record as four ordered lines in reduced-motion mode', async () => {
    const oldest = makeAct('TX-1', 1, 'axone1oldest')
    const newest = makeAct('TX-2', 2, 'axone1newest')
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: [newest, oldest],
        loading: false,
        reducedMotion: true,
        polling: false,
      },
    })

    await nextTick()

    const lines = wrapper.findAll('.surface-act-line')
    expect(lines).toHaveLength(8)
    expect(lines[0]!.text()).toBe('IDENTITY')
    expect(lines[1]!.text()).toContain('SIGNER axone1oldest')
    expect(lines[2]!.text()).toBe('IDENTITY REGISTERED')
    expect(lines[3]!.text()).toContain('axone1oldest was registered')
    expect(lines[4]!.text()).toBe('IDENTITY')
    expect(lines[5]!.text()).toContain('SIGNER axone1newest')
    expect(wrapper.find('.surface-act-cursor').exists()).toBe(false)
  })

  it('moves the register forward one typed line at a time', async () => {
    const oldest = makeAct('TX-1', 1, 'axone1oldest')
    const newest = makeAct('TX-2', 2, 'axone1newest')
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: [newest, oldest],
        loading: false,
        reducedMotion: false,
        polling: false,
      },
    })

    expect(wrapper.findAllComponents(SurfaceActLine)).toHaveLength(1)
    expect(wrapper.findComponent(SurfaceActLine).props('typingActive')).toBe(true)

    for (let count = 2; count <= 5; count += 1) {
      const beforeAdvance = wrapper.findAllComponents(SurfaceActLine)
      beforeAdvance[beforeAdvance.length - 1]!.vm.$emit('typing-complete')
      await nextTick()
      await nextTick()

      const lines = wrapper.findAllComponents(SurfaceActLine)
      expect(lines).toHaveLength(count)
      expect(lines[lines.length - 1]!.props('typingActive')).toBe(true)
    }

    expect(wrapper.findAll('.surface-act-line')[4]!.classes()).toContain('surface-act-line-category')
  })

  it('retains only the twelve latest logical lines', async () => {
    const acts = [
      makeAct('TX-4', 4, 'axone1newest'),
      makeAct('TX-3', 3, 'axone1middle'),
      makeAct('TX-2', 2, 'axone1older'),
      makeAct('TX-1', 1, 'axone1oldest'),
    ]
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: acts.slice(1),
        loading: false,
        reducedMotion: true,
        polling: false,
      },
    })

    await wrapper.setProps({ acts })

    const lines = wrapper.findAll('.surface-act-line')
    expect(lines).toHaveLength(12)
    expect(wrapper.text()).not.toContain('axone1oldest')
    expect(wrapper.text()).toContain('axone1older')
    expect(wrapper.text()).toContain('axone1newest')
    expect(wrapper.find('.surface-act-item').exists()).toBe(false)
  })
})
