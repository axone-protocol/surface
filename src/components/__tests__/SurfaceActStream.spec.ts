import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import SurfaceActStream from '../SurfaceActStream.vue'
import SurfaceActItem from '../SurfaceActItem.vue'

describe('SurfaceActStream', () => {
  it('renders loading and loaded states', async () => {
    const wrapper = mount(SurfaceActStream, {
      props: {
        acts: [],
        loading: true,
        error: undefined,
        reducedMotion: true,
        polling: true,
        lastSyncLabel: '17:11:19',
        registerSummary: undefined,
      },
    })

    expect(wrapper.find('.chain-polling-dots').exists()).toBe(true)

    await wrapper.setProps({
      loading: false,
      reducedMotion: true,
      polling: false,
      lastSyncLabel: '17:11:19',
      registerSummary: '233 RECORDS',
      acts: [
        {
          id: '0xdef:0:0',
          kind: 'governance.decision.recorded',
          txhash: '0xdef',
          msgIndex: 0,
          actIndex: 0,
          height: 44,
          timestamp: '2026-07-09T12:02:00Z',
          signer: 'axone1third',
          contractAddress: 'axone1contract',
          action: 'record_decision',
          title: 'ACT RECORDED',
          description: 'A governance act was recorded for the case. Verdict: gov:permitted.',
          payload: {},
        },
        {
          id: '0xghi:0:0',
          kind: 'identity.created',
          txhash: '0xghi',
          msgIndex: 0,
          actIndex: 0,
          height: 43,
          timestamp: '2026-07-09T12:01:00Z',
          signer: 'axone1second',
          contractAddress: 'axone1contract',
          action: 'instantiate',
          title: 'IDENTITY REGISTERED',
          description: 'Abstract account was registered as an Axone identity.',
          payload: {},
        },
        {
          id: '0xabc:0:0',
          kind: 'identity.created',
          txhash: '0xabc',
          msgIndex: 0,
          actIndex: 0,
          height: 42,
          timestamp: '2026-07-09T12:00:00Z',
          signer: 'axone1test',
          contractAddress: 'axone1contract',
          action: 'instantiate',
          title: 'IDENTITY REGISTERED',
          description: 'Abstract account was registered as an Axone identity.',
          payload: {},
        },
        {
          id: '0xzzz:0:0',
          kind: 'identity.created',
          txhash: '0xzzz',
          msgIndex: 0,
          actIndex: 0,
          height: 41,
          timestamp: '2026-07-09T11:59:00Z',
          signer: 'axone1older',
          contractAddress: 'axone1contract',
          action: 'instantiate',
          title: 'IDENTITY REGISTERED',
          description: 'Ignored because the window is capped.',
          payload: {},
        },
      ],
    })

    expect(wrapper.text()).toContain('233 RECORDS')
    expect(wrapper.text()).toContain('·')
    expect(wrapper.text()).toContain('ACT RECORDED')
    expect(wrapper.text()).toContain('IDENTITY REGISTERED')
    expect(wrapper.find('.surface-act-badge').text()).toBe('IDENTITY')
    expect(wrapper.text()).toContain('axone1test')
    expect(wrapper.text()).toContain('0xghi')
    expect(wrapper.text()).toContain('LAST SYNC 17:11:19')
    expect(wrapper.findAll('.surface-act-item')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('QUALIFIED EVENTS')
    expect(wrapper.text()).not.toMatch(/\d+ ACTS/)
    expect(wrapper.text()).not.toContain('next act')
    expect(wrapper.text()).not.toContain('Awaiting')
  })

  it('keeps the register ordered like paper when a new act arrives', async () => {
    const acts = [
      {
        id: 'TX-4:0:0',
        kind: 'identity.created' as const,
        txhash: 'TX-4',
        msgIndex: 0,
        actIndex: 0,
        height: 4,
        timestamp: '2026-07-09T12:04:00Z',
        signer: 'axone1newest',
        contractAddress: 'axone1contract',
        action: 'instantiate',
        title: 'IDENTITY REGISTERED',
        description: 'Newest act.',
        payload: {},
      },
      {
        id: 'TX-3:0:0',
        kind: 'identity.created' as const,
        txhash: 'TX-3',
        msgIndex: 0,
        actIndex: 0,
        height: 3,
        timestamp: '2026-07-09T12:03:00Z',
        signer: 'axone1middle',
        contractAddress: 'axone1contract',
        action: 'instantiate',
        title: 'IDENTITY REGISTERED',
        description: 'Middle act.',
        payload: {},
      },
      {
        id: 'TX-2:0:0',
        kind: 'identity.created' as const,
        txhash: 'TX-2',
        msgIndex: 0,
        actIndex: 0,
        height: 2,
        timestamp: '2026-07-09T12:02:00Z',
        signer: 'axone1oldest',
        contractAddress: 'axone1contract',
        action: 'instantiate',
        title: 'IDENTITY REGISTERED',
        description: 'Oldest act.',
        payload: {},
      },
    ]

    const wrapper = mount(SurfaceActStream, {
      props: {
        acts,
        loading: false,
        error: undefined,
        reducedMotion: true,
        polling: false,
        lastSyncLabel: undefined,
        registerSummary: undefined,
      },
    })

    expect(wrapper.findAll('.surface-act-item')[0]!.text()).toContain('axone1oldest')
    expect(wrapper.findAll('.surface-act-item')[2]!.text()).toContain('axone1newest')

    await wrapper.setProps({
      acts: [
        {
          ...acts[0]!,
          id: 'TX-5:0:0',
          txhash: 'TX-5',
          height: 5,
          signer: 'axone1incoming',
        },
        ...acts,
      ],
    })

    const rows = wrapper.findAll('.surface-act-item')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('axone1middle')
    expect(rows[1]!.text()).toContain('axone1newest')
    expect(rows[2]!.text()).toContain('axone1incoming')
    expect(wrapper.text()).not.toContain('axone1oldest')
  })

  it('gives the typewriter cursor to one act at a time', async () => {
    const acts = [
      {
        id: 'TX-2:0:0',
        kind: 'identity.created' as const,
        txhash: 'TX-2',
        msgIndex: 0,
        actIndex: 0,
        height: 2,
        timestamp: '2026-07-09T12:02:00Z',
        signer: 'axone1newest',
        contractAddress: 'axone1contract',
        action: 'instantiate',
        title: 'IDENTITY REGISTERED',
        description: 'Newest act.',
        payload: {},
      },
      {
        id: 'TX-1:0:0',
        kind: 'identity.created' as const,
        txhash: 'TX-1',
        msgIndex: 0,
        actIndex: 0,
        height: 1,
        timestamp: '2026-07-09T12:01:00Z',
        signer: 'axone1oldest',
        contractAddress: 'axone1contract',
        action: 'instantiate',
        title: 'IDENTITY REGISTERED',
        description: 'Oldest act.',
        payload: {},
      },
    ]

    const wrapper = mount(SurfaceActStream, {
      props: {
        acts,
        loading: false,
        error: undefined,
        reducedMotion: false,
        polling: false,
        lastSyncLabel: undefined,
        registerSummary: undefined,
      },
    })

    expect(wrapper.findAllComponents(SurfaceActItem)).toHaveLength(1)
    expect(wrapper.findComponent(SurfaceActItem).props('typingActive')).toBe(true)

    wrapper.findComponent(SurfaceActItem).vm.$emit('typing-complete')
    await nextTick()
    await nextTick()

    const items = wrapper.findAllComponents(SurfaceActItem)
    expect(items).toHaveLength(2)
    expect(items[0]!.props('typingActive')).toBe(false)
    expect(items[1]!.props('typingActive')).toBe(true)
  })
})
